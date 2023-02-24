import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { Params, Results, State } from ".";
import { getConfig } from "./utils/config";
import StreamingState, { Update } from './utils/state';

export interface SimpleRequest {
  query: string;
}

export interface ExtendedRequestItem {
  query: string;
  params?: (string | null)[];
}

export interface ExtendedRequest {
  queries: ExtendedRequestItem[];
}

export type SqlRequest = SimpleRequest | ExtendedRequest;

export type NoticeSeverity =
| "Panic"
| "Fatal"
| "Error"
| "Warning"
| "Notice"
| "Debug"
| "Info"
| "Log";

export interface NoticeResponse {
  message: string;
  severity: NoticeSeverity;
}

export type WebSocketResult =
| { type: "ReadyForQuery"; payload: string }
| { type: "Notice"; payload: NoticeResponse }
| { type: "CommandComplete"; payload: string }
| { type: "Error"; payload: string }
| { type: "Rows"; payload: string[] }
| { type: "Row"; payload: [number, boolean, number, unknown] }

class SqlWebSocket {
  socket: WebSocket;
  setSocketReady: Dispatch<SetStateAction<boolean>>;

  constructor(
    socket: WebSocket,
    setSocketReady: Dispatch<SetStateAction<boolean>>
  ) {
    this.socket = socket;
    this.setSocketReady = setSocketReady;
  }

  send(request: SqlRequest) {
    this.setSocketReady(false);
    this.socket.send(JSON.stringify(request));
  }

  onResult(callback: (data: WebSocketResult) => void) {
    this.socket.onmessage = function (event) {
      callback(JSON.parse(event.data) as WebSocketResult);
    };
  }

  onOpen(callback: (event: Event) => void) {
    this.socket.onopen = callback;
  }
}

/**
 * WebSocket hook for the Materialize WebSocket API
 * @param params
 * @returns
 */
function useSqlWs(params: Params) {
  const [socket, setSocket] = useState<SqlWebSocket | null>(null);
  const [socketReady, setSocketReady] = useState<boolean>(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const config = params.config || getConfig();
  const { auth, host, proxy } = config || {};
  const { password, user } = auth || {};
  const { query } = params;
  const { sql } = query;

  const handleMessage = useCallback((event: MessageEvent) => {
    const data: WebSocketResult = JSON.parse(event.data);
    if (data.type === "ReadyForQuery") {
      setSocketReady(true);
    } else if (data.type === "Error") {
      setSocketError(data.payload);
    }
  }, []);

  const handleClose = useCallback(() => {
    setSocketReady(false);
    setSocket(null);
  }, []);

  const handleError = useCallback(() => {
    setSocketReady(false);
    setSocketError("Connection error");
    setSocket(null);
  }, []);

  const buildSocket = useCallback(() => {
    const url = proxy ? `${proxy}?query=${encodeURI(sql)}` : `wss://${host}/api/experimental/sql`;
    const ws = new WebSocket(url);
    setSocketError(null);

    ws.addEventListener("message", handleMessage);
    ws.onopen = function () {
      ws.send(JSON.stringify({ user, password }));
    };
    ws.addEventListener("close", handleClose);
    ws.addEventListener("error", handleError);

    setSocket(new SqlWebSocket(ws, setSocketReady));

    return ws;
  }, [handleClose, handleMessage, handleError, sql, host, user, password]);

  const cleanSocket = useCallback((ws: WebSocket) => {
    if (ws) {
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("message", handleMessage);
      ws.removeEventListener("error", handleError);
      ws.close();
    }

    setSocketError(null);
    setSocket(null);
    setSocketReady(false);
  }, [handleClose, handleMessage, handleError]);

  const reconnect = useCallback(async () => {
    if (socket) {
      cleanSocket(socket.socket);
    }
    buildSocket();
  }, [buildSocket, cleanSocket, socket]);

  const complete = useCallback(async () => {
    if (socket) {
      cleanSocket(socket.socket);
    }
  }, [cleanSocket, socket]);

  useEffect(() => {
    const ws = buildSocket();

    if (ws) {
      return () => {
        cleanSocket(ws)
      };
    }
  }, [buildSocket, cleanSocket]);

  return { socketReady, socket, socketError, reconnect, complete };
};

interface SubscriptionParams<T> {
  socket: SqlWebSocket,
  cluster?: string,
  collectHistory?: boolean,
  onUpdate: (params: CallbackParams<T>) => void,
  onComplete: (params: CallbackParams<T>) => void,
  onError: () => void,
}

interface CallbackParams<T> {
  columns: Array<string>;
  rows: Readonly<Array<T>>;
  history?: Readonly<Array<Update<T>>>;
}

/**
 * Handle subscription updates and keep up-to-date the state
 * @param param0
 */
const handleSubscription = function<T>({
  socket,
  cluster,
  onUpdate,
  onComplete,
  onError
}: SubscriptionParams<T>) {
  const state = new StreamingState<T>();
  const buffer: Array<Update<T>> = [];
  const columns: Array<string> = [];
  let clusterConfirmed = false;
  let lastTimestamp = 0;

  const processBuffer = () => {
    // Update the state
    state.batchUpdate(buffer, lastTimestamp);
    onUpdate({ columns, rows: state.getStateAsArray(), history: state.getHistory() });
  }

  const handleCommandComplete = () => {
    if (cluster && !clusterConfirmed) {
      clusterConfirmed = true;
    } else {
      onComplete({ columns, rows: state.getStateAsArray(), history: state.getHistory() });
      processBuffer();
    }
  }

  const handleRow = (payload: any) => {
      const [
          ts,
          progress,
          diff,
          ...rowData
      ] = payload;
      lastTimestamp = ts;

      if (progress) {
        if (buffer.length > 0) {
          try {
            processBuffer();
          } catch (err) {
            console.error(err);
            onError();
          } finally {
            buffer.splice(0, buffer.length);
          }
        }
      } else {
          const value: Record<any, any> = {};
          columns.forEach((columnName, i) => {
            value[columnName] = rowData[i];
          });
          buffer.push({ value, diff });
      }
  }

  socket.onResult(({ type, payload }: WebSocketResult) => {
    switch (type) {
        case "Rows":
          // Removes mz_timestamp, mz_progressed, mz_diff
          payload.splice(0, 3);
          payload.forEach((columnName) => columns.push(columnName));
          break;
        case "Row":
          handleRow(payload);
          break;
        case "CommandComplete":
          handleCommandComplete();
          break;
        default:
          break;
    }
  });
}

/**
 * Subscription hooks using WebSockets to Materialize
 * @param wsParams
 * @param subscribeParams
 * @returns
 */
function useSubscribe<T>(params: Params): State<T> {
  const [state, setState] = useState<Readonly<Results<T>>>({columns: [], rows: [],});
  const [history, setHistory] = useState<Readonly<Array<Update<T>> | undefined>>(undefined);
  const { socket, socketReady, socketError, complete, reconnect } = useSqlWs(params);
  const { query } = params;
  const { sql, cluster, snapshot, collectHistory } = query;

  const onUpdate = useCallback(({ columns, rows, history }: CallbackParams<T>) => {
    setState({ columns, rows });

    if (collectHistory && history) {
      setHistory([...history]);
    }
  }, []);

  const onComplete = useCallback((callbackParams: CallbackParams<T>) => {
    onUpdate(callbackParams);
    complete();
  }, [complete]);

  const onError = useCallback(() => reconnect(), [reconnect]);

  useEffect(() => {
    if (socket && socketReady && !socketError) {
      // Handle progress, column names, udpates, state, etc..
      handleSubscription<T>({
        socket,
        cluster,
        collectHistory,
        onUpdate,
        onComplete,
        onError,
      });

      const request: SqlRequest = {
          query: `
              ${cluster ? `SET cluster = ${cluster};` : ""}
              SUBSCRIBE (${sql}) WITH (${snapshot === false ? "SNAPSHOT = false, " : ""} PROGRESS);
          `
      }
      socket.send(request);
    }
  }, [cluster, snapshot, socket, collectHistory, socketError, socketReady, sql, onError, onUpdate, onError]);

  return { data: state, error: socketError, loading: !socketReady, reload: reconnect, history };
};

export default useSubscribe;
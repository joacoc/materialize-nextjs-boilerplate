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

function useSqlWs(params: Params) {
  const [socket, setSocket] = useState<SqlWebSocket | null>(null);
  const [socketReady, setSocketReady] = useState<boolean>(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const config = params.config || getConfig();

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
    if (config) {
      const { auth, host, proxy } = config;

      const url = proxy ? `${proxy}?query=${encodeURI(params.query.sql)}` : `wss://${host}/api/experimental/sql`;
      const ws = new WebSocket(url);
      setSocketError(null);

      ws.addEventListener("message", handleMessage);
      ws.onopen = function () {
        ws.send(JSON.stringify(auth));
      };
      ws.addEventListener("close", handleClose);
      ws.addEventListener("error", handleError);

      setSocket(new SqlWebSocket(ws, setSocketReady));

      return ws;
    }
  }, [config, handleClose, handleMessage, handleError, params.query.sql]);

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
  }, [config, buildSocket, cleanSocket, handleClose, handleMessage]);

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
  history: Readonly<Array<Update<T>>>;
}

class Subscription<T> {
  state: StreamingState<T>;
  columns: Array<string>;
  hasUpdates: boolean;
  buffer: Array<Update<T>>;
  socket: SqlWebSocket;
  collectHistory: boolean;
  lastTimestamp: number;
  cluster?: string;
  clusterConfirmed: boolean;
  onUpdate: (params: CallbackParams<T>) => void;
  onComplete: (params: CallbackParams<T>) => void;
  onError: () => void;

  constructor({
    socket,
    cluster,
    collectHistory,
    onUpdate,
    onComplete,
    onError
  }: SubscriptionParams<T>) {
    this.state = new StreamingState();
    this.hasUpdates = false;
    this.buffer = [];
    this.socket = socket;
    this.lastTimestamp = 0;
    this.columns = [];
    this.cluster = cluster;
    this.clusterConfirmed = false;
    this.collectHistory = collectHistory || false;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.onError = onError;

    socket.onResult(({ type, payload }: WebSocketResult) => {
      switch (type) {
          case "Rows":
            // Removes mz_timestamp, mz_progressed, mz_diff
            payload.splice(0, 3);
            this.columns = payload;
            break;
          case "Row":
            this.handleRow(payload);
            break;
          case "CommandComplete":
            this.handleCommandComplete();
            break;
          default:
            break;
      }
    });
  }

  private processBuffer() {
    // Update the state
    this.state.batchUpdate(this.buffer, this.lastTimestamp);
    this.hasUpdates = false;
    this.onUpdate({ columns: this.columns, rows: this.state.getStateAsArray(), history: [] });
  }

  getColumns() {
    return this.columns;
  }

  handleCommandComplete() {
    if (this.cluster && !this.clusterConfirmed) {
      this.clusterConfirmed = true;
    } else {
      this.onComplete({ columns: this.columns, rows: this.state.getStateAsArray(), history: [] });
      this.processBuffer();
    }
  }

  handleRow(payload: any) {
      const [
          ts,
          progress,
          diff,
          ...rowData
      ] = payload;
      this.lastTimestamp = ts;

      if (progress) {
          if (this.hasUpdates) {
              try {
                this.processBuffer();
              } catch (err) {
                console.error(err);
                this.onError();
              } finally {
                this.buffer.splice(0, this.buffer.length);
              }
          }
      } else {
          this.hasUpdates = true;
          const value: Record<any, any> = {};
          this.columns.forEach((columnName, i) => {
            value[columnName] = rowData[i];
          });
          this.buffer.push({ value, diff });
      }
  }

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
  const { sql, key, cluster, snapshot, collectHistory } = query;

  const onUpdate = useCallback(({ columns, rows, history }: CallbackParams<T>) => {
    // Set the state
    setState({ columns, rows });

    // Set the history
    if (collectHistory) {
      setHistory([...history]);
    }
  }, []);

  const onComplete = useCallback((callbackParams: CallbackParams<T>) => {
    onUpdate(callbackParams);
    complete();
  }, []);

  const onError = useCallback(() => reconnect(), []);

  useEffect(() => {
    if (socket && socketReady && !socketError) {
        // Handle progress, colnames, udpated inside the streaming State
        new Subscription<T>({
          socket,
          cluster,
          collectHistory,
          onUpdate,
          onComplete,
          onError,
        });

        // TODO: Make progress optional
        const request: SqlRequest = {
            query: `
                ${cluster ? `SET cluster = ${cluster};` : ""}
                SUBSCRIBE (${sql}) WITH (${snapshot === false ? "SNAPSHOT = false, " : ""} PROGRESS);
            `
        }
        socket.send(request);
    }
  }, [cluster, key, reconnect, complete, snapshot, socket, collectHistory, socketError, socketReady, sql]);

  return { data: state, error: socketError, loading: !socketReady, reload: reconnect, history };
};

export default useSubscribe;
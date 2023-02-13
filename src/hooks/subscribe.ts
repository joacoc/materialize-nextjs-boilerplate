import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { Params, Results, State } from ".";
import { getConfig } from "./utils/config";
import StreamingState, { Update } from './utils/state';

// TODO: Handle errors correctly.

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
  // const [complete, setComplete] = useState<boolean>(false);
  const { host, proxy, auth } = params.config || getConfig();

  const handleMessage = useCallback((event: MessageEvent) => {
    const data: WebSocketResult = JSON.parse(event.data);
    if (data.type === "ReadyForQuery") {
      setSocketReady(true);
    } else if (data.type === "Error") {
      setSocketError(data.payload);
    }
    // else if (data.type === "CommandComplete" && socket) {
    //   setComplete(true);
    // }
  }, []);

  const handleClose = useCallback(() => {
    setSocketReady(false);
    setSocketError("Connection error");
  }, []);

  const buildSocket = useCallback(() => {
    const url = proxy ? `${proxy}?query=${encodeURI(params.query.sql)}` : `wss://${host}/api/experimental/sql`;
    const ws = new WebSocket(url);
    setSocketError(null);

    ws.addEventListener("message", handleMessage);
    ws.onopen = function () {
      ws.send(JSON.stringify(auth));
    };
    ws.addEventListener("close", handleClose);

    setSocket(new SqlWebSocket(ws, setSocketReady));

    return ws;
  }, [auth, handleClose, handleMessage, host, params.query.sql, proxy]);

  const cleanSocket = useCallback((ws: WebSocket) => {
    setSocketError(null);
    setSocket(null);
    setSocketReady(false);
    if (ws) {
      ws.close();
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("message", handleMessage);
    }
  }, [handleClose, handleMessage]);

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

    return () => {
      cleanSocket(ws)
    };
  }, [auth, buildSocket, cleanSocket, handleClose, handleMessage, host]);

  return { socketReady, socket, socketError, reconnect, complete };
};

/**
 * Subscription hooks using WebSockets to Materialize
 * @param wsParams
 * @param subscribeParams
 * @returns
 */
function useSubscribe<T>(params: Params): State<T> {
  const [state, setState] = useState<Readonly<Results<T>>>({columns: [], rows: [],});
  const [history, setHistory] = useState<Readonly<Array<Update> | undefined>>(undefined);
  const { socket, socketReady, socketError, complete, reconnect } = useSqlWs(params);
  const { query } = params;
  const { sql, key, cluster, snapshot, collectHistory } = query;

  useEffect(() => {
    if (socket && socketReady && !socketError) {
        // Handle progress, colnames, udpated inside the streaming State
        const streamingState = new StreamingState(collectHistory);
        let colNames: Array<string> = [];
        let updated = false;
        let keyIndex: number = -1;
        setState({ columns: colNames, rows: streamingState.getValues(), });
        setHistory(undefined);

        socket.onResult(({ type, payload }: WebSocketResult) => {
            switch (type) {
                case "Rows":
                    // Removes mz_timestamp, mz_progressed, mz_diff
                    payload.splice(0, 3);
                    colNames = payload;

                    if (key) {
                      const index = colNames.findIndex((col) => col === key );
                      keyIndex = index === -1 ? index : index + 3;
                    }
                    break;
                case "Row":
                    const [
                        ts,
                        progress,
                        diff,
                        ...rowData
                    ] = payload;

                    if (progress) {
                        if (updated) {
                            setState({ columns: colNames, rows: streamingState.getValues(), });
                            updated = false;

                            if (collectHistory) {
                              const history = streamingState.getHistory();
                              if (history) {
                                setHistory([...history]);
                              }
                            }
                        }
                    } else {
                        updated = true;
                        const value: Record<string, T> = {};
                        colNames.forEach((col, i) => {
                            value[col] = rowData[i] as any;
                        });

                        try {
                            streamingState.update({
                                key: key && String(payload[keyIndex]),
                                value,
                                diff
                            }, Number(ts));
                        } catch (err) {
                          console.error(err);
                          reconnect();
                        }
                    }
                    break;
                case "CommandComplete":
                    console.log("[socket][onmessage]","Command complete.");
                    complete();
                    setState({ columns: colNames, rows: streamingState.getValues(), });
                    break;
                default:
                    break;
            }
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
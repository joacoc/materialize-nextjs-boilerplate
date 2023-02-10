import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { Config, Params, Results, State } from ".";
import StreamingState from './utils/state';

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

export type WebSocketResult<T> =
| { type: "ReadyForQuery"; payload: string }
| { type: "Notice"; payload: NoticeResponse }
| { type: "CommandComplete"; payload: string }
| { type: "Error"; payload: string }
| { type: "Rows"; payload: string[] }
// TODO: Accept Row without progress
| { type: "Row"; payload: [number, boolean, number, T] };

class SqlWebSocket<T> {
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

  onResult(callback: (data: WebSocketResult<T>) => void) {
    this.socket.onmessage = function (event) {
      callback(JSON.parse(event.data) as WebSocketResult<T>);
    };
  }

  onOpen(callback: (event: Event) => void) {
    this.socket.onopen = callback;
  }
}

function useSqlWs<T>({ auth, host }: Config) {
  const [socket, setSocket] = useState<SqlWebSocket<T> | null>(null);
  const [socketReady, setSocketReady] = useState<boolean>(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    if (data.type === "ReadyForQuery") {
      setSocketReady(true);
    }
  }, []);

  const handleClose = useCallback((_: CloseEvent) => {
    setSocketReady(false);
    setSocketError("Connection error");
  }, []);

  const buildSocket = useCallback(() => {
    const ws = new WebSocket(
      `wss://${host}/api/experimental/sql`
    );
    setSocketError(null);

    ws.addEventListener("message", handleMessage);
    ws.onopen = function () {
      ws.send(JSON.stringify(auth));
    };
    ws.addEventListener("close", handleClose);

    setSocket(new SqlWebSocket<T>(ws, setSocketReady));

    return ws;
  }, [auth, handleClose, handleMessage, host]);

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

  useEffect(() => {
    const ws = buildSocket();

    return () => {
      cleanSocket(ws)
    };
  }, [auth, buildSocket, cleanSocket, handleClose, handleMessage, host]);

  return { socketReady, socket, socketError, reconnect };
};

/**
 * Subscription hooks using WebSockets to Materialize
 * @param wsParams
 * @param subscribeParams
 * @returns
 */
function useSubscribe<T>({ query, config }: Params): State {
  const [state, setState] = useState<Readonly<Results>>({columns: [], rows: [],});
  const { socket, socketReady, socketError, reconnect } = useSqlWs<T>(config);
  const { sql, key, cluster, snapshot } = query;

  useEffect(() => {
    if (socket && socketReady) {
        // Handle progress, colnames, udpated inside the streaming State
        const streamingState = new StreamingState();
        let colNames: Array<string> = [];
        let updated = false;
        let keyIndex: number = -1;
        setState({ columns: colNames, rows: streamingState.getValues(), });

        socket.onResult(({ type, payload }: WebSocketResult<T>) => {
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
                        }
                    } else {
                        updated = true;
                        const value: Record<string, T> = {};
                        colNames.forEach((col, i) => {
                            value[col] = rowData[i];
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
                SUBSCRIBE (${sql}) WITH (${snapshot ? "SNAPSHOT, " : ""} PROGRESS);
            `
        }
        socket.send(request);
    }
  }, [cluster, key, query, reconnect, snapshot, socket, socketReady]);

  return { data: state, error: socketError, loading: !socketReady, reload: reconnect, };
};

export default useSubscribe;
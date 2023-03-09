import useSubscribe from "./subscribe";
import useQuery from "./query";
import { Update } from "./utils/state";

export interface State<T> {
  data: Results<T> | null,
  loading: boolean,
  error: string | null,
  history: Readonly<Readonly<Array<Update<T>>>> | undefined,
  reload: () => Promise<void>,
}

export interface Auth {
  user: string;
  password: string;
}

export interface Config {
  auth: Auth
  host: string
  proxy?: string
}

export interface Query {
  cluster?: string;
  sql: string;
  snapshot?: boolean;
  progress?: boolean;
  collectHistory?: boolean;
}

export interface Params {
  query: Query,
  config?: Config
}

export interface Results<T> {
  columns: Array<string>;
  rows: Readonly<Array<T>>;
  getColumnByName?: <R, V>(row: R[], name: string) => V;
};

export {
  useSubscribe,
  useQuery
};
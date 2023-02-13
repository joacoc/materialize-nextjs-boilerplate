import useSubscribe from "./subscribe";
import useQuery from "./query";
import { Update } from "./utils/state";

export interface State {
  data: Results | null,
  loading: boolean,
  error: string | null,
  history: Readonly<Array<Update>> | undefined,
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
  key?: string | Array<string>;
  sql: string;
  snapshot?: boolean;
  progress?: boolean;
  collectHistory?: boolean;
}

export interface Params {
  query: Query,
  config?: Config
}

export interface Results {
  columns: Array<string>;
  rows: Array<any>;
  getColumnByName?: <R, V>(row: R[], name: string) => V;
};

export {
  useSubscribe,
  useQuery
};
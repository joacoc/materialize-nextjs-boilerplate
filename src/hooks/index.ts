import useSubscribe from "./subscribe";
import useQuery from "./query";

export interface State {
  data: Results | null,
  loading: boolean,
  error: string | null,
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
}

export interface Params {
  query: Query,
  config: Config
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
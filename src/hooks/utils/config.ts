import { Config } from '../'
import { user, password, host } from "../../../mz.config.js";

const config: Config = {
    auth: {
      user,
      password
    },
    host,
};

export const getConfig = (): Readonly<Config> => {
  const { auth, host } = config;
  const { user, password } = auth;
  if (!host || !user || !password) {
    throw new Error("Missing Materialize config fields.");
  } else return config;
};
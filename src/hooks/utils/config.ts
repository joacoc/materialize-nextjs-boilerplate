import { Config } from '../';

/**
 * Set your Materialize configuration
 */
const config: Config = {
  auth: {
    password: "",
    user: "",
  },
  host: ""
};

export const getConfig = (): Readonly<Config | undefined> => {
  const { auth, host } = config;
  const { user, password } = auth;

  if (!host || !user || !password) {
    throw new Error("Invalid Materialize config. Set a valid config as parameter or one by deafult.");
  } else return config;
};
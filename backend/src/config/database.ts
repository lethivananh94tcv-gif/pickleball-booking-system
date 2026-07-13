import type { config } from "mssql";
import { env } from "./env";

export const databaseConfig: config = {
  user: env.dbUser,
  password: env.dbPassword,
  server: env.dbServer,
  database: env.dbName,
  port: env.dbPort,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 60000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};
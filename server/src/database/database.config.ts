import { Dialect } from 'sequelize';

export interface IDatabaseConfig {
  dialect: Dialect;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export default () => ({
  database: {
    dialect: process.env.DB_DIALECT as Dialect,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  } satisfies IDatabaseConfig,
});

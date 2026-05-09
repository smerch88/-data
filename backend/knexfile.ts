import 'dotenv/config';
import path from 'path';
import type { Knex } from 'knex';

const databaseUrl =
  process.env.DATABASE_URL ??
  `postgres://${process.env.POSTGRES_USER ?? 'app'}:${process.env.POSTGRES_PASSWORD ?? 'app'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5433'}/${process.env.POSTGRES_DB ?? 'appdb'}`;

const base: Knex.Config = {
  client: 'pg',
  connection: databaseUrl,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
    loadExtensions: ['.ts', '.js'],
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    extension: 'ts',
    loadExtensions: ['.ts', '.js'],
  },
};

const config: Record<string, Knex.Config> = {
  development: base,
  production: base,
};

export default config;

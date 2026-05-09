import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl:
    process.env.DATABASE_URL ??
    `postgres://${process.env.POSTGRES_USER ?? 'app'}:${process.env.POSTGRES_PASSWORD ?? 'app'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5433'}/${process.env.POSTGRES_DB ?? 'appdb'}`,
};

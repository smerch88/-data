import express from 'express';
import { env } from './env';
import { db } from './db';
import healthRouter from './routes/health';

const app = express();
app.use(express.json());

app.use('/health', healthRouter);

app.get('/', (_req, res) => {
  res.json({ name: 'data-api', env: env.nodeEnv });
});

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down...`);
  server.close();
  await db.destroy();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

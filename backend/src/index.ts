import express, { type NextFunction, type Request, type Response } from 'express';
import { env } from './env';
import { db } from './db';
import healthRouter from './routes/health';
import coursesRouter from './routes/courses';
import mentorsRouter from './routes/mentors';
import studentsRouter from './routes/students';
import homeworkRouter from './routes/homework';
import slackMessagesRouter from './routes/slack-messages';
import vleSitesRouter from './routes/vle-sites';
import loginEventsRouter from './routes/login-events';
import { mountSwagger } from './swagger';

const app = express();
app.use(express.json());

mountSwagger(app);

app.use('/health', healthRouter);
app.use('/courses', coursesRouter);
app.use('/mentors', mentorsRouter);
app.use('/students', studentsRouter);
app.use('/homework', homeworkRouter);
app.use('/slack-messages', slackMessagesRouter);
app.use('/vle-sites', vleSitesRouter);
app.use('/login-events', loginEventsRouter);

app.get('/', (_req, res) => {
  res.json({
    name: 'data-api',
    env: env.nodeEnv,
    docs: '/docs',
    openapi: '/openapi.json',
  });
});

interface HttpError extends Error {
  status?: number;
  resource?: string;
  identifier?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  const body: Record<string, unknown> = { error: err.message || 'internal error' };
  if (err.resource) body.resource = err.resource;
  if (err.identifier) body.id = err.identifier;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  res.status(status).json(body);
});

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
  console.log(`Swagger UI: http://localhost:${env.port}/docs`);
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down...`);
  server.close();
  await db.destroy();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

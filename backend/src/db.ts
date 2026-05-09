import knex from 'knex';
import knexConfig from '../knexfile';
import { env } from './env';

export const db = knex(knexConfig[env.nodeEnv] ?? knexConfig.development!);

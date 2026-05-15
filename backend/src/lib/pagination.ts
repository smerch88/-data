import type { Request } from 'express';
import type { Knex } from 'knex';

export interface ListQuery {
  limit: number;
  offset: number;
}

export async function countTotal(qb: Knex.QueryBuilder): Promise<number> {
  const rows = (await qb.clone().count<{ total: string }[]>('* as total')) as {
    total: string;
  }[];
  const first = rows[0];
  return Number(first?.total ?? 0);
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function parseListQuery(req: Request): ListQuery {
  const rawLimit = req.query.limit;
  const rawOffset = req.query.offset;

  let limit = DEFAULT_LIMIT;
  if (typeof rawLimit === 'string') {
    const n = parseInt(rawLimit, 10);
    if (!Number.isFinite(n) || n < 1) throw new BadRequestError('limit must be a positive integer');
    limit = Math.min(n, MAX_LIMIT);
  }

  let offset = 0;
  if (typeof rawOffset === 'string') {
    const n = parseInt(rawOffset, 10);
    if (!Number.isFinite(n) || n < 0) throw new BadRequestError('offset must be a non-negative integer');
    offset = n;
  }

  return { limit, offset };
}

export class BadRequestError extends Error {
  status = 400 as const;
}

export class NotFoundError extends Error {
  status = 404 as const;
  resource: string;
  identifier: string;
  constructor(resource: string, identifier: string) {
    super(`${resource} not found`);
    this.resource = resource;
    this.identifier = identifier;
  }
}

export function pickString(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function pickInt(req: Request, key: string): number | undefined {
  const v = req.query[key];
  if (typeof v !== 'string' || v.length === 0) return undefined;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) throw new BadRequestError(`${key} must be an integer`);
  return n;
}

export function pickBool(req: Request, key: string): boolean | undefined {
  const v = req.query[key];
  if (typeof v !== 'string' || v.length === 0) return undefined;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  throw new BadRequestError(`${key} must be true/false`);
}

export function pickDate(req: Request, key: string): string | undefined {
  const v = req.query[key];
  if (typeof v !== 'string' || v.length === 0) return undefined;
  // Accept ISO date (YYYY-MM-DD) or full timestamp; rely on Postgres to coerce.
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) {
    throw new BadRequestError(`${key} must be YYYY-MM-DD or ISO timestamp`);
  }
  return v;
}

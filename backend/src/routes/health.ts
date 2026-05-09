import { Router } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await db.raw('select 1 as ok');
    const ok = result.rows?.[0]?.ok === 1;
    res.json({ status: 'ok', db: ok });
  } catch (err) {
    res.status(500).json({ status: 'error', message: (err as Error).message });
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness + DB ping
 *     tags: [health]
 *     responses:
 *       200:
 *         description: Service is up and DB responded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 db: { type: boolean }
 *       500:
 *         description: DB unreachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: error }
 *                 message: { type: string }
 */
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

import { Router } from 'express';
import { db } from '../db';
import {
  parseListQuery,
  pickString,
  pickInt,
  pickDate,
  countTotal,
} from '../lib/pagination';

const router = Router();

/**
 * @openapi
 * /login-events:
 *   get:
 *     summary: List per-day per-site click rows
 *     tags: [login-events]
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - in: query
 *         name: student_id
 *         schema: { type: string }
 *       - in: query
 *         name: id_site
 *         schema: { type: integer }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated list ordered by occurred_on
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/LoginEvent' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = parseListQuery(req);
    const studentId = pickString(req, 'student_id');
    const idSite = pickInt(req, 'id_site');
    const from = pickDate(req, 'from');
    const to = pickDate(req, 'to');

    const q = db('login_events');
    if (studentId) q.where({ student_id: studentId });
    if (idSite !== undefined) q.where({ id_site: idSite });
    if (from) q.where('occurred_on', '>=', from);
    if (to) q.where('occurred_on', '<', to);

    const total = await countTotal(q);
    const items = await q
      .orderBy('occurred_on', 'asc')
      .orderBy('student_id', 'asc')
      .orderBy('id_site', 'asc')
      .limit(limit)
      .offset(offset);

    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

export default router;

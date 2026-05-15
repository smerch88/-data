import { Router } from 'express';
import { db } from '../db';
import { parseListQuery, NotFoundError, countTotal } from '../lib/pagination';

const router = Router();

/**
 * @openapi
 * /mentors:
 *   get:
 *     summary: List mentors
 *     tags: [mentors]
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *     responses:
 *       200:
 *         description: Paginated list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/Mentor' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = parseListQuery(req);
    const q = db('mentors');
    const total = await countTotal(q);
    const items = await q.orderBy('name', 'asc').limit(limit).offset(offset);
    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /mentors/{id}:
 *   get:
 *     summary: Get a single mentor
 *     tags: [mentors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Mentor
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Mentor' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    const row = await db('mentors').where({ id: req.params.id }).first();
    if (!row) throw new NotFoundError('mentor', req.params.id);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

export default router;

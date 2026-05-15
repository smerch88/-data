import { Router } from 'express';
import { db } from '../db';
import {
  parseListQuery,
  NotFoundError,
  BadRequestError,
  pickString,
  pickInt,
  countTotal,
} from '../lib/pagination';

const router = Router();

/**
 * @openapi
 * /homework:
 *   get:
 *     summary: List homework rows with filters
 *     tags: [homework]
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - in: query
 *         name: student_id
 *         schema: { type: string }
 *       - in: query
 *         name: hw_id
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [missed, late, submitted, graded] }
 *       - in: query
 *         name: module
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list ordered by deadline
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/Homework' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = parseListQuery(req);
    const studentId = pickString(req, 'student_id');
    const hwId = pickString(req, 'hw_id');
    const status = pickString(req, 'status');
    const module = pickInt(req, 'module');

    const q = db('homework');
    if (studentId) q.where({ student_id: studentId });
    if (hwId) q.where({ hw_id: hwId });
    if (status) q.where({ status });
    if (module !== undefined) q.where({ module });

    const total = await countTotal(q);
    const items = await q
      .orderBy('deadline', 'asc')
      .orderBy('student_id', 'asc')
      .limit(limit)
      .offset(offset);

    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /homework/{id}:
 *   get:
 *     summary: Get a single homework row by numeric id
 *     tags: [homework]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Homework
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Homework' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) throw new BadRequestError('id must be an integer');
    const row = await db('homework').where({ id }).first();
    if (!row) throw new NotFoundError('homework', req.params.id);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

export default router;

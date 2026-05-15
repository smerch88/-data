import { Router } from 'express';
import { db } from '../db';
import { parseListQuery, NotFoundError, pickString, countTotal } from '../lib/pagination';

const router = Router();

/**
 * @openapi
 * /courses:
 *   get:
 *     summary: List courses
 *     tags: [courses]
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [bootcamp, self_paced, live]
 *     responses:
 *       200:
 *         description: Paginated list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/Course' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = parseListQuery(req);
    const format = pickString(req, 'format');

    const q = db('courses');
    if (format) q.where({ format });

    const total = await countTotal(q);
    const items = await q.orderBy('name', 'asc').limit(limit).offset(offset);

    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /courses/{id}:
 *   get:
 *     summary: Get a single course
 *     tags: [courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Course' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    const row = await db('courses').where({ id: req.params.id }).first();
    if (!row) throw new NotFoundError('course', req.params.id);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

export default router;

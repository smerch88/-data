import { Router } from 'express';
import { db } from '../db';
import {
  parseListQuery,
  NotFoundError,
  BadRequestError,
  pickString,
  countTotal,
} from '../lib/pagination';

const router = Router();

/**
 * @openapi
 * /vle-sites:
 *   get:
 *     summary: List VLE site dimension rows
 *     tags: [vle-sites]
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - in: query
 *         name: activity_type
 *         description: Exact activity_type filter (e.g. forumng, resource, oucontent).
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/VleSite' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = parseListQuery(req);
    const activityType = pickString(req, 'activity_type');

    const q = db('vle_sites');
    if (activityType) q.where({ activity_type: activityType });

    const total = await countTotal(q);
    const items = await q.orderBy('id_site', 'asc').limit(limit).offset(offset);

    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /vle-sites/{id_site}:
 *   get:
 *     summary: Get a single VLE site
 *     tags: [vle-sites]
 *     parameters:
 *       - in: path
 *         name: id_site
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: VLE site
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VleSite' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id_site', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id_site, 10);
    if (!Number.isFinite(id)) throw new BadRequestError('id_site must be an integer');
    const row = await db('vle_sites').where({ id_site: id }).first();
    if (!row) throw new NotFoundError('vle_site', req.params.id_site);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

export default router;

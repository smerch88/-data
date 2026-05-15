import { Router } from 'express';
import { db } from '../db';
import {
  parseListQuery,
  NotFoundError,
  BadRequestError,
  pickString,
  pickBool,
  pickDate,
  countTotal,
} from '../lib/pagination';

const router = Router();

/**
 * @openapi
 * /slack-messages:
 *   get:
 *     summary: List slack messages with filters
 *     tags: [slack-messages]
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - in: query
 *         name: student_id
 *         schema: { type: string }
 *       - in: query
 *         name: channel_type
 *         schema: { type: string, enum: [mentor_dm, group_chat, support_chat] }
 *       - in: query
 *         name: is_from_student
 *         schema: { type: boolean }
 *       - in: query
 *         name: mentioned_mentor
 *         schema: { type: boolean }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Paginated list ordered by sent_at
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/SlackMessage' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = parseListQuery(req);
    const studentId = pickString(req, 'student_id');
    const channelType = pickString(req, 'channel_type');
    const fromStudent = pickBool(req, 'is_from_student');
    const mentionedMentor = pickBool(req, 'mentioned_mentor');
    const from = pickDate(req, 'from');
    const to = pickDate(req, 'to');

    const q = db('slack_messages');
    if (studentId) q.where({ student_id: studentId });
    if (channelType) q.where({ channel_type: channelType });
    if (fromStudent !== undefined) q.where({ is_from_student: fromStudent });
    if (mentionedMentor !== undefined) q.where({ mentioned_mentor: mentionedMentor });
    if (from) q.where('sent_at', '>=', from);
    if (to) q.where('sent_at', '<', to);

    const total = await countTotal(q);
    const items = await q.orderBy('sent_at', 'asc').limit(limit).offset(offset);

    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /slack-messages/{id}:
 *   get:
 *     summary: Get a single slack message
 *     tags: [slack-messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Message
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SlackMessage' }
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
    const row = await db('slack_messages').where({ id }).first();
    if (!row) throw new NotFoundError('slack_message', req.params.id);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db';
import {
  parseListQuery,
  NotFoundError,
  pickString,
  pickInt,
  pickBool,
  pickDate,
  countTotal,
} from '../lib/pagination';

const router = Router();

/**
 * @openapi
 * /students:
 *   get:
 *     summary: List students with filters
 *     tags: [students]
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, paused, dropped, completed] }
 *       - in: query
 *         name: course_id
 *         schema: { type: string }
 *       - in: query
 *         name: mentor_id
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         description: Substring match on name or email (case-insensitive).
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/Student' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = parseListQuery(req);
    const status = pickString(req, 'status');
    const courseId = pickString(req, 'course_id');
    const mentorId = pickString(req, 'mentor_id');
    const search = pickString(req, 'q');

    const q = db('students');
    if (status) q.where({ status });
    if (courseId) q.where({ course_id: courseId });
    if (mentorId) q.where({ mentor_id: mentorId });
    if (search) {
      q.where((b) => {
        b.whereILike('name', `%${search}%`).orWhereILike('email', `%${search}%`);
      });
    }

    const total = await countTotal(q);
    const items = await q.orderBy('name', 'asc').limit(limit).offset(offset);

    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /students/{id}:
 *   get:
 *     summary: Student detail with aggregates
 *     description: Returns the student row plus rollup counts (homework, slack, login_events).
 *     tags: [students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Student detail with rollups
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Student'
 *                 - type: object
 *                   properties:
 *                     rollups:
 *                       type: object
 *                       properties:
 *                         homework_total: { type: integer }
 *                         homework_graded: { type: integer }
 *                         homework_missed: { type: integer }
 *                         homework_avg_grade: { type: number, nullable: true }
 *                         slack_messages_total: { type: integer }
 *                         login_events_total: { type: integer }
 *                         total_clicks: { type: integer }
 *                         last_login_on: { type: string, format: date, nullable: true }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    const student = await db('students').where({ id: req.params.id }).first();
    if (!student) throw new NotFoundError('student', req.params.id);

    const hwRow = await db('homework')
      .where({ student_id: req.params.id })
      .select(
        db.raw('count(*)::int as total'),
        db.raw(`count(*) filter (where status = 'graded')::int as graded`),
        db.raw(`count(*) filter (where status = 'missed')::int as missed`),
        db.raw(`avg(grade) filter (where status = 'graded') as avg_grade`)
      )
      .first<{ total: number; graded: number; missed: number; avg_grade: string | null }>();

    const slackRow = await db('slack_messages')
      .where({ student_id: req.params.id })
      .count<{ count: string }[]>('* as count')
      .first();

    const loginRow = await db('login_events')
      .where({ student_id: req.params.id })
      .select(
        db.raw('count(*)::int as total'),
        db.raw('coalesce(sum(sum_clicks),0)::int as total_clicks'),
        db.raw('max(occurred_on) as last_login_on')
      )
      .first<{ total: number; total_clicks: number; last_login_on: string | null }>();

    res.json({
      ...student,
      rollups: {
        homework_total: hwRow?.total ?? 0,
        homework_graded: hwRow?.graded ?? 0,
        homework_missed: hwRow?.missed ?? 0,
        homework_avg_grade:
          hwRow?.avg_grade != null ? Math.round(parseFloat(hwRow.avg_grade) * 10) / 10 : null,
        slack_messages_total: Number(slackRow?.count ?? 0),
        login_events_total: loginRow?.total ?? 0,
        total_clicks: loginRow?.total_clicks ?? 0,
        last_login_on: loginRow?.last_login_on ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /students/{id}/homework:
 *   get:
 *     summary: Homework timeline for a single student
 *     tags: [students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [missed, late, submitted, graded] }
 *       - in: query
 *         name: from
 *         description: Deadline lower bound (inclusive, YYYY-MM-DD).
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         description: Deadline upper bound (exclusive, YYYY-MM-DD).
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Homework rows ordered by deadline
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Homework' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id/homework', async (req, res, next) => {
  try {
    const exists = await db('students').where({ id: req.params.id }).first('id');
    if (!exists) throw new NotFoundError('student', req.params.id);

    const status = pickString(req, 'status');
    const from = pickDate(req, 'from');
    const to = pickDate(req, 'to');
    const q = db('homework').where({ student_id: req.params.id });
    if (status) q.where({ status });
    if (from) q.where('deadline', '>=', from);
    if (to) q.where('deadline', '<', to);
    const rows = await q.orderBy('deadline', 'asc');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /students/{id}/slack-messages:
 *   get:
 *     summary: Slack message history for a student
 *     tags: [students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - in: query
 *         name: channel_type
 *         schema: { type: string, enum: [mentor_dm, group_chat, support_chat] }
 *       - in: query
 *         name: is_from_student
 *         schema: { type: boolean }
 *       - in: query
 *         name: from
 *         description: ISO timestamp lower bound (inclusive).
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         description: ISO timestamp upper bound (exclusive).
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Messages ordered by sent_at
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/SlackMessage' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id/slack-messages', async (req, res, next) => {
  try {
    const exists = await db('students').where({ id: req.params.id }).first('id');
    if (!exists) throw new NotFoundError('student', req.params.id);

    const { limit, offset } = parseListQuery(req);
    const channelType = pickString(req, 'channel_type');
    const fromStudent = pickBool(req, 'is_from_student');
    const from = pickDate(req, 'from');
    const to = pickDate(req, 'to');

    const q = db('slack_messages').where({ student_id: req.params.id });
    if (channelType) q.where({ channel_type: channelType });
    if (fromStudent !== undefined) q.where({ is_from_student: fromStudent });
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
 * /students/{id}/login-events:
 *   get:
 *     summary: Per-day VLE click stream for a student
 *     tags: [students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *       - in: query
 *         name: id_site
 *         schema: { type: integer }
 *       - in: query
 *         name: from
 *         description: Date lower bound (inclusive).
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         description: Date upper bound (exclusive).
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Login events ordered by occurred_on
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/LoginEvent' } }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id/login-events', async (req, res, next) => {
  try {
    const exists = await db('students').where({ id: req.params.id }).first('id');
    if (!exists) throw new NotFoundError('student', req.params.id);

    const { limit, offset } = parseListQuery(req);
    const idSite = pickInt(req, 'id_site');
    const from = pickDate(req, 'from');
    const to = pickDate(req, 'to');

    const q = db('login_events').where({ student_id: req.params.id });
    if (idSite !== undefined) q.where({ id_site: idSite });
    if (from) q.where('occurred_on', '>=', from);
    if (to) q.where('occurred_on', '<', to);

    const total = await countTotal(q);
    const items = await q
      .orderBy('occurred_on', 'asc')
      .orderBy('id_site', 'asc')
      .limit(limit)
      .offset(offset);

    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

export default router;

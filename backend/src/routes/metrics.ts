import { Router } from 'express';
import { db } from '../db';
import { NotFoundError, BadRequestError, pickString, pickInt, pickDate } from '../lib/pagination';

const router = Router();

/**
 * Parse the engagement classification params shared by both list + detail
 * engagement endpoints. Defaults match Dmytro's spec (14/60 day thresholds).
 * `as_of` defaults to CURRENT_DATE — pass an explicit date to anchor the
 * formula at a fixed point in the seeded simulation timeline.
 */
function parseEngagementParams(req: import('express').Request): {
  asOf: string;
  activeDays: number;
  pausedDays: number;
} {
  const asOf = pickDate(req, 'as_of') ?? new Date().toISOString().slice(0, 10);
  const activeDays = pickInt(req, 'active_days') ?? 14;
  const pausedDays = pickInt(req, 'paused_days') ?? 60;
  if (activeDays < 1) throw new BadRequestError('active_days must be >= 1');
  if (pausedDays <= activeDays) throw new BadRequestError('paused_days must be > active_days');
  return { asOf, activeDays, pausedDays };
}

/**
 * Compute engagement classification SQL inline. Filters login_events to rows
 * occurring on or before `as_of` so days_since_login is always non-negative
 * (i.e. "as of this date, what's the last login we know about?"). Students
 * with no qualifying login events get NULL last_login_on + 'inactive' status.
 */
function engagementQuery(asOf: string, activeDays: number, pausedDays: number) {
  return db('students as s')
    .leftJoin(
      db('login_events')
        .select('student_id')
        .max('occurred_on as last_login_on')
        .where('occurred_on', '<=', asOf)
        .groupBy('student_id')
        .as('le'),
      's.id',
      'le.student_id'
    )
    .select(
      's.id as student_id',
      's.name',
      's.status as student_status',
      'le.last_login_on',
      db.raw(
        `CASE WHEN le.last_login_on IS NULL THEN NULL
              ELSE (?::date - le.last_login_on)::int
         END AS days_since_login`,
        [asOf]
      ),
      db.raw(
        `CASE
           WHEN le.last_login_on IS NULL THEN 'inactive'
           WHEN (?::date - le.last_login_on) <= ? THEN 'active'
           WHEN (?::date - le.last_login_on) <= ? THEN 'paused'
           ELSE 'inactive'
         END AS engagement_status`,
        [asOf, activeDays, asOf, pausedDays]
      )
    );
}

/**
 * Joined query used by both list and detail endpoints. Joins students against
 * the 4 metric views by student_id. Returns one row per student.
 */
function metricsQuery() {
  return db('students as s')
    .leftJoin('student_missed_homework_count as m', 's.id', 'm.student_id')
    .leftJoin('student_late_homework_count as l', 's.id', 'l.student_id')
    .leftJoin('student_avg_grade as g', 's.id', 'g.student_id')
    .leftJoin('student_submission_timing_shift as t', 's.id', 't.student_id')
    .leftJoin('student_last_message_stats as lm', 's.id', 'lm.student_id')
    .leftJoin('student_wrote_to_mentor as wm', 's.id', 'wm.student_id')
    .select(
      's.id as student_id',
      's.name',
      's.status as student_status',
      's.course_id',
      's.mentor_id',
      db.raw('coalesce(m.missed_homework_count, 0)::int as missed_homework_count'),
      db.raw('coalesce(l.late_homework_count, 0)::int as late_homework_count'),
      'g.avg_grade',
      't.early_avg_delay',
      't.late_avg_delay',
      't.submission_timing_shift',
      'lm.last_message_date',
      'lm.last_message_days_ago',
      'wm.wrote_to_mentor'
    );
}

/**
 * @openapi
 * components:
 *   schemas:
 *     StudentMetrics:
 *       type: object
 *       properties:
 *         student_id: { type: string }
 *         name: { type: string }
 *         student_status: { type: string, enum: [active, paused, dropped, completed] }
 *         course_id: { type: string }
 *         mentor_id: { type: string }
 *         missed_homework_count: { type: integer, description: "homework rows with status='missed'" }
 *         late_homework_count: { type: integer, description: "submitted_at > deadline" }
 *         avg_grade: { type: number, nullable: true, description: "AVG over graded homework grades" }
 *         early_avg_delay: { type: number, nullable: true, description: "Avg delay (days) over first half of submissions" }
 *         late_avg_delay: { type: number, nullable: true, description: "Avg delay (days) over second half of submissions" }
 *         submission_timing_shift: { type: number, nullable: true, description: "late_avg_delay - early_avg_delay; positive = student is sliding into lateness" }
 *         last_message_date: { type: string, format: date-time, nullable: true, description: "MAX(sent_at) over slack messages where is_from_student=true" }
 *         last_message_days_ago: { type: integer, nullable: true, description: "Days between today and last_message_date; NULL if student never wrote" }
 *         wrote_to_mentor: { type: boolean, description: "Did the student ever send a message with mentioned_mentor=true" }
 *       required: [student_id, name, missed_homework_count, late_homework_count, wrote_to_mentor]
 */

/**
 * @openapi
 * /metrics:
 *   get:
 *     summary: Per-student metrics (joined from 4 VIEWs)
 *     description: |
 *       Returns the 4 key calculations from the `student_*` VIEWs joined by
 *       student_id. Backed by `student_missed_homework_count`,
 *       `student_late_homework_count`, `student_avg_grade`, and
 *       `student_submission_timing_shift`.
 *     tags: [metrics]
 *     responses:
 *       200:
 *         description: One row per student
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/StudentMetrics' }
 */
router.get('/', async (_req, res, next) => {
  try {
    const rows = await metricsQuery().orderBy('s.name', 'asc');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     StudentEngagement:
 *       type: object
 *       properties:
 *         student_id: { type: string }
 *         name: { type: string }
 *         student_status: { type: string, enum: [active, paused, dropped, completed], description: "Admin/outcome status from students table; independent of engagement_status" }
 *         last_login_on: { type: string, format: date, nullable: true, description: "MAX(occurred_on) over login_events filtered to <= as_of" }
 *         days_since_login: { type: integer, nullable: true, description: "as_of - last_login_on in whole days; NULL if no logins" }
 *         engagement_status: { type: string, enum: [active, paused, inactive], description: "Per Dmytro's rule: days <= active_days -> active; <= paused_days -> paused; otherwise inactive (incl. no logins)" }
 *       required: [student_id, name, engagement_status]
 *
 * /metrics/engagement:
 *   get:
 *     summary: Per-student engagement classification (formula-based, dynamic)
 *     description: |
 *       Computes `engagement_status` per student from `login_events` using a
 *       threshold formula:
 *
 *       - `days_since_login <= active_days` → `active`
 *       - `days_since_login <= paused_days` → `paused`
 *       - otherwise (incl. no logins on or before `as_of`) → `inactive`
 *
 *       Useful for anchoring the rule at a specific simulation date (the
 *       seeded login_events run 2013-09 to 2014-07 — OULAD AAA-2013J window —
 *       so today's `as_of` will mark every student `inactive`; pick a date
 *       like `2014-05-01` to see the classification distribute across
 *       active/paused/inactive).
 *     tags: [metrics]
 *     parameters:
 *       - in: query
 *         name: as_of
 *         description: Reference date (YYYY-MM-DD). Defaults to CURRENT_DATE.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: active_days
 *         description: Upper bound (inclusive) for `active`. Default 14.
 *         schema: { type: integer, minimum: 1, default: 14 }
 *       - in: query
 *         name: paused_days
 *         description: Upper bound (inclusive) for `paused`. Must be > active_days. Default 60.
 *         schema: { type: integer, minimum: 2, default: 60 }
 *       - in: query
 *         name: student_id
 *         description: Optional filter — return only this student.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: One row per student
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/StudentEngagement' }
 *       400:
 *         description: Invalid params
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/engagement', async (req, res, next) => {
  try {
    const { asOf, activeDays, pausedDays } = parseEngagementParams(req);
    const studentId = pickString(req, 'student_id');
    const q = engagementQuery(asOf, activeDays, pausedDays);
    if (studentId) q.where('s.id', studentId);
    const rows = await q.orderByRaw('days_since_login NULLS LAST').orderBy('s.id', 'asc');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /metrics/engagement/{student_id}:
 *   get:
 *     summary: Engagement classification for one student
 *     tags: [metrics]
 *     parameters:
 *       - in: path
 *         name: student_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: as_of
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: active_days
 *         schema: { type: integer, minimum: 1, default: 14 }
 *       - in: query
 *         name: paused_days
 *         schema: { type: integer, minimum: 2, default: 60 }
 *     responses:
 *       200:
 *         description: Engagement row
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/StudentEngagement' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/engagement/:student_id', async (req, res, next) => {
  try {
    const { asOf, activeDays, pausedDays } = parseEngagementParams(req);
    const row = await engagementQuery(asOf, activeDays, pausedDays)
      .where('s.id', req.params.student_id)
      .first();
    if (!row) throw new NotFoundError('student', req.params.student_id);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /metrics/{student_id}:
 *   get:
 *     summary: Metrics for one student
 *     tags: [metrics]
 *     parameters:
 *       - in: path
 *         name: student_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Metrics row
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/StudentMetrics' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:student_id', async (req, res, next) => {
  try {
    const row = await metricsQuery().where('s.id', req.params.student_id).first();
    if (!row) throw new NotFoundError('student', req.params.student_id);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db';
import { NotFoundError } from '../lib/pagination';

const router = Router();

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

import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '../db';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a jsonb column that node-postgres may return as JS array or raw JSON
 *  string, or null.  Always returns string[]. */
function parseJsonbArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Parse a jsonb column that is an array of objects [{text: string}] or plain strings.
 *  node-postgres may already parse the jsonb column to a JS value.
 *  Plain string elements are wrapped as {text: element}. */
function parseJsonbObjectArray(value: unknown): Array<{ text: string }> {
  if (value == null) return [];
  let arr: unknown[];
  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else {
    return [];
  }
  return arr.map((item) => {
    if (item !== null && typeof item === 'object' && 'text' in (item as object)) {
      return item as { text: string };
    }
    return { text: String(item) };
  });
}

/** Safe integer — returns null when value is null/undefined/NaN */
function toIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Parse ?asOf query param. Returns YYYY-MM-DD string.
 *  Falls back to '2025-08-21' if missing or not matching /^\d{4}-\d{2}-\d{2}$/. */
function parseAsOf(query: Record<string, unknown>): string {
  const raw = query['asOf'];
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return '2025-08-21';
}

/** Parse optional ?runId query param. Returns positive int or null. */
function parseRunId(query: Record<string, unknown>): number | null {
  const raw = query['runId'];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** Clamp a query-param value to an integer within [lo, hi]; return def when absent/invalid. */
const toClampedInt = (v: unknown, lo: number, hi: number, def: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

// ---------------------------------------------------------------------------
// finalizeRunsIfComplete — idempotent, never throws (wrapped in try/catch)
// ---------------------------------------------------------------------------
async function finalizeRunsIfComplete(): Promise<void> {
  try {
    // Find the latest running run
    const latestRunning = await db('analysis_run')
      .where('status', 'running')
      .orderBy('triggered_at', 'desc')
      .first();

    if (!latestRunning) return;

    const runId: number = latestRunning.id;
    const triggeredAt: Date = latestRunning.triggered_at;

    // Check staleness first — if triggered more than the stale threshold ago and still running, mark failed
    const nowMs = Date.now();
    const triggeredMs = new Date(triggeredAt).getTime();
    // Runs are ~1-2 min now (n8n throttle lowered); a run still 'running'
    // well past that is dead, not slow — fail it fast so the UI can react.
    const STALE_RUN_MS = 5 * 60 * 1000;

    // Count students and done results in parallel
    const [totalRow, doneRow] = await Promise.all([
      db('students').count('* as c').first(),
      db('analysis_results')
        .count('* as done')
        .min('analyzed_at as fresh_min')
        .first(),
    ]);

    const total = Number((totalRow as any)?.c ?? 0);
    const done = Number((doneRow as any)?.done ?? 0);
    const freshMin: Date | null = (doneRow as any)?.fresh_min ?? null;

    // COMPLETE iff done > 0 AND done >= total AND freshMin >= triggeredAt
    const isComplete =
      done > 0 &&
      done >= total &&
      freshMin !== null &&
      new Date(freshMin).getTime() >= new Date(triggeredAt).getTime();

    if (isComplete) {
      // a) snapshot analysis_results into analysis_run_result
      await db.raw(`
        INSERT INTO analysis_run_result
          (run_id, student_id, risk_score, risk_level, urgency,
           recommended_action, secondary_action, priority, student_state,
           primary_drivers, supporting_evidence, draft_message, mentor_summary,
           dashboard_label, run_analyzed_at)
        SELECT
          :runId, student_id, risk_score, risk_level, urgency,
          recommended_action, secondary_action, priority, student_state,
          primary_drivers, supporting_evidence, draft_message, mentor_summary,
          dashboard_label, analyzed_at
        FROM analysis_results
        ON CONFLICT (run_id, student_id) DO NOTHING
      `, { runId });

      // b) Compute counts from analysis_run_result for this run
      const countsRow = await db('analysis_run_result')
        .where('run_id', runId)
        .select(
          db.raw('count(*)::int as total_count'),
          db.raw(`count(*) FILTER (WHERE risk_level = 'high')::int as high_count`),
          db.raw(`count(*) FILTER (WHERE risk_level = 'medium')::int as medium_count`),
          db.raw(`count(*) FILTER (WHERE risk_level = 'low')::int as low_count`),
        )
        .first();

      const tCount = Number((countsRow as any)?.total_count ?? 0);
      const hCount = Number((countsRow as any)?.high_count ?? 0);
      const mCount = Number((countsRow as any)?.medium_count ?? 0);
      const lCount = Number((countsRow as any)?.low_count ?? 0);

      // Single-winner: only update if still 'running'
      await db('analysis_run')
        .where('id', runId)
        .where('status', 'running')
        .update({
          status: 'complete',
          finalized_at: db.raw('now()'),
          updated_at: db.raw('now()'),
          total_count: tCount,
          high_count: hCount,
          medium_count: mCount,
          low_count: lCount,
        });
    } else if (nowMs - triggeredMs > STALE_RUN_MS) {
      // Staleness: mark failed
      await db('analysis_run')
        .where('id', runId)
        .where('status', 'running')
        .update({
          status: 'failed',
          finalized_at: db.raw('now()'),
          updated_at: db.raw('now()'),
        });
    }
  } catch {
    // Never propagate — this is a best-effort helper
  }
}

// ---------------------------------------------------------------------------
// GET /analysis/overview
// ---------------------------------------------------------------------------
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Finalize any running run first (best-effort)
    await finalizeRunsIfComplete();

    const runIdParam = parseRunId(req.query as Record<string, unknown>);

    // Tunable constants — shared by both branches (defaults reproduce the old hardcoded literals)
    const q = req.query as Record<string, unknown>;
    const activeWindowDays = toClampedInt(q.aw, 1, 365, 14);
    const inactiveDays     = toClampedInt(q.ia, 1, 365, 60);
    const examPassMark     = toClampedInt(q.ep, 0, 100, 40);

    // Try to resolve a complete run when runId is given
    let completeRun: Record<string, unknown> | null = null;
    if (runIdParam !== null) {
      const row = await db('analysis_run')
        .where('id', runIdParam)
        .select('*', db.raw(`to_char(as_of_date, 'YYYY-MM-DD') as as_of_date`))
        .first();
      if (row && row.status === 'complete') {
        completeRun = row as Record<string, unknown>;
      }
    }

    // -----------------------------------------------------------------------
    // BRANCH A: runId present and complete — historical snapshot
    // -----------------------------------------------------------------------
    if (completeRun !== null) {
      const runId = runIdParam as number;
      const effectiveAsOf: string =
        typeof completeRun['as_of_date'] === 'string' && completeRun['as_of_date']
          ? (completeRun['as_of_date'] as string).slice(0, 10)
          : '2025-08-21';

      // Find previous complete run (next-lower triggered_at, status='complete')
      const prevRunRow = await db('analysis_run')
        .where('status', 'complete')
        .where('triggered_at', '<', completeRun['triggered_at'] as Date)
        .orderBy('triggered_at', 'desc')
        .first();

      const [
        courseRow,
        hwAgg,
        activeStudentsAgg,
        droppedAgg,
        riskStudentsRaw,
        courseWindowRow,
        moduleDeadlinesRaw,
        runResultScanRow,
        deadlinesRaw,
        examAgg,
      ] = await Promise.all([
        db('courses').select('id', 'name', 'total_modules', 'duration_weeks', 'format').first(),

        // Homework aggregates — as-of effectiveAsOf
        db.raw<{ rows: Array<{
          hw_submitted: string;
          hw_missed_total: string;
          hw_not_submitted: string;
          hw_due: string;
        }> }>(`
          SELECT
            count(*) FILTER (
              WHERE submitted_at IS NOT NULL
                AND submitted_at::date <= ?::date
            )::int AS hw_submitted,
            count(*) FILTER (
              WHERE deadline <= ?::date
                AND (submitted_at IS NULL OR submitted_at::date > ?::date)
            )::int AS hw_missed_total,
            count(*) FILTER (
              WHERE deadline <= ?::date
                AND (submitted_at IS NULL OR submitted_at::date > ?::date)
            )::int AS hw_not_submitted,
            count(*) FILTER (
              WHERE deadline <= ?::date
            )::int AS hw_due
          FROM homework
        `, [effectiveAsOf, effectiveAsOf, effectiveAsOf, effectiveAsOf, effectiveAsOf, effectiveAsOf]),

        // activeStudents: distinct student_ids with login in activeWindowDays days up to effectiveAsOf
        db.raw<{ rows: Array<{ active_count: string; total_count: string }> }>(`
          SELECT
            count(DISTINCT le.student_id)::int AS active_count,
            (SELECT count(*)::int FROM students) AS total_count
          FROM login_events le
          WHERE le.occurred_on > (?::date - ?::int)
            AND le.occurred_on <= ?::date
        `, [effectiveAsOf, activeWindowDays, effectiveAsOf]),

        // dropped: students with NO login in inactiveDays days up to effectiveAsOf
        db.raw<{ rows: Array<{ dropped_count: string }> }>(`
          SELECT (
            (SELECT count(*) FROM students)
            - count(DISTINCT le.student_id)
          )::int AS dropped_count
          FROM login_events le
          WHERE le.occurred_on > (?::date - ?::int)
            AND le.occurred_on <= ?::date
        `, [effectiveAsOf, inactiveDays, effectiveAsOf]),

        // Risk students from analysis_run_result for this run, joined with students
        // missedHomework as-of effectiveAsOf
        // prevRiskScore from same student in previous complete run
        db.raw<{ rows: Array<{
          student_id: string;
          name: string;
          email: string;
          risk_score: string | null;
          risk_level: string | null;
          urgency: string | null;
          student_state: string | null;
          dashboard_label: string | null;
          primary_drivers: unknown;
          missed_homework: string;
          prev_risk_score: string | null;
          lost: boolean;
        }> }>(`
          SELECT
            s.id AS student_id,
            s.name,
            s.email,
            arr.risk_score,
            arr.risk_level,
            arr.urgency,
            arr.student_state,
            arr.dashboard_label,
            arr.primary_drivers,
            coalesce(hw.missed_count, 0)::int AS missed_homework,
            prev.prev_risk_score,
            (
              NOT EXISTS (
                SELECT 1 FROM login_events le
                WHERE le.student_id = s.id
                  AND le.occurred_on > (?::date - make_interval(days => ?::int))
                  AND le.occurred_on <= ?::date
              )
              AND (
                lower(arr.urgency) = 'monitor'
                OR lower(arr.student_state) = 'disengaged'
              )
            ) AS lost
          FROM students s
          JOIN analysis_run_result arr ON s.id = arr.student_id AND arr.run_id = ?
          LEFT JOIN (
            SELECT student_id, count(*)::int AS missed_count
            FROM homework
            WHERE deadline <= ?::date
              AND (submitted_at IS NULL OR submitted_at::date > ?::date)
            GROUP BY student_id
          ) hw ON s.id = hw.student_id
          LEFT JOIN (
            SELECT prr.student_id, prr.risk_score AS prev_risk_score
            FROM analysis_run_result prr
            WHERE prr.run_id = ?
          ) prev ON s.id = prev.student_id
          ORDER BY (
            NOT EXISTS (
              SELECT 1 FROM login_events le2
              WHERE le2.student_id = s.id
                AND le2.occurred_on > (?::date - make_interval(days => ?::int))
                AND le2.occurred_on <= ?::date
            )
            AND (
              lower(arr.urgency) = 'monitor'
              OR lower(arr.student_state) = 'disengaged'
            )
          ) ASC, arr.risk_score DESC NULLS LAST
        `, [effectiveAsOf, inactiveDays, effectiveAsOf, runId, effectiveAsOf, effectiveAsOf, prevRunRow?.id ?? null, effectiveAsOf, inactiveDays, effectiveAsOf]),

        // Course teaching window
        db.raw<{ rows: Array<{ start_date: string | null; end_date: string | null }> }>(`
          SELECT
            to_char(
              COALESCE(
                (SELECT min(deadline) FROM homework),
                (SELECT min(occurred_on) FROM login_events)
              ),
              'YYYY-MM-DD'
            ) AS start_date,
            to_char(
              COALESCE(
                (SELECT max(deadline) FROM homework),
                (SELECT max(occurred_on) FROM login_events)
              ),
              'YYYY-MM-DD'
            ) AS end_date
        `),

        // Module milestones
        db.raw<{ rows: Array<{ module: number; date: string | null }> }>(`
          SELECT module, to_char(max(deadline), 'YYYY-MM-DD') AS date
          FROM homework
          GROUP BY module
          ORDER BY module
        `),

        // Scan info from run_result
        db('analysis_run_result')
          .where('run_id', runId)
          .max('run_analyzed_at as last_analyzed_at')
          .first(),

        // Distinct assessment deadlines (course structure — NOT filtered by asOf)
        db.raw<{ rows: Array<{
          hw_id: string;
          title: string | null;
          topic: string | null;
          module: number | null;
          date: string | null;
        }> }>(`
          SELECT DISTINCT hw_id, title, topic, module,
            to_char(deadline, 'YYYY-MM-DD') AS date
          FROM homework
          WHERE deadline IS NOT NULL
          ORDER BY date, hw_id
        `),

        // Exam homework aggregates — as-of effectiveAsOf
        db.raw<{ rows: Array<{
          deadline: string | null;
          submitted: string;
          graded: string;
        }> }>(`
          SELECT
            to_char(max(deadline), 'YYYY-MM-DD') AS deadline,
            count(DISTINCT student_id) FILTER (
              WHERE submitted_at IS NOT NULL
                AND submitted_at::date <= ?::date
            )::int AS submitted,
            count(DISTINCT student_id) FILTER (
              WHERE grade IS NOT NULL
                AND grade >= ?::int
                AND submitted_at IS NOT NULL
                AND submitted_at::date <= ?::date
            )::int AS graded
          FROM homework
          WHERE topic = 'Final Exam' OR title ILIKE 'Exam%'
        `, [effectiveAsOf, examPassMark, effectiveAsOf]),
      ]);

      const totalStudents = Number(activeStudentsAgg.rows[0]?.total_count ?? 0);
      const activeCount = Number(activeStudentsAgg.rows[0]?.active_count ?? 0);
      const droppedCount = Number(droppedAgg.rows[0]?.dropped_count ?? 0);

      const hwDue = Number(hwAgg.rows[0]?.hw_due ?? 0);
      const hwSubmitted = Number(hwAgg.rows[0]?.hw_submitted ?? 0);
      const hwMissedTotal = Number(hwAgg.rows[0]?.hw_missed_total ?? 0);
      const hwNotSubmitted = Number(hwAgg.rows[0]?.hw_not_submitted ?? 0);

      const examDeadlineA: string | null = examAgg.rows[0]?.deadline ?? null;
      const examDueA: boolean = examDeadlineA !== null && examDeadlineA <= effectiveAsOf;
      const examSubmittedA = Number(examAgg.rows[0]?.submitted ?? 0);
      const examGradedA = Number(examAgg.rows[0]?.graded ?? 0);

      const runTotalCount = Number(completeRun['total_count'] ?? 0);
      const runHighCount = Number(completeRun['high_count'] ?? 0);
      const runMediumCount = Number(completeRun['medium_count'] ?? 0);
      const runLowCount = Number(completeRun['low_count'] ?? 0);

      const atRiskValue = runHighCount + runMediumCount;
      const atRiskPct =
        runTotalCount > 0 ? Math.round((100 * atRiskValue) / runTotalCount) : null;

      let atRiskDelta: number | null = null;
      if (prevRunRow) {
        const prevAtRisk =
          Number(prevRunRow.high_count ?? 0) + Number(prevRunRow.medium_count ?? 0);
        atRiskDelta = atRiskValue - prevAtRisk;
      }

      const riskStudents = riskStudentsRaw.rows.map((row) => {
        const riskScore = row.risk_score !== null && row.risk_score !== undefined
          ? Number(row.risk_score)
          : null;
        const prevRiskScore = row.prev_risk_score !== null && row.prev_risk_score !== undefined
          ? Number(row.prev_risk_score)
          : null;
        const riskDelta =
          riskScore !== null && prevRiskScore !== null ? riskScore - prevRiskScore : null;
        return {
          studentId: row.student_id,
          name: row.name,
          email: row.email,
          riskScore,
          riskLevel: row.risk_level,
          urgency: row.urgency,
          studentState: row.student_state,
          dashboardLabel: row.dashboard_label,
          primaryDrivers: parseJsonbArray(row.primary_drivers),
          prevRiskScore,
          riskDelta,
          missedHomework: Number(row.missed_homework ?? 0),
          lost: row.lost === true,
        };
      });

      const startDate: string | null = courseWindowRow.rows[0]?.start_date ?? null;
      const endDate: string | null = courseWindowRow.rows[0]?.end_date ?? null;

      const milestones: Array<{ label: string; date: string }> = [];
      if (startDate !== null) {
        milestones.push({ label: 'Старт курсу', date: startDate });
      }
      for (const row of moduleDeadlinesRaw.rows) {
        if (row.date !== null && row.date !== undefined) {
          milestones.push({ label: `Модуль ${row.module}`, date: row.date });
        }
      }
      if (endDate !== null) {
        milestones.push({ label: 'Завершення', date: endDate });
      }

      const deadlines = deadlinesRaw.rows.map((row) => ({
        hwId: row.hw_id,
        title: row.title ?? null,
        topic: row.topic ?? null,
        module: row.module ?? null,
        date: row.date ?? null,
        isExam: row.topic === 'Final Exam' || (typeof row.title === 'string' && /^exam/i.test(row.title)),
      }));

      const triggeredAtVal = completeRun['triggered_at'];
      const finalizedAtVal = completeRun['finalized_at'];

      return res.json({
        course: courseRow
          ? {
              id: courseRow.id,
              name: courseRow.name,
              totalModules: courseRow.total_modules,
              durationWeeks: courseRow.duration_weeks,
              format: courseRow.format,
              startDate,
              endDate,
              milestones,
              deadlines,
            }
          : null,
        scan: {
          lastAnalyzedAt: (runResultScanRow as any)?.last_analyzed_at ?? null,
          analyzedCount: runTotalCount,
          totalStudents,
          hasPrevious: prevRunRow != null,
          previousSnapshotAt: prevRunRow?.triggered_at ?? null,
        },
        stats: {
          activeStudents: {
            value: activeCount,
            total: totalStudents,
          },
          dropped: {
            value: droppedCount,
          },
          hwSubmitted: {
            value: hwSubmitted,
            pct: hwDue > 0 ? Math.round((100 * hwSubmitted) / hwDue) : null,
          },
          hwMissedTotal: {
            value: hwMissedTotal,
          },
          hwNotSubmitted: {
            value: hwNotSubmitted,
            pct: hwDue > 0 ? Math.round((100 * hwNotSubmitted) / hwDue) : null,
          },
          atRisk: {
            value: atRiskValue,
            pct: atRiskPct,
            deltaVsPrev: atRiskDelta,
          },
          exam: {
            deadline: examDeadlineA,
            due: examDueA,
            submitted: examSubmittedA,
            graded: examGradedA,
            total: activeCount,
          },
        },
        riskStudents,
        selectedRun: {
          id: runId,
          asOfDate: effectiveAsOf,
          triggeredAt: triggeredAtVal,
          finalizedAt: finalizedAtVal,
          status: 'complete',
          totalCount: runTotalCount,
          highCount: runHighCount,
          mediumCount: runMediumCount,
          lowCount: runLowCount,
        },
      });
    }

    // -----------------------------------------------------------------------
    // BRANCH B: no runId (or run not complete) — live behavior bounded by asOf
    // -----------------------------------------------------------------------
    const asOf = parseAsOf(req.query as Record<string, unknown>);

    // Resolve the live run: most recent complete run with as_of_date <= asOf
    const liveRunRow = await db.raw<{ rows: Array<{
      id: number;
      as_of_date: string;
      triggered_at: Date;
      finalized_at: Date | null;
      status: string;
      total_count: number | null;
      high_count: number | null;
      medium_count: number | null;
      low_count: number | null;
    }> }>(`
      SELECT id,
        to_char(as_of_date, 'YYYY-MM-DD') AS as_of_date,
        triggered_at, finalized_at, status,
        total_count, high_count, medium_count, low_count
      FROM analysis_run
      WHERE status = 'complete'
        AND as_of_date <= ?::date
      ORDER BY as_of_date DESC, triggered_at DESC
      LIMIT 1
    `, [asOf]);
    const liveRun = liveRunRow.rows[0] ?? null;

    // Find the previous complete run before liveRun (for atRiskDelta + prevRiskScore)
    let prevLiveRunRow: Record<string, unknown> | null = null;
    if (liveRun !== null) {
      prevLiveRunRow = await db('analysis_run')
        .where('status', 'complete')
        .where('triggered_at', '<', liveRun.triggered_at)
        .orderBy('triggered_at', 'desc')
        .first() ?? null;
    }

    // Run deterministic aggregates in parallel (always as-of asOf regardless of liveRun)
    const [courseRow, hwAgg, activeStudentsAgg, droppedAgg, courseWindowRow, moduleDeadlinesRaw, deadlinesRaw, totalStudentsRow, examAggB] =
      await Promise.all([
        // Single course row
        db('courses').select('id', 'name', 'total_modules', 'duration_weeks', 'format').first(),

        // Homework aggregates — as-of cutoff applied
        db.raw<{ rows: Array<{
          hw_submitted: string;
          hw_missed_total: string;
          hw_not_submitted: string;
          hw_due: string;
        }> }>(`
          SELECT
            count(*) FILTER (
              WHERE submitted_at IS NOT NULL
                AND submitted_at::date <= ?::date
            )::int AS hw_submitted,
            count(*) FILTER (
              WHERE deadline <= ?::date
                AND (submitted_at IS NULL OR submitted_at::date > ?::date)
            )::int AS hw_missed_total,
            count(*) FILTER (
              WHERE deadline <= ?::date
                AND (submitted_at IS NULL OR submitted_at::date > ?::date)
            )::int AS hw_not_submitted,
            count(*) FILTER (
              WHERE deadline <= ?::date
            )::int AS hw_due
          FROM homework
        `, [asOf, asOf, asOf, asOf, asOf, asOf]),

        // activeStudents: distinct student_ids with a login in activeWindowDays days up to asOf
        db.raw<{ rows: Array<{ active_count: string; total_count: string }> }>(`
          SELECT
            count(DISTINCT le.student_id)::int AS active_count,
            (SELECT count(*)::int FROM students) AS total_count
          FROM login_events le
          WHERE le.occurred_on > (?::date - ?::int)
            AND le.occurred_on <= ?::date
        `, [asOf, activeWindowDays, asOf]),

        // dropped: students with NO login in inactiveDays days up to asOf
        db.raw<{ rows: Array<{ dropped_count: string }> }>(`
          SELECT (
            (SELECT count(*) FROM students)
            - count(DISTINCT le.student_id)
          )::int AS dropped_count
          FROM login_events le
          WHERE le.occurred_on > (?::date - ?::int)
            AND le.occurred_on <= ?::date
        `, [asOf, inactiveDays, asOf]),

        // Course teaching window: earliest/latest deadline (fallback to login_events)
        db.raw<{ rows: Array<{ start_date: string | null; end_date: string | null }> }>(`
          SELECT
            to_char(
              COALESCE(
                (SELECT min(deadline) FROM homework),
                (SELECT min(occurred_on) FROM login_events)
              ),
              'YYYY-MM-DD'
            ) AS start_date,
            to_char(
              COALESCE(
                (SELECT max(deadline) FROM homework),
                (SELECT max(occurred_on) FROM login_events)
              ),
              'YYYY-MM-DD'
            ) AS end_date
        `),

        // Module milestones: max deadline per module — NOT filtered by asOf (course structure)
        db.raw<{ rows: Array<{ module: number; date: string | null }> }>(`
          SELECT module, to_char(max(deadline), 'YYYY-MM-DD') AS date
          FROM homework
          GROUP BY module
          ORDER BY module
        `),

        // Distinct assessment deadlines (course structure — NOT filtered by asOf)
        db.raw<{ rows: Array<{
          hw_id: string;
          title: string | null;
          topic: string | null;
          module: number | null;
          date: string | null;
        }> }>(`
          SELECT DISTINCT hw_id, title, topic, module,
            to_char(deadline, 'YYYY-MM-DD') AS date
          FROM homework
          WHERE deadline IS NOT NULL
          ORDER BY date, hw_id
        `),

        db('students').count('* as c').first(),

        // Exam homework aggregates — as-of asOf
        db.raw<{ rows: Array<{
          deadline: string | null;
          submitted: string;
          graded: string;
        }> }>(`
          SELECT
            to_char(max(deadline), 'YYYY-MM-DD') AS deadline,
            count(DISTINCT student_id) FILTER (
              WHERE submitted_at IS NOT NULL
                AND submitted_at::date <= ?::date
            )::int AS submitted,
            count(DISTINCT student_id) FILTER (
              WHERE grade IS NOT NULL
                AND grade >= ?::int
                AND submitted_at IS NOT NULL
                AND submitted_at::date <= ?::date
            )::int AS graded
          FROM homework
          WHERE topic = 'Final Exam' OR title ILIKE 'Exam%'
        `, [asOf, examPassMark, asOf]),
      ]);

    const hwDue = Number(hwAgg.rows[0]?.hw_due ?? 0);
    const hwSubmitted = Number(hwAgg.rows[0]?.hw_submitted ?? 0);
    const hwMissedTotal = Number(hwAgg.rows[0]?.hw_missed_total ?? 0);
    const hwNotSubmitted = Number(hwAgg.rows[0]?.hw_not_submitted ?? 0);

    const activeCount = Number(activeStudentsAgg.rows[0]?.active_count ?? 0);
    const totalStudentsFromAgg = Number(activeStudentsAgg.rows[0]?.total_count ?? 0);
    const droppedCount = Number(droppedAgg.rows[0]?.dropped_count ?? 0);
    const totalStudents = Number((totalStudentsRow as any)?.c ?? 0);

    const examDeadlineB: string | null = examAggB.rows[0]?.deadline ?? null;
    const examDueB: boolean = examDeadlineB !== null && examDeadlineB <= asOf;
    const examSubmittedB = Number(examAggB.rows[0]?.submitted ?? 0);
    const examGradedB = Number(examAggB.rows[0]?.graded ?? 0);

    const startDate: string | null = courseWindowRow.rows[0]?.start_date ?? null;
    const endDate: string | null = courseWindowRow.rows[0]?.end_date ?? null;

    const milestones: Array<{ label: string; date: string }> = [];
    if (startDate !== null) {
      milestones.push({ label: 'Старт курсу', date: startDate });
    }
    for (const row of moduleDeadlinesRaw.rows) {
      if (row.date !== null && row.date !== undefined) {
        milestones.push({ label: `Модуль ${row.module}`, date: row.date });
      }
    }
    if (endDate !== null) {
      milestones.push({ label: 'Завершення', date: endDate });
    }

    const deadlines = deadlinesRaw.rows.map((row) => ({
      hwId: row.hw_id,
      title: row.title ?? null,
      topic: row.topic ?? null,
      module: row.module ?? null,
      date: row.date ?? null,
      isExam: row.topic === 'Final Exam' || (typeof row.title === 'string' && /^exam/i.test(row.title)),
    }));

    // -----------------------------------------------------------------------
    // BRANCH B-1: liveRun exists — AI layer from analysis_run_result
    // -----------------------------------------------------------------------
    if (liveRun !== null) {
      const liveRunId = liveRun.id;

      const [riskStudentsRaw, runResultScanRow] = await Promise.all([
        // Risk students from analysis_run_result for liveRun
        // missedHomework as-of asOf (deterministic cutoff = asOf, not liveRun.as_of_date)
        db.raw<{ rows: Array<{
          student_id: string;
          name: string;
          email: string;
          risk_score: string | null;
          risk_level: string | null;
          urgency: string | null;
          student_state: string | null;
          dashboard_label: string | null;
          primary_drivers: unknown;
          missed_homework: string;
          prev_risk_score: string | null;
          lost: boolean;
        }> }>(`
          SELECT
            s.id AS student_id,
            s.name,
            s.email,
            arr.risk_score,
            arr.risk_level,
            arr.urgency,
            arr.student_state,
            arr.dashboard_label,
            arr.primary_drivers,
            coalesce(hw.missed_count, 0)::int AS missed_homework,
            prev.prev_risk_score,
            (
              NOT EXISTS (
                SELECT 1 FROM login_events le
                WHERE le.student_id = s.id
                  AND le.occurred_on > (?::date - make_interval(days => ?::int))
                  AND le.occurred_on <= ?::date
              )
              AND (
                lower(arr.urgency) = 'monitor'
                OR lower(arr.student_state) = 'disengaged'
              )
            ) AS lost
          FROM students s
          JOIN analysis_run_result arr ON s.id = arr.student_id AND arr.run_id = ?
          LEFT JOIN (
            SELECT student_id, count(*)::int AS missed_count
            FROM homework
            WHERE deadline <= ?::date
              AND (submitted_at IS NULL OR submitted_at::date > ?::date)
            GROUP BY student_id
          ) hw ON s.id = hw.student_id
          LEFT JOIN (
            SELECT prr.student_id, prr.risk_score AS prev_risk_score
            FROM analysis_run_result prr
            WHERE prr.run_id = ?
          ) prev ON s.id = prev.student_id
          ORDER BY (
            NOT EXISTS (
              SELECT 1 FROM login_events le2
              WHERE le2.student_id = s.id
                AND le2.occurred_on > (?::date - make_interval(days => ?::int))
                AND le2.occurred_on <= ?::date
            )
            AND (
              lower(arr.urgency) = 'monitor'
              OR lower(arr.student_state) = 'disengaged'
            )
          ) ASC, arr.risk_score DESC NULLS LAST
        `, [asOf, inactiveDays, asOf, liveRunId, asOf, asOf, (prevLiveRunRow?.['id'] as number | null) ?? null, asOf, inactiveDays, asOf]),

        // Scan: max run_analyzed_at from liveRun's results
        db('analysis_run_result')
          .where('run_id', liveRunId)
          .max('run_analyzed_at as last_analyzed_at')
          .first(),
      ]);

      const liveRunTotalCount = Number(liveRun.total_count ?? 0);
      const liveRunHighCount = Number(liveRun.high_count ?? 0);
      const liveRunMediumCount = Number(liveRun.medium_count ?? 0);

      const atRiskValue = liveRunHighCount + liveRunMediumCount;
      const atRiskPct =
        liveRunTotalCount > 0 ? Math.round((100 * atRiskValue) / liveRunTotalCount) : null;

      let atRiskDelta: number | null = null;
      if (prevLiveRunRow !== null) {
        const prevAtRisk =
          Number(prevLiveRunRow['high_count'] ?? 0) + Number(prevLiveRunRow['medium_count'] ?? 0);
        atRiskDelta = atRiskValue - prevAtRisk;
      }

      const hasPrevious = prevLiveRunRow !== null;

      const riskStudents = riskStudentsRaw.rows.map((row) => {
        const riskScore = row.risk_score !== null && row.risk_score !== undefined
          ? Number(row.risk_score)
          : null;
        const prevRiskScore = row.prev_risk_score !== null && row.prev_risk_score !== undefined
          ? Number(row.prev_risk_score)
          : null;
        const riskDelta =
          riskScore !== null && prevRiskScore !== null ? riskScore - prevRiskScore : null;
        return {
          studentId: row.student_id,
          name: row.name,
          email: row.email,
          riskScore,
          riskLevel: row.risk_level,
          urgency: row.urgency,
          studentState: row.student_state,
          dashboardLabel: row.dashboard_label,
          primaryDrivers: parseJsonbArray(row.primary_drivers),
          prevRiskScore,
          riskDelta,
          missedHomework: Number(row.missed_homework ?? 0),
          lost: row.lost === true,
        };
      });

      return res.json({
        course: courseRow
          ? {
              id: courseRow.id,
              name: courseRow.name,
              totalModules: courseRow.total_modules,
              durationWeeks: courseRow.duration_weeks,
              format: courseRow.format,
              startDate,
              endDate,
              milestones,
              deadlines,
            }
          : null,
        scan: {
          lastAnalyzedAt: (runResultScanRow as any)?.last_analyzed_at ?? null,
          analyzedCount: liveRunTotalCount,
          totalStudents,
          hasPrevious,
          previousSnapshotAt: prevLiveRunRow?.['triggered_at'] ?? null,
        },
        stats: {
          activeStudents: {
            value: activeCount,
            total: totalStudentsFromAgg,
          },
          dropped: {
            value: droppedCount,
          },
          hwSubmitted: {
            value: hwSubmitted,
            pct: hwDue > 0 ? Math.round((100 * hwSubmitted) / hwDue) : null,
          },
          hwMissedTotal: {
            value: hwMissedTotal,
          },
          hwNotSubmitted: {
            value: hwNotSubmitted,
            pct: hwDue > 0 ? Math.round((100 * hwNotSubmitted) / hwDue) : null,
          },
          atRisk: {
            value: atRiskValue,
            pct: atRiskPct,
            deltaVsPrev: atRiskDelta,
          },
          exam: {
            deadline: examDeadlineB,
            due: examDueB,
            submitted: examSubmittedB,
            graded: examGradedB,
            total: activeCount,
          },
        },
        riskStudents,
        selectedRun: {
          id: liveRun.id,
          asOfDate: liveRun.as_of_date,
          triggeredAt: liveRun.triggered_at,
          status: 'complete',
          auto: true,
        },
      });
    }

    // -----------------------------------------------------------------------
    // BRANCH B-2: no liveRun exists — no AI data yet for asOf
    // -----------------------------------------------------------------------
    return res.json({
      noAnalysisYet: true,
      course: courseRow
        ? {
            id: courseRow.id,
            name: courseRow.name,
            totalModules: courseRow.total_modules,
            durationWeeks: courseRow.duration_weeks,
            format: courseRow.format,
            startDate,
            endDate,
            milestones,
            deadlines,
          }
        : null,
      scan: {
        lastAnalyzedAt: null,
        analyzedCount: 0,
        totalStudents,
        hasPrevious: false,
        previousSnapshotAt: null,
      },
      stats: {
        activeStudents: {
          value: activeCount,
          total: totalStudentsFromAgg,
        },
        dropped: {
          value: droppedCount,
        },
        hwSubmitted: {
          value: hwSubmitted,
          pct: hwDue > 0 ? Math.round((100 * hwSubmitted) / hwDue) : null,
        },
        hwMissedTotal: {
          value: hwMissedTotal,
        },
        hwNotSubmitted: {
          value: hwNotSubmitted,
          pct: hwDue > 0 ? Math.round((100 * hwNotSubmitted) / hwDue) : null,
        },
        atRisk: {
          value: 0,
          pct: null,
          deltaVsPrev: null,
        },
        exam: {
          deadline: examDeadlineB,
          due: examDueB,
          submitted: examSubmittedB,
          graded: examGradedB,
          total: activeCount,
        },
      },
      riskStudents: [],
      selectedRun: null,
    });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /analysis/runs
// ---------------------------------------------------------------------------
router.get('/runs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await finalizeRunsIfComplete();

    const rows = await db('analysis_run')
      .select(
        'id',
        db.raw(`to_char(as_of_date, 'YYYY-MM-DD') as as_of_date`),
        'triggered_at',
        'finalized_at',
        'status',
        'total_count',
        'high_count',
        'medium_count',
        'low_count',
      )
      .orderBy('triggered_at', 'asc');

    const runs = rows.map((r: Record<string, unknown>) => ({
      id: r['id'],
      asOfDate: (r['as_of_date'] as string | null) ?? null,
      triggeredAt: r['triggered_at'],
      finalizedAt: r['finalized_at'],
      status: r['status'],
      total: r['total_count'],
      high: r['high_count'],
      medium: r['medium_count'],
      low: r['low_count'],
    }));

    res.json({ runs });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// DELETE /analysis/runs/:id
// ---------------------------------------------------------------------------
router.delete('/runs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid run id' });
    }
    const n = await db('analysis_run').where('id', id).del();
    if (n === 0) {
      return res.status(404).json({ deleted: false, id, error: 'run not found' });
    }
    return res.json({ deleted: true, id });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /analysis/scan/state  (must be BEFORE /:id to avoid param capture)
// ---------------------------------------------------------------------------
router.get('/scan/state', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await finalizeRunsIfComplete();

    // inProgress must reflect the synchronous run state (analysis_run.status='running'),
    // not just how many analysis_results rows n8n has written so far — otherwise the
    // button/poller misses a just-triggered scan and a scan whose first results are >3 min away.
    const [totalRow, analyzedRow, runningRunRow, latestRunRow] = await Promise.all([
      db('students').count('* as c').first(),
      db('analysis_results')
        .select(
          db.raw('count(*)::int as analyzed_count'),
          db.raw('max(analyzed_at) as last_analyzed_at'),
        )
        .first(),
      db('analysis_run').where('status', 'running').orderBy('triggered_at', 'desc').first(),
      db('analysis_run').orderBy('triggered_at', 'desc').first(),
    ]);

    const totalStudents = Number((totalRow as any)?.c ?? 0);
    const analyzedCount = Number((analyzedRow as any)?.analyzed_count ?? 0);
    const lastAnalyzedAt: Date | null = (analyzedRow as any)?.last_analyzed_at ?? null;
    const runningTriggeredAt: Date | null = (runningRunRow as any)?.triggered_at ?? null;
    const hasRunningRun = runningRunRow != null;

    const progressPct =
      totalStudents > 0 ? Math.round((100 * analyzedCount) / totalStudents) : null;

    const now = Date.now();
    const THREE_MIN_MS = 3 * 60 * 1000;
    const withinLast3Min =
      lastAnalyzedAt !== null && now - new Date(lastAnalyzedAt).getTime() < THREE_MIN_MS;

    const inProgress = hasRunningRun || (analyzedCount < totalStudents && withinLast3Min);
    const justCompleted = analyzedCount >= totalStudents && withinLast3Min;

    // freshCount = real progress of the in-flight run (rows analyzed_at >= its triggered_at);
    // stalled = running but no fresh writes past the startup grace -> likely dead.
    let freshCount: number | null = null;
    if (runningTriggeredAt !== null) {
      const fr = await db('analysis_results')
        .where('analyzed_at', '>=', runningTriggeredAt)
        .count('* as c')
        .first();
      freshCount = Number((fr as any)?.c ?? 0);
    }

    const GRACE_MS = 90 * 1000;
    const stalled =
      runningTriggeredAt !== null &&
      Date.now() - new Date(runningTriggeredAt).getTime() > GRACE_MS &&
      freshCount === 0;

    const runStatus: string | null = (latestRunRow as any)?.status ?? null;
    const runTriggeredAt: Date | null = (latestRunRow as any)?.triggered_at ?? null;

    res.json({
      totalStudents,
      analyzedCount,
      lastAnalyzedAt,
      progressPct,
      inProgress,
      justCompleted,
      freshCount,
      stalled,
      runStatus,
      runTriggeredAt,
    });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /analysis/scan
// ---------------------------------------------------------------------------
router.post('/scan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Finalize any prior running run before starting a new one
    await finalizeRunsIfComplete();

    // block overlapping runs — only one scan in flight at a time (user decision 2026-05-17)
    const runningRow = await db.raw<{ rows: Array<{ id: number; triggered_at: string; as_of_date: string }> }>(
      `SELECT id, to_char(triggered_at,'YYYY-MM-DD"T"HH24:MI:SSOF') AS triggered_at, to_char(as_of_date,'YYYY-MM-DD') AS as_of_date FROM analysis_run WHERE status = 'running' ORDER BY triggered_at DESC LIMIT 1`,
    );
    const runningRunRow = runningRow.rows[0];
    if (runningRunRow !== undefined) {
      const running = runningRunRow;
      const asOfForRequest: string =
        typeof req.body?.asOfDate === 'string' && req.body.asOfDate.length > 0
          ? req.body.asOfDate
          : '2025-08-21';
      return res.status(409).json({
        triggered: false,
        blocked: true,
        error: `Аналіз вже виконується (run #${running.id}, запущено ${running.triggered_at}) — дочекайтеся завершення`,
        runningRunId: running.id,
        asOfDate: asOfForRequest,
      });
    }

    const asOfDate: string =
      typeof req.body?.asOfDate === 'string' && req.body.asOfDate.length > 0
        ? req.body.asOfDate
        : '2025-08-21';

    // a) Archive existing analysis_results into analysis_history if any rows exist
    let archived = 0;
    const existingCount = await db('analysis_results')
      .count('* as c')
      .first()
      .then((r) => Number((r as any)?.c ?? 0));

    if (existingCount > 0) {
      const result = await db.raw(`
        INSERT INTO analysis_history
          (snapshot_at, run_analyzed_at, student_id, risk_score, risk_level, urgency, student_state)
        SELECT
          now(),
          (SELECT max(analyzed_at) FROM analysis_results),
          student_id,
          risk_score,
          risk_level,
          urgency,
          student_state
        FROM analysis_results
      `);
      archived = result.rowCount ?? 0;
    }

    // 1 run per as_of_date — re-run replaces the day's run (user decision 2026-05-17; supersedes schema-designer "multiple runs per as_of allowed")
    await db.raw('DELETE FROM analysis_run WHERE as_of_date = ?::date', [asOfDate]);

    // b) Create a new analysis_run record (before triggering n8n)
    const runInsert = await db('analysis_run')
      .insert({
        as_of_date: asOfDate,
        status: 'running',
      })
      .returning('id');
    const runId: number = (runInsert[0] as any)?.id ?? (runInsert[0] as any);

    // c) POST to n8n
    const n8nBaseUrl = process.env.N8N_BASE_URL ?? 'http://localhost:5678';
    const webhookUrl = `${n8nBaseUrl}/webhook/planner/batch`;

    let triggered = false;
    let n8nStatus: number | null = null;
    let n8nBody: unknown = null;
    let triggerError: string | undefined;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: 'force', as_of_date: asOfDate }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        n8nStatus = resp.status;
        try {
          n8nBody = await resp.json();
        } catch {
          n8nBody = await resp.text().catch(() => null);
        }
        if (resp.ok) {
          triggered = true;
        } else {
          triggerError = `n8n returned HTTP ${resp.status}`;
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      triggerError = msg;
    }

    if (triggered) {
      res.status(202).json({
        archived,
        triggered: true,
        asOfDate,
        runId,
        n8n: { status: n8nStatus, body: n8nBody },
      });
    } else {
      // If n8n failed, mark the run as failed immediately
      await db('analysis_run')
        .where('id', runId)
        .where('status', 'running')
        .update({
          status: 'failed',
          finalized_at: db.raw('now()'),
          updated_at: db.raw('now()'),
        });

      res.status(200).json({
        archived,
        triggered: false,
        asOfDate,
        runId,
        error: triggerError ?? 'unknown error',
        n8n: { status: n8nStatus, body: n8nBody },
      });
    }
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /analysis/students/:id
// ---------------------------------------------------------------------------
router.get('/students/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await finalizeRunsIfComplete();

    const studentId = req.params.id;
    const asOf = parseAsOf(req.query as Record<string, unknown>);
    const runIdParam = parseRunId(req.query as Record<string, unknown>);

    // Try to resolve a complete run when runId is given
    let completeRun: Record<string, unknown> | null = null;
    if (runIdParam !== null) {
      const row = await db('analysis_run')
        .where('id', runIdParam)
        .select('*', db.raw(`to_char(as_of_date, 'YYYY-MM-DD') as as_of_date`))
        .first();
      if (row && row.status === 'complete') {
        completeRun = row as Record<string, unknown>;
      }
    }

    // Fetch student + course + mentor
    const studentRow = await db('students as s')
      .leftJoin('courses as c', 's.course_id', 'c.id')
      .leftJoin('mentors as m', 's.mentor_id', 'm.id')
      .where('s.id', studentId)
      .select(
        's.id',
        's.name',
        's.email',
        's.slack_id',
        's.status',
        's.current_module',
        's.enrollment_date',
        'c.name as course_name',
        'c.total_modules',
        'm.name as mentor_name',
      )
      .first();

    if (!studentRow) {
      res.status(404).json({ error: 'student not found' });
      return;
    }

    // -----------------------------------------------------------------------
    // BRANCH A: runId present and complete — historical snapshot
    // -----------------------------------------------------------------------
    if (completeRun !== null) {
      const runId = runIdParam as number;
      const effectiveAsOf: string =
        typeof completeRun['as_of_date'] === 'string' && completeRun['as_of_date']
          ? (completeRun['as_of_date'] as string).slice(0, 10)
          : '2025-08-21';

      // Find previous complete run for prevRiskScore
      const prevRunRow = await db('analysis_run')
        .where('status', 'complete')
        .where('triggered_at', '<', completeRun['triggered_at'] as Date)
        .orderBy('triggered_at', 'desc')
        .first();

      const [snapshotRow, lastLoginRow, hwRow] = await Promise.all([
        // From analysis_run_result
        db('analysis_run_result')
          .where('run_id', runId)
          .where('student_id', studentId)
          .first(),

        // last login on or before effectiveAsOf
        db('login_events')
          .where('student_id', studentId)
          .where('occurred_on', '<=', db.raw('?::date', [effectiveAsOf]))
          .max('occurred_on as last_login')
          .first(),

        // homework as-of effectiveAsOf
        db.raw<{ rows: Array<{
          hw_submitted: string;
          hw_missed: string;
          hw_total: string;
        }> }>(`
          SELECT
            count(*) FILTER (
              WHERE submitted_at IS NOT NULL
                AND submitted_at::date <= ?::date
            )::int AS hw_submitted,
            count(*) FILTER (
              WHERE deadline <= ?::date
                AND (submitted_at IS NULL OR submitted_at::date > ?::date)
            )::int AS hw_missed,
            count(*) FILTER (
              WHERE deadline <= ?::date
            )::int AS hw_total
          FROM homework
          WHERE student_id = ?
        `, [effectiveAsOf, effectiveAsOf, effectiveAsOf, effectiveAsOf, studentId] as string[]),
      ]);

      // prevRiskScore: same student in previous complete run
      let prevRiskScore: number | null = null;
      if (prevRunRow) {
        const prevSnapshotRow = await db('analysis_run_result')
          .where('run_id', prevRunRow.id)
          .where('student_id', studentId)
          .first();
        prevRiskScore =
          prevSnapshotRow?.risk_score !== null && prevSnapshotRow?.risk_score !== undefined
            ? Number(prevSnapshotRow.risk_score)
            : null;
      }

      const currentRiskScore =
        snapshotRow?.risk_score !== null && snapshotRow?.risk_score !== undefined
          ? Number(snapshotRow.risk_score)
          : null;
      const riskDelta =
        currentRiskScore !== null && prevRiskScore !== null
          ? currentRiskScore - prevRiskScore
          : null;

      // Activity — windows relative to effectiveAsOf
      const maxLoginDate: string | null = (lastLoginRow as any)?.last_login ?? null;
      let loginsByDay: Array<{ date: string; clicks: number }> = [];
      let loginsLast7d = 0;
      let loginsPrev7d = 0;
      let lastLoginDaysAgo: number | null = null;

      if (maxLoginDate) {
        const daysAgoRow = await db.raw(
          `SELECT (?::date - ?::date)::int AS days_ago`,
          [effectiveAsOf, maxLoginDate],
        );
        lastLoginDaysAgo = toIntOrNull(daysAgoRow.rows?.[0]?.days_ago);
      }

      const [loginsByDayRaw, loginsLast7dRow, loginsPrev7dRow] = await Promise.all([
        db('login_events')
          .where('student_id', studentId)
          .where('occurred_on', '>=', db.raw(`(?::date - interval '27 days')`, [effectiveAsOf]))
          .where('occurred_on', '<=', db.raw('?::date', [effectiveAsOf]))
          .select(
            db.raw('occurred_on::text as date'),
            db.raw('sum(sum_clicks)::int as clicks'),
          )
          .groupBy('occurred_on')
          .orderBy('occurred_on', 'asc'),

        db('login_events')
          .where('student_id', studentId)
          .where('occurred_on', '>', db.raw(`(?::date - interval '7 days')`, [effectiveAsOf]))
          .where('occurred_on', '<=', db.raw('?::date', [effectiveAsOf]))
          .countDistinct('occurred_on as c')
          .first(),

        db('login_events')
          .where('student_id', studentId)
          .where('occurred_on', '>', db.raw(`(?::date - interval '14 days')`, [effectiveAsOf]))
          .where('occurred_on', '<=', db.raw(`(?::date - interval '7 days')`, [effectiveAsOf]))
          .countDistinct('occurred_on as c')
          .first(),
      ]);

      loginsByDay = (loginsByDayRaw as any[]).map((r) => ({
        date: r.date,
        clicks: Number(r.clicks ?? 0),
      }));
      loginsLast7d = Number((loginsLast7dRow as any)?.c ?? 0);
      loginsPrev7d = Number((loginsPrev7dRow as any)?.c ?? 0);

      const totalModules = studentRow.total_modules ? Number(studentRow.total_modules) : null;
      const currentModule = studentRow.current_module ? Number(studentRow.current_module) : null;
      const progressPct =
        totalModules && totalModules > 0 && currentModule !== null
          ? Math.round((100 * currentModule) / totalModules)
          : null;

      // Communication: last 6 slack messages with sent_at::date <= effectiveAsOf
      const recentMessagesRaw = await db('slack_messages')
        .where('student_id', studentId)
        .where(db.raw('sent_at::date'), '<=', db.raw('?::date', [effectiveAsOf]))
        .orderBy('sent_at', 'desc')
        .limit(6)
        .select('is_from_student', 'channel_type', 'message_text', 'sent_at');

      const recentMessages = (recentMessagesRaw as any[]).map((m) => ({
        from: m.is_from_student
          ? 'student'
          : m.channel_type === 'mentor_dm'
          ? 'mentor'
          : 'manager',
        text: m.message_text,
        sentAt: m.sent_at,
        channelType: m.channel_type,
      }));

      const keyQuotes = parseJsonbObjectArray(snapshotRow?.supporting_evidence ?? null);
      const hwRow0 = hwRow.rows[0];

      // If no snapshot row exists for (runId, studentId), return analysis: null
      const analysisBlock = snapshotRow
        ? {
            riskScore: currentRiskScore,
            riskLevel: snapshotRow.risk_level,
            urgency: snapshotRow.urgency,
            recommendedAction: snapshotRow.recommended_action,
            secondaryAction: snapshotRow.secondary_action,
            priority: snapshotRow.priority,
            studentState: snapshotRow.student_state,
            primaryDrivers: parseJsonbArray(snapshotRow.primary_drivers),
            supportingEvidence: parseJsonbObjectArray(snapshotRow.supporting_evidence),
            draftMessage: snapshotRow.draft_message,
            mentorSummary: snapshotRow.mentor_summary,
            dashboardLabel: snapshotRow.dashboard_label,
            analyzedAt: snapshotRow.run_analyzed_at,
            prevRiskScore,
            riskDelta,
          }
        : null;

      return res.json({
        student: {
          id: studentRow.id,
          name: studentRow.name,
          email: studentRow.email,
          slackId: studentRow.slack_id,
          status: studentRow.status,
          currentModule,
          enrollmentDate: studentRow.enrollment_date,
          courseName: studentRow.course_name,
          mentorName: studentRow.mentor_name,
        },
        analysis: analysisBlock,
        activity: {
          lastLoginDate: maxLoginDate,
          lastLoginDaysAgo,
          loginsLast7d,
          loginsPrev7d,
          loginsByDay,
          progressPct,
          currentModule,
          totalModules,
          hwSubmitted: Number(hwRow0?.hw_submitted ?? 0),
          hwTotal: Number(hwRow0?.hw_total ?? 0),
          hwMissed: Number(hwRow0?.hw_missed ?? 0),
        },
        communication: {
          recentMessages,
          keyQuotes,
        },
      });
    }

    // -----------------------------------------------------------------------
    // BRANCH B: no runId (or run not complete) — live behavior bounded by asOf
    // -----------------------------------------------------------------------

    // Resolve the live run: most recent complete run with as_of_date <= asOf
    const liveRunRowStu = await db.raw<{ rows: Array<{
      id: number;
      as_of_date: string;
      triggered_at: Date;
    }> }>(`
      SELECT id, to_char(as_of_date, 'YYYY-MM-DD') AS as_of_date, triggered_at
      FROM analysis_run
      WHERE status = 'complete'
        AND as_of_date <= ?::date
      ORDER BY as_of_date DESC, triggered_at DESC
      LIMIT 1
    `, [asOf]);
    const liveRunStu = liveRunRowStu.rows[0] ?? null;

    // Find previous complete run before liveRun for prevRiskScore
    let prevLiveRunStu: { id: number; triggered_at: Date } | null = null;
    if (liveRunStu !== null) {
      prevLiveRunStu = await db('analysis_run')
        .where('status', 'complete')
        .where('triggered_at', '<', liveRunStu.triggered_at)
        .orderBy('triggered_at', 'desc')
        .first() ?? null;
    }

    // Fetch deterministic data (always as-of asOf)
    const [lastLoginRow, hwRow] = await Promise.all([
      db('login_events')
        .where('student_id', studentId)
        .where('occurred_on', '<=', db.raw('?::date', [asOf]))
        .max('occurred_on as last_login')
        .first(),

      db.raw<{ rows: Array<{
        hw_submitted: string;
        hw_missed: string;
        hw_total: string;
      }> }>(`
        SELECT
          count(*) FILTER (
            WHERE submitted_at IS NOT NULL
              AND submitted_at::date <= ?::date
          )::int AS hw_submitted,
          count(*) FILTER (
            WHERE deadline <= ?::date
              AND (submitted_at IS NULL OR submitted_at::date > ?::date)
          )::int AS hw_missed,
          count(*) FILTER (
            WHERE deadline <= ?::date
          )::int AS hw_total
        FROM homework
        WHERE student_id = ?
      `, [asOf, asOf, asOf, asOf, studentId] as string[]),
    ]);

    const maxLoginDate: string | null = (lastLoginRow as any)?.last_login ?? null;

    let loginsByDay: Array<{ date: string; clicks: number }> = [];
    let loginsLast7d = 0;
    let loginsPrev7d = 0;
    let lastLoginDaysAgo: number | null = null;

    if (maxLoginDate) {
      const daysAgoRow = await db.raw(
        `SELECT (?::date - ?::date)::int AS days_ago`,
        [asOf, maxLoginDate],
      );
      lastLoginDaysAgo = toIntOrNull(daysAgoRow.rows?.[0]?.days_ago);
    }

    const [loginsByDayRaw, loginsLast7dRow, loginsPrev7dRow] = await Promise.all([
      db('login_events')
        .where('student_id', studentId)
        .where('occurred_on', '>=', db.raw(`(?::date - interval '27 days')`, [asOf]))
        .where('occurred_on', '<=', db.raw('?::date', [asOf]))
        .select(
          db.raw('occurred_on::text as date'),
          db.raw('sum(sum_clicks)::int as clicks'),
        )
        .groupBy('occurred_on')
        .orderBy('occurred_on', 'asc'),

      db('login_events')
        .where('student_id', studentId)
        .where('occurred_on', '>', db.raw(`(?::date - interval '7 days')`, [asOf]))
        .where('occurred_on', '<=', db.raw('?::date', [asOf]))
        .countDistinct('occurred_on as c')
        .first(),

      db('login_events')
        .where('student_id', studentId)
        .where('occurred_on', '>', db.raw(`(?::date - interval '14 days')`, [asOf]))
        .where('occurred_on', '<=', db.raw(`(?::date - interval '7 days')`, [asOf]))
        .countDistinct('occurred_on as c')
        .first(),
    ]);

    loginsByDay = (loginsByDayRaw as any[]).map((r) => ({
      date: r.date,
      clicks: Number(r.clicks ?? 0),
    }));
    loginsLast7d = Number((loginsLast7dRow as any)?.c ?? 0);
    loginsPrev7d = Number((loginsPrev7dRow as any)?.c ?? 0);

    const totalModules = studentRow.total_modules ? Number(studentRow.total_modules) : null;
    const currentModule = studentRow.current_module ? Number(studentRow.current_module) : null;
    const progressPct =
      totalModules && totalModules > 0 && currentModule !== null
        ? Math.round((100 * currentModule) / totalModules)
        : null;

    const recentMessagesRaw = await db('slack_messages')
      .where('student_id', studentId)
      .where(db.raw('sent_at::date'), '<=', db.raw('?::date', [asOf]))
      .orderBy('sent_at', 'desc')
      .limit(6)
      .select('is_from_student', 'channel_type', 'message_text', 'sent_at');

    const recentMessages = (recentMessagesRaw as any[]).map((m) => ({
      from: m.is_from_student
        ? 'student'
        : m.channel_type === 'mentor_dm'
        ? 'mentor'
        : 'manager',
      text: m.message_text,
      sentAt: m.sent_at,
      channelType: m.channel_type,
    }));

    const hwRow0 = hwRow.rows[0];

    const activityBlock = {
      lastLoginDate: maxLoginDate,
      lastLoginDaysAgo,
      loginsLast7d,
      loginsPrev7d,
      loginsByDay,
      progressPct,
      currentModule,
      totalModules,
      hwSubmitted: Number(hwRow0?.hw_submitted ?? 0),
      hwTotal: Number(hwRow0?.hw_total ?? 0),
      hwMissed: Number(hwRow0?.hw_missed ?? 0),
    };

    const studentBlock = {
      id: studentRow.id,
      name: studentRow.name,
      email: studentRow.email,
      slackId: studentRow.slack_id,
      status: studentRow.status,
      currentModule,
      enrollmentDate: studentRow.enrollment_date,
      courseName: studentRow.course_name,
      mentorName: studentRow.mentor_name,
    };

    // BRANCH B-1: liveRun exists — pull analysis from analysis_run_result
    if (liveRunStu !== null) {
      const liveRunIdStu = liveRunStu.id;

      const [snapshotRow, prevSnapshotRow] = await Promise.all([
        db('analysis_run_result')
          .where('run_id', liveRunIdStu)
          .where('student_id', studentId)
          .first(),

        prevLiveRunStu !== null
          ? db('analysis_run_result')
              .where('run_id', prevLiveRunStu.id)
              .where('student_id', studentId)
              .first()
          : Promise.resolve(null),
      ]);

      const currentRiskScore =
        snapshotRow?.risk_score !== null && snapshotRow?.risk_score !== undefined
          ? Number(snapshotRow.risk_score)
          : null;
      const prevRiskScore =
        prevSnapshotRow?.risk_score !== null && prevSnapshotRow?.risk_score !== undefined
          ? Number(prevSnapshotRow.risk_score)
          : null;
      const riskDelta =
        currentRiskScore !== null && prevRiskScore !== null
          ? currentRiskScore - prevRiskScore
          : null;

      const keyQuotes = parseJsonbObjectArray(snapshotRow?.supporting_evidence ?? null);

      const analysisBlock = snapshotRow
        ? {
            riskScore: currentRiskScore,
            riskLevel: snapshotRow.risk_level,
            urgency: snapshotRow.urgency,
            recommendedAction: snapshotRow.recommended_action,
            secondaryAction: snapshotRow.secondary_action,
            priority: snapshotRow.priority,
            studentState: snapshotRow.student_state,
            primaryDrivers: parseJsonbArray(snapshotRow.primary_drivers),
            supportingEvidence: parseJsonbObjectArray(snapshotRow.supporting_evidence),
            draftMessage: snapshotRow.draft_message,
            mentorSummary: snapshotRow.mentor_summary,
            dashboardLabel: snapshotRow.dashboard_label,
            analyzedAt: snapshotRow.run_analyzed_at,
            prevRiskScore,
            riskDelta,
          }
        : null;

      return res.json({
        student: studentBlock,
        analysis: analysisBlock,
        activity: activityBlock,
        communication: {
          recentMessages,
          keyQuotes,
        },
      });
    }

    // BRANCH B-2: no liveRun — no AI data yet
    return res.json({
      noAnalysisYet: true,
      student: studentBlock,
      analysis: null,
      activity: activityBlock,
      communication: {
        recentMessages,
        keyQuotes: [],
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;

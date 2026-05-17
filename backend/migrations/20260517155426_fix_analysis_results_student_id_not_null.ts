/**
 * Production data-integrity fix for analysis_results.student_id NULL residue.
 *
 * BACKGROUND — THE 17/15 BUG
 * ---------------------------
 * The dashboard showed "17 students analysed" against a cohort of 15.  The
 * extra 2 rows were junk writes from a malformed n8n pipeline execution that
 * set student_id = NULL.  Postgres's UNIQUE constraint on (student_id) does NOT
 * block multiple NULL values — by SQL standard, NULL ≠ NULL, so each NULL is
 * treated as distinct and bypasses the upsert guard.  The rows accumulated
 * silently, inflating every aggregate that groups / counts by student_id and
 * causing finalizeRunsIfComplete() to resolve to an incorrect count.
 *
 * WHAT THIS MIGRATION DOES
 * ------------------------
 * 1. Deletes all analysis_results rows where student_id IS NULL (the corrupt
 *    pipeline residue; never valid analyses — no student is identifiable).
 * 2. Marks analysis_results.student_id NOT NULL so any future bad n8n write
 *    (missing or null student_id in the upsert payload) fails loudly at the
 *    DB layer instead of accumulating silently.
 *
 * DEFENSE-IN-DEPTH
 * ----------------
 * This is the DB-layer backstop.  The Planner workflow guard (student_id
 * scoped GET Recent Messages, NOT-EXISTS sentinel for Load Homework) and the
 * finalize watchdog in the Express API are the application-layer defences.
 * Together they ensure a bad pipeline write fails fast at multiple levels
 * rather than leaking through to the dashboard count.
 *
 * RELATED TABLES
 * --------------
 * analysis_results is the n8n latest-upsert cache — one row per live student,
 * refreshed on each full AI scan (20260517090215_formalize_n8n_pipeline_tables).
 * The UNIQUE(student_id) index and the FK to students(id) ON DELETE CASCADE
 * are unchanged; we only tighten the NULL-ability of student_id.
 *
 * IDEMPOTENCY
 * -----------
 * - DELETE WHERE student_id IS NULL is naturally idempotent (0 rows on re-run).
 * - ALTER COLUMN … SET NOT NULL is idempotent in Postgres: no error is raised
 *   if the column is already NOT NULL.
 *
 * SEQUENCE REQUIREMENT
 * --------------------
 * Must run after 20260517090215_formalize_n8n_pipeline_tables (which creates
 * the analysis_results table).  Timestamp 20260517155426 satisfies this.
 *
 * See also: docs/CLAUDE_NOTES.md entry 2026-05-17
 *   - "n8n pipeline tables formalized into Knex (rogue-table drift fully closed)"
 *   - "n8n zero-row halt: Planner dead-ended at early as_of dates"
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── 1. Delete corrupt NULL-student_id rows ────────────────────────────────
  // These rows were written by a malformed n8n execution (missing student_id
  // in the upsert payload).  They are not associated with any identifiable
  // student and cannot be recovered or corrected — they are purely pipeline
  // residue.  Deleting them is safe and irreversible by design.
  //
  // Naturally idempotent: if no NULL rows exist (e.g. re-run after migration
  // was already applied), the DELETE affects 0 rows and succeeds without error.
  //
  // IMPORTANT: this step MUST precede the SET NOT NULL below.  Postgres
  // validates the NOT NULL constraint against the full current table contents
  // immediately at ALTER time; if any NULL row still exists the ALTER will
  // fail with "column contains null values".
  await knex.raw(`
    DELETE FROM analysis_results
    WHERE  student_id IS NULL
  `);

  // ── 2. Forbid future NULL writes to student_id ────────────────────────────
  // Any n8n write that omits student_id (or explicitly sends null) will now
  // receive a PostgreSQL NOT NULL constraint violation and fail immediately,
  // surfacing the pipeline bug rather than silently accumulating a junk row.
  //
  // Idempotent in Postgres: ALTER COLUMN … SET NOT NULL is a no-op when the
  // column is already NOT NULL (no error, no table rewrite).
  await knex.raw(`
    ALTER TABLE analysis_results
      ALTER COLUMN student_id SET NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Restore the column to nullable so the schema matches the pre-fix state.
  //
  // NOTE: The NULL rows that were deleted by up() are intentionally NOT
  // restored.  They were corrupt pipeline residue (student_id = NULL, never
  // a valid analysis) — re-inserting them would reintroduce the dashboard
  // count bug.  The only effect of this down() is to allow future NULL writes
  // again, which is the reverse of the constraint change.  If you are rolling
  // back because of a pipeline regression, fix the pipeline; do not rely on
  // the absence of this guard.
  await knex.raw(`
    ALTER TABLE analysis_results
      ALTER COLUMN student_id DROP NOT NULL
  `);
}

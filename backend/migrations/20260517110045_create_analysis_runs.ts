/**
 * Production timeline of analysis runs — each full AI scan produces one
 * `analysis_run` row; the per-student snapshot is frozen into
 * `analysis_run_result` by the Express API (Option A lazy-finalize on read).
 *
 * RELATIONSHIP TO EXISTING TABLES
 * --------------------------------
 * - `analysis_results`  (20260517090215) — n8n's live 1-row-per-student cache.
 *   The Express API reads this table to populate `analysis_run_result` at
 *   finalize time.  n8n is NOT modified.
 * - `analysis_history`  (20260517100131) — point-in-time snapshots archived
 *   before each new scan. Provides the "previous run" for risk-delta UI.
 * - `analysis_run`      (this migration) — the run header: timing, status,
 *   aggregated counts.
 * - `analysis_run_result` (this migration) — immutable per-student snapshot
 *   for a given run; mirrors the `analysis_results` columns + `run_id` link.
 *
 * IDEMPOTENCY
 * -----------
 * All DDL uses CREATE TABLE/INDEX IF NOT EXISTS + guarded DO blocks for
 * CHECK constraints, UNIQUE constraints, and FKs. Re-running is a strict
 * no-op on any DB where this migration has already been applied, including
 * canonical DBs where these tables were pre-created by hand.
 *
 * SEQUENCE REQUIREMENT
 * --------------------
 * Must run after 20260509120003_create_students_table (FK target `students`)
 * and after 20260517100131_create_analysis_history_snapshot.
 * Timestamp 20260517110045 satisfies both orderings.
 *
 * See also: docs/CLAUDE_NOTES.md entries dated 2026-05-17
 *   - "n8n pipeline tables formalized into Knex (rogue-table drift fully closed)"
 *   - "analysis_results + dashboard_cache are EPHEMERAL — empty ≠ data loss"
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── 1. analysis_run — run header ──────────────────────────────────────────
  // One row per full AI batch scan. `status` progresses running → complete |
  // failed. Count columns are denormalized aggregates written at finalize time
  // by the Express API so the dashboard can read a single row without grouping.
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS analysis_run (
      id            bigserial PRIMARY KEY,
      as_of_date    date        NOT NULL,
      triggered_at  timestamptz NOT NULL DEFAULT now(),
      finalized_at  timestamptz,
      status        text        NOT NULL DEFAULT 'running',
      total_count   integer     NOT NULL DEFAULT 0,
      high_count    integer     NOT NULL DEFAULT 0,
      medium_count  integer     NOT NULL DEFAULT 0,
      low_count     integer     NOT NULL DEFAULT 0,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    )
  `);

  // ── 2. CHECK: status must be one of the three lifecycle values ────────────
  // No CREATE TYPE / ENUM (CLAUDE.md forbids it — use CHECK only).
  // Guard: add only if the named constraint does not already exist.
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint c
        JOIN   pg_class      r ON r.oid = c.conrelid
        WHERE  c.conname = 'analysis_run_status_check'
        AND    r.relname = 'analysis_run'
      ) THEN
        ALTER TABLE analysis_run
          ADD CONSTRAINT analysis_run_status_check
          CHECK (status IN ('running', 'complete', 'failed'));
      END IF;
    END
    $$
  `);

  // ── 3. CHECK: finalized_at must not precede triggered_at ─────────────────
  // Guard: add only if the named constraint does not already exist.
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint c
        JOIN   pg_class      r ON r.oid = c.conrelid
        WHERE  c.conname = 'analysis_run_finalized_after_trigger_check'
        AND    r.relname = 'analysis_run'
      ) THEN
        ALTER TABLE analysis_run
          ADD CONSTRAINT analysis_run_finalized_after_trigger_check
          CHECK (finalized_at IS NULL OR finalized_at >= triggered_at);
      END IF;
    END
    $$
  `);

  // ── 4. analysis_run_result — per-student snapshot ─────────────────────────
  // Immutable after finalization. Mirrors the analysis_results column set plus
  // run_id so the full history of any run can be retrieved without n8n writes.
  // The UNIQUE constraint is declared inline in the CREATE TABLE statement;
  // the guarded DO block below re-asserts it on DBs where the table pre-existed
  // without the constraint (idempotency on canonical DBs).
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS analysis_run_result (
      id                  bigserial PRIMARY KEY,
      run_id              bigint NOT NULL,
      student_id          text   NOT NULL,
      risk_score          integer,
      risk_level          text,
      urgency             text,
      recommended_action  text,
      secondary_action    text,
      priority            text,
      student_state       text,
      primary_drivers     jsonb,
      supporting_evidence jsonb,
      draft_message       text,
      mentor_summary      text,
      dashboard_label     text,
      run_analyzed_at     timestamptz,
      created_at          timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT analysis_run_result_run_student_key UNIQUE (run_id, student_id)
    )
  `);

  // Guarded re-assertion of the UNIQUE constraint for DBs that had the table
  // without it (canonical / hand-created pre-migration).
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint c
        JOIN   pg_class      r ON r.oid = c.conrelid
        WHERE  c.conname = 'analysis_run_result_run_student_key'
        AND    r.relname = 'analysis_run_result'
      ) THEN
        ALTER TABLE analysis_run_result
          ADD CONSTRAINT analysis_run_result_run_student_key
          UNIQUE (run_id, student_id);
      END IF;
    END
    $$
  `);

  // ── 5. Indexes on analysis_run ────────────────────────────────────────────
  // Composite: date-range + recency sort — primary query for "runs on date X".
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_analysis_run_as_of
      ON analysis_run (as_of_date, triggered_at DESC)
  `);

  // Latest-run-first listing (dashboard header).
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_analysis_run_triggered
      ON analysis_run (triggered_at DESC)
  `);

  // Monitoring / filter running/failed/complete.
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_analysis_run_status
      ON analysis_run (status)
  `);

  // ── 6. Index on analysis_run_result ──────────────────────────────────────
  // Per-student history across runs + run lookup by student.
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_analysis_run_result_student
      ON analysis_run_result (student_id, run_id)
  `);

  // ── 7. FK: analysis_run_result.run_id → analysis_run(id) ON DELETE CASCADE
  //
  // Guard: add only if no FK matching this definition already exists on the
  // table (detection via pg_get_constraintdef ILIKE — robust to name variants).
  // CASCADE: deleting a run header removes all its result rows; a result row
  // without a run header is uninterpretable.
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint c
        JOIN   pg_class      r ON r.oid = c.conrelid
        WHERE  c.contype = 'f'
        AND    r.relname = 'analysis_run_result'
        AND    pg_get_constraintdef(c.oid) ILIKE
                 '%FOREIGN KEY (run_id) REFERENCES analysis_run(id)%'
      ) THEN
        ALTER TABLE analysis_run_result
          ADD CONSTRAINT analysis_run_result_run_id_fkey
          FOREIGN KEY (run_id)
          REFERENCES analysis_run (id)
          ON DELETE CASCADE;
      END IF;
    END
    $$
  `);

  // ── 8. FK: analysis_run_result.student_id → students(id) ON DELETE CASCADE
  //
  // Rationale: same as analysis_results / analysis_history — derived data;
  // the seed truncates students and CASCADE ensures orphan-free cleanup.
  // n8n never deletes students, so CASCADE is transparent to the pipeline in
  // production.
  //
  // Guard: identical ILIKE pattern used in 20260517090215 and 20260517100131.
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint c
        JOIN   pg_class      r ON r.oid = c.conrelid
        WHERE  c.contype = 'f'
        AND    r.relname = 'analysis_run_result'
        AND    pg_get_constraintdef(c.oid) ILIKE
                 '%FOREIGN KEY (student_id) REFERENCES students(id)%'
      ) THEN
        ALTER TABLE analysis_run_result
          ADD CONSTRAINT analysis_run_result_student_id_fkey
          FOREIGN KEY (student_id)
          REFERENCES students (id)
          ON DELETE CASCADE;
      END IF;
    END
    $$
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Child table first to avoid FK violation; CASCADE drops dependent objects
  // (sequences, indexes, constraints) automatically.
  //
  // WARNING: running down() destroys the persisted analysis-run history.
  // Unlike analysis_results (ephemeral pipeline cache), analysis_run /
  // analysis_run_result are NOT reconstructable from analysis_results — which
  // holds only the latest row per student. Once dropped, historical run data
  // is permanently lost. Do NOT run on production without an explicit export.
  await knex.raw('DROP TABLE IF EXISTS analysis_run_result CASCADE');
  await knex.raw('DROP TABLE IF EXISTS analysis_run CASCADE');
}

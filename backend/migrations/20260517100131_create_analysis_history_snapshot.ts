/**
 * Adds the `analysis_history` table to support risk-delta / trend analytics
 * ("динаміка ризику / з минулого аналізу").
 *
 * WHY THIS TABLE EXISTS
 * ---------------------
 * `analysis_results` holds exactly ONE row per student
 * (UNIQUE(student_id) + n8n overwrites on every scan), so there is no prior
 * run to compare against when computing "change since last analysis".
 *
 * The future `/analysis/scan` API endpoint MUST, before triggering each n8n
 * batch, archive the current `analysis_results` rows into `analysis_history`.
 * After archival:
 *   - "current"  = latest row in `analysis_results` (written by this scan)
 *   - "previous" = latest snapshot in `analysis_history` for that student
 *                  (written by the preceding scan)
 *
 * n8n workflows are NOT modified — they continue writing only to
 * `analysis_results`. The archival step is the sole responsibility of the
 * Express API layer.
 *
 * IDEMPOTENCY
 * -----------
 * All DDL uses IF NOT EXISTS or guarded DO blocks → safe to run on any DB
 * that already has this migration applied, or on the canonical production DB
 * if it was somehow pre-created. A repeated run is a no-op.
 *
 * SEQUENCE REQUIREMENT
 * --------------------
 * Must run after 20260517090215_formalize_n8n_pipeline_tables (which creates
 * `analysis_results`) and after 20260509120003_create_students_table (FK
 * target). This file's timestamp (20260517100131) satisfies both orderings.
 *
 * See also: docs/CLAUDE_NOTES.md entries dated 2026-05-17
 *   - "n8n pipeline tables formalized into Knex (rogue-table drift fully closed)"
 *   - "analysis_results + dashboard_cache are EPHEMERAL — empty ≠ data loss"
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── 1. analysis_history table ─────────────────────────────────────────────
  // Each row is a point-in-time snapshot of one analysis_results row, copied
  // by the /analysis/scan endpoint before the next n8n batch overwrites it.
  // `run_analyzed_at` mirrors `analysis_results.analyzed_at` of that row so
  // callers can distinguish "snapshot timestamp" (when we archived it) from
  // "analysis timestamp" (when n8n produced it).
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS analysis_history (
      id              serial PRIMARY KEY,
      snapshot_at     timestamptz NOT NULL DEFAULT now(),
      run_analyzed_at timestamptz,
      student_id      text NOT NULL,
      risk_score      integer,
      risk_level      text,
      urgency         text,
      student_state   text
    )
  `);

  // ── 2. Composite index: per-student chronological lookup ──────────────────
  // Supports "latest snapshot for student X" efficiently — the primary query
  // for risk-delta computation (ORDER BY snapshot_at DESC LIMIT 1 per student).
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_analysis_history_student_snapshot
      ON analysis_history (student_id, snapshot_at DESC)
  `);

  // ── 3. Global chronological index ────────────────────────────────────────
  // Supports time-range queries over all snapshots (e.g., "snapshots in the
  // last 7 days") and admin/audit views.
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_analysis_history_snapshot
      ON analysis_history (snapshot_at DESC)
  `);

  // ── 4. FK: analysis_history.student_id → students(id) ON DELETE CASCADE ──
  //
  // Rationale (CLAUDE.md requires an explicit ON DELETE on every FK):
  //   - CASCADE is correct here: a history snapshot row is meaningless without
  //     its student (there is no way to interpret the risk delta if the student
  //     no longer exists).
  //   - The seed truncates `students` on every run; CASCADE ensures derived
  //     history rows are also cleaned up automatically — the same pattern and
  //     rationale as the `analysis_results → students` FK established in
  //     migration 20260517090215_formalize_n8n_pipeline_tables.
  //
  // Guard logic (identical pattern to 20260517090215):
  //   a) CASCADE FK already exists → true no-op (re-run safety, canonical DBs).
  //   b) No FK exists at all       → add the CASCADE FK (fresh / local DB).
  //   Detection is by pg_constraint definition text (ILIKE) for robustness
  //   against constraint name variations.
  await knex.raw(`
    DO $$
    BEGIN
      -- (a) Already correct? → nothing to do.
      IF EXISTS (
        SELECT 1
        FROM   pg_constraint c
        JOIN   pg_class      r ON r.oid = c.conrelid
        WHERE  c.contype = 'f'
        AND    r.relname = 'analysis_history'
        AND    pg_get_constraintdef(c.oid) ILIKE
                 '%FOREIGN KEY (student_id) REFERENCES students(id)%'
      ) THEN
        RETURN;
      END IF;

      -- (b) No FK exists → add the canonical CASCADE FK.
      ALTER TABLE analysis_history
        ADD CONSTRAINT analysis_history_student_id_fkey
        FOREIGN KEY (student_id)
        REFERENCES students (id)
        ON DELETE CASCADE;
    END
    $$
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Dropping analysis_history loses all accumulated trend/delta history.
  // Contents are derived archival data (copied from analysis_results before
  // each scan) and cannot be reconstructed from analysis_results alone
  // (which holds only the latest row per student). Proceed only intentionally.
  // The serial-owned sequence (analysis_history_id_seq) drops with the table.
  await knex.raw('DROP TABLE IF EXISTS analysis_history CASCADE');
}

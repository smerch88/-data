/**
 * Formalizes the two n8n AI-pipeline output tables that were created OUT OF KNEX
 * directly on the VPS production database (the "rogue tables" from the 2026-05-16
 * xmin forensic audit; see also the 2026-05-17 entry in docs/CLAUDE_NOTES.md).
 *
 *   analysis_results  — per-student risk scores produced by the n8n Analyst Sub-Agent
 *   dashboard_cache   — 1-hour TTL batch summary cache written by the n8n pipeline
 *
 * GOALS:
 *   1. Make local == VPS == code so local n8n testing is unblocked.
 *   2. Be a strict no-op on the VPS where these tables already exist (IF NOT EXISTS
 *      everywhere + guarded DO blocks for the FK reconcile).
 *   3. Correctly create both tables on a fresh / local DB.
 *   4. Reconcile the analysis_results → students FK from prod default (NO ACTION) to
 *      ON DELETE CASCADE, as required by CLAUDE.md ("every FK must declare ON DELETE").
 *      The seed's students.del() fails once analysis_results has rows if the FK is
 *      NO ACTION; CASCADE is safe because the table is ephemeral pipeline output
 *      (regenerated on next pipeline run) and n8n never deletes students.
 *
 * Sequence requirement: must run after 20260509120003_create_students_table (the FK
 * target). A 2026-05-17 timestamp guarantees that ordering.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── 1. analysis_results ────────────────────────────────────────────────────
  // Exact replica of the VPS DDL (text/integer/jsonb/timestamptz; no CHECK
  // constraints — the pipeline writes free-form text values and VPS has none).
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS analysis_results (
      id                  serial PRIMARY KEY,
      student_id          text,
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
      analyzed_at         timestamptz DEFAULT now(),
      CONSTRAINT analysis_results_student_id_key UNIQUE (student_id)
    )
  `);

  // ── 2. dashboard_cache ─────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS dashboard_cache (
      id              serial PRIMARY KEY,
      cache_key       text NOT NULL,
      data            jsonb NOT NULL DEFAULT '{}'::jsonb,
      students_count  integer DEFAULT 0,
      high_risk_count integer DEFAULT 0,
      created_at      timestamptz DEFAULT now(),
      expires_at      timestamptz DEFAULT now(),
      CONSTRAINT dashboard_cache_cache_key_key UNIQUE (cache_key)
    )
  `);

  // ── 3. Indexes (all idempotent via IF NOT EXISTS) ──────────────────────────
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_analysis_results_analyzed
       ON analysis_results (analyzed_at DESC)`
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_analysis_results_risk
       ON analysis_results (risk_level, risk_score DESC)`
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_analysis_results_student
       ON analysis_results (student_id)`
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_dashboard_cache_expires
       ON dashboard_cache (expires_at)`
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_dashboard_cache_key
       ON dashboard_cache (cache_key)`
  );

  // ── 4. FK reconcile: analysis_results.student_id → students(id) ON DELETE CASCADE
  //
  // Rationale (see file-level doc comment above):
  //   - CLAUDE.md requires every FK to carry an explicit ON DELETE action.
  //   - The production FK (if it exists at all) was created with NO ACTION (Postgres
  //     default). That causes the seed's `knex('students').del()` to fail with a FK
  //     violation once the pipeline has written rows into analysis_results.
  //   - CASCADE is correct: analysis_results is a 1:1 derived cache; when the seed
  //     truncates students it is correct for the derived cache to vanish too. n8n
  //     never deletes students — only the seed does — so this is transparent to the
  //     pipeline in production.
  //
  // Guard logic:
  //   a) If a CASCADE FK already exists  → do nothing (true no-op on a DB that
  //      already had this migration applied, or was set up correctly from scratch).
  //   b) If a non-CASCADE FK exists       → drop it and add the CASCADE version.
  //   c) If no FK exists at all (fresh DB)→ just add it.
  //
  // All detection is by pg_constraint definition text (ILIKE) so it is robust to
  // constraint name variations (the prod name is analysis_results_student_id_fkey
  // but we do not assume that).
  await knex.raw(`
    DO $$
    DECLARE
      v_conname text;
    BEGIN
      -- (a) Already correct? → nothing to do.
      IF EXISTS (
        SELECT 1
        FROM   pg_constraint c
        JOIN   pg_class      r ON r.oid = c.conrelid
        WHERE  c.contype  = 'f'
        AND    r.relname  = 'analysis_results'
        AND    pg_get_constraintdef(c.oid) ILIKE
                 '%FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE%'
      ) THEN
        RETURN;
      END IF;

      -- (b) Non-CASCADE FK exists? → drop it before re-adding.
      SELECT c.conname INTO v_conname
      FROM   pg_constraint c
      JOIN   pg_class      r ON r.oid = c.conrelid
      WHERE  c.contype = 'f'
      AND    r.relname = 'analysis_results'
      AND    pg_get_constraintdef(c.oid) ILIKE
               '%FOREIGN KEY (student_id) REFERENCES students(id)%'
      LIMIT 1;

      IF v_conname IS NOT NULL THEN
        EXECUTE 'ALTER TABLE analysis_results DROP CONSTRAINT ' || quote_ident(v_conname);
      END IF;

      -- (c) Add the canonical CASCADE FK (cases b and c both end here).
      ALTER TABLE analysis_results
        ADD CONSTRAINT analysis_results_student_id_fkey
        FOREIGN KEY (student_id)
        REFERENCES students (id)
        ON DELETE CASCADE;
    END
    $$
  `);
}

export async function down(knex: Knex): Promise<void> {
  // WARNING: running down() on the VPS destroys the live n8n pipeline cache tables.
  // This is tolerable ONLY because their contents are ephemeral — both tables are
  // regenerated on the next pipeline run. Do NOT run this casually on production.
  // Serial-owned sequences (analysis_results_id_seq, dashboard_cache_id_seq) are
  // dropped automatically along with their owning tables.
  await knex.raw('DROP TABLE IF EXISTS analysis_results CASCADE');
  await knex.raw('DROP TABLE IF EXISTS dashboard_cache CASCADE');
}

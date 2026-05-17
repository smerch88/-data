/**
 * Migration: reconcile_students_course_id_drift
 *
 * WHY THIS EXISTS
 * ---------------
 * The production (VPS) database drifted from the committed Knex schema via
 * out-of-Knex hand-edits — the same pattern as the rogue `analysis_results`
 * and `dashboard_cache` tables documented in docs/CLAUDE_NOTES.md (2026-05-16
 * xmin audit).  Specifically:
 *
 *   • Someone renamed `students.course_id` → `students.course` directly in
 *     Postgres (outside Knex), losing the canonical column name defined in
 *     migration 20260509120003 (t.text('course_id')...).
 *   • The `students_n8n` VIEW (migration 20260515131606) was then hand-rewritten
 *     on the VPS to join `s.course` instead of `s.course_id`, diverging from
 *     the committed VIEW definition.
 *
 * The local DB and the committed codebase are already canonical (`course_id`).
 * This migration idempotently realigns any drifted DB back to canonical and is
 * a deliberate no-op on an already-canonical DB (local / fresh migrations run).
 *
 * See also:
 *   docs/CLAUDE_NOTES.md — 2026-05-16 (xmin forensic audit)
 *   docs/CLAUDE_NOTES.md — 2026-05-17 entries (re-seed anchor, n8n VPS setup)
 */

import type { Knex } from 'knex';

// ---------------------------------------------------------------------------
// Canonical students_n8n VIEW SQL — verbatim from migration 20260515131606.
// Extracted as a constant so both up() and down() share the exact same text
// (one source of truth — avoids subtle drift between the two functions).
// ---------------------------------------------------------------------------
const STUDENTS_N8N_VIEW_SQL = `
  CREATE VIEW students_n8n AS
  SELECT
    s.id              AS student_id,
    s.name,
    s.email,
    s.slack_id,
    c.name            AS course,
    s.mentor_id,
    s.enrollment_date AS enrolled_at,
    CASE
      WHEN MAX(le.occurred_on) IS NULL THEN 'inactive'
      WHEN (app_as_of() - MAX(le.occurred_on)) <= 14 THEN 'active'
      WHEN (app_as_of() - MAX(le.occurred_on)) <= 60 THEN 'paused'
      ELSE 'inactive'
    END AS status
  FROM students s
  LEFT JOIN courses c
    ON c.id = s.course_id
  LEFT JOIN login_events le
    ON le.student_id = s.id
   AND le.occurred_on <= app_as_of()
  GROUP BY s.id, s.name, s.email, s.slack_id, c.name, s.mentor_id, s.enrollment_date
`;

export async function up(knex: Knex): Promise<void> {
  // Step 1 — Drop the possibly hand-edited students_n8n VIEW (CASCADE so any
  // dependent objects also go).  This must happen before the column rename
  // below: if the drifted VPS view references `s.course`, Postgres would
  // block the rename with a "column is referenced by view" error.
  await knex.raw(`DROP VIEW IF EXISTS students_n8n CASCADE`);

  // Step 2 — Idempotent column rename.
  // Only executes when the drifted state is detected (column `course` exists
  // AND column `course_id` does NOT exist on table `students`).
  // On a canonical DB (course_id already present) this DO block is a no-op.
  // Note: Postgres column renames are metadata-only; the dependent index and
  // FK constraint follow the column automatically — no manual fixup needed for
  // the rename itself.
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'course'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'course_id'
      )
      THEN
        ALTER TABLE students RENAME COLUMN course TO course_id;
      END IF;
    END;
    $$
  `);

  // Step 3 — Re-assert the index.
  // IF NOT EXISTS is Postgres-native syntax (PG 9.5+).  Covers the case where
  // a hand-DROP+ADD of the column lost the index that migration 20260509120003
  // created as `idx_students_course_id`.
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_students_course_id ON students (course_id)`,
  );

  // Step 4 — Re-assert the FK constraint idempotently.
  // We detect by definition, not by constraint name, because the hand-drift
  // may have given it a different name.  If the FK already exists in canonical
  // form this DO block is a no-op.
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE con.contype = 'f'
          AND rel.relname = 'students'
          AND pg_get_constraintdef(con.oid) ILIKE '%FOREIGN KEY (course_id) REFERENCES courses(id)%'
      )
      THEN
        ALTER TABLE students
          ADD CONSTRAINT students_course_id_foreign
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT;
      END IF;
    END;
    $$
  `);

  // Step 5 — Re-assert the canonical students_n8n VIEW.
  // Overwrites any hand-edited divergent VPS VIEW that was dropped in step 1.
  // Depends on the app_as_of() function created by migration 20260515131606;
  // we do NOT recreate that function here.
  await knex.raw(STUDENTS_N8N_VIEW_SQL);
}

export async function down(knex: Knex): Promise<void> {
  // INTENTIONAL ASYMMETRY — READ BEFORE CHANGING
  // ---------------------------------------------
  // This is a *repair* migration, not a feature migration.  The normal
  // pattern of "down() reverses up()" does NOT apply to the column rename:
  //
  //   • Renaming course_id back to course in down() would deliberately
  //     re-introduce the hand-drift that up() exists to fix.  That is a
  //     known-bad state on the VPS, not a previous good state to restore.
  //   • The index and FK are part of the canonical schema (migration
  //     20260509120003); dropping them in down() would corrupt a schema that
  //     pre-dates this migration.
  //
  // Therefore down() only re-asserts the canonical students_n8n VIEW
  // (idempotently) and is otherwise a no-op.  The column rename is
  // intentionally irreversible from this migration — to truly "undo" the
  // repair you would need a separate intentional migration.

  await knex.raw(`DROP VIEW IF EXISTS students_n8n CASCADE`);
  await knex.raw(STUDENTS_N8N_VIEW_SQL);
}

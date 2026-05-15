/**
 * Migration: n8n adapter layer for Dmytro.
 *
 * Background: Dmytro builds an n8n workflow that consumes the DB directly
 * (he doesn't use our HTTP API). His workflow expects table-shaped objects
 * with specific column names (e.g. `course`, `enrolled_at`, `login_date`,
 * `text`, `to_mentor`, `mentor_id` at the top) and a `status` column that
 * classifies students into active/paused/inactive by their login activity.
 *
 * This migration creates 4 read-only VIEWs that present our base tables in
 * exactly that shape — no ALTER on real tables. Names are suffixed `_n8n`
 * so the original schema stays clean.
 *
 *  * mentors_n8n         — id renamed to mentor_id
 *  * login_events_n8n    — occurred_on renamed to login_date
 *  * slack_messages_n8n  — renames: sent_at→message_date, message_text→text,
 *                         mentioned_mentor→to_mentor
 *  * students_n8n        — joins courses for `course` text; derives `status`
 *                         from login_events using Dmytro's 14/60-day rule
 *
 * Date anchoring: our seeded login_events run far past CURRENT_DATE (OULAD
 * window mapped into 2026), so a fixed CURRENT_DATE-based classifier is
 * meaningless for the demo. We expose a session setting `app.as_of` via a
 * helper function `app_as_of()`. From n8n / pgAdmin / psql:
 *
 *   SET app.as_of = '2026-09-01';
 *   SELECT * FROM students_n8n;        -- status as of 2026-09-01
 *
 * Without SET, the function falls back to CURRENT_DATE.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Helper function. STABLE so PG can fold it within a query plan.
  await knex.raw(`DROP FUNCTION IF EXISTS app_as_of() CASCADE`);
  await knex.raw(`
    CREATE FUNCTION app_as_of() RETURNS date AS $$
      SELECT COALESCE(
        NULLIF(current_setting('app.as_of', true), '')::date,
        CURRENT_DATE
      )
    $$ LANGUAGE SQL STABLE
  `);

  await knex.raw(`DROP VIEW IF EXISTS mentors_n8n CASCADE`);
  await knex.raw(`
    CREATE VIEW mentors_n8n AS
    SELECT
      id   AS mentor_id,
      name,
      slack_id
    FROM mentors
  `);

  await knex.raw(`DROP VIEW IF EXISTS login_events_n8n CASCADE`);
  await knex.raw(`
    CREATE VIEW login_events_n8n AS
    SELECT
      id,
      student_id,
      occurred_on AS login_date
    FROM login_events
  `);

  await knex.raw(`DROP VIEW IF EXISTS slack_messages_n8n CASCADE`);
  await knex.raw(`
    CREATE VIEW slack_messages_n8n AS
    SELECT
      id,
      student_id,
      sent_at          AS message_date,
      message_text     AS text,
      mentioned_mentor AS to_mentor,
      is_from_student
    FROM slack_messages
  `);

  await knex.raw(`DROP VIEW IF EXISTS students_n8n CASCADE`);
  await knex.raw(`
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
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP VIEW IF EXISTS students_n8n`);
  await knex.raw(`DROP VIEW IF EXISTS slack_messages_n8n`);
  await knex.raw(`DROP VIEW IF EXISTS login_events_n8n`);
  await knex.raw(`DROP VIEW IF EXISTS mentors_n8n`);
  await knex.raw(`DROP FUNCTION IF EXISTS app_as_of()`);
}

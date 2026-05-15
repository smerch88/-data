/**
 * Migration: add two more student-level metric VIEWs over slack_messages.
 *
 *  5. student_last_message_stats  — last student-sent message date + days ago.
 *                                   Fixes a bug in the hand-written version on
 *                                   the VPS where `WHERE is_from_student=true`
 *                                   AFTER a LEFT JOIN silently dropped students
 *                                   with no messages. Filter is moved into the
 *                                   ON clause so silent students keep NULLs.
 *
 *  6. student_wrote_to_mentor     — boolean: did the student ever send a
 *                                   message with mentioned_mentor=true.
 *
 * DROP VIEW IF EXISTS CASCADE first to override any hand-created legacy
 * version that might exist on the target DB.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`DROP VIEW IF EXISTS student_last_message_stats CASCADE`);
  await knex.raw(`DROP VIEW IF EXISTS student_wrote_to_mentor CASCADE`);

  // 5. last_message_stats — filter is in ON, not WHERE, so LEFT JOIN holds.
  await knex.raw(`
    CREATE VIEW student_last_message_stats AS
    SELECT
      s.id   AS student_id,
      s.name AS name,
      MAX(sm.sent_at) AS last_message_date,
      CASE
        WHEN MAX(sm.sent_at) IS NULL THEN NULL
        ELSE (CURRENT_DATE - MAX(sm.sent_at)::date)
      END AS last_message_days_ago
    FROM students s
    LEFT JOIN slack_messages sm
      ON s.id = sm.student_id
     AND sm.is_from_student = TRUE
    GROUP BY s.id, s.name
  `);

  // 6. wrote_to_mentor — kept verbatim from the VPS version; correct as-is.
  await knex.raw(`
    CREATE VIEW student_wrote_to_mentor AS
    SELECT
      s.id   AS student_id,
      s.name AS name,
      EXISTS (
        SELECT 1
        FROM slack_messages sm
        WHERE sm.student_id = s.id
          AND sm.mentioned_mentor = TRUE
      ) AS wrote_to_mentor
    FROM students s
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP VIEW IF EXISTS student_wrote_to_mentor`);
  await knex.raw(`DROP VIEW IF EXISTS student_last_message_stats`);
}

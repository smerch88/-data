/**
 * Migration: create 4 student-level metric VIEWs over homework.
 *
 * Trello task 1 "key calculations". These are computed-on-read VIEWs (NOT
 * materialized) — they always reflect current homework rows.
 *
 *  1. student_missed_homework_count    — COUNT(*) where homework.status='missed'
 *  2. student_late_homework_count      — COUNT(*) where submitted_at > deadline
 *  3. student_submission_timing_shift  — (avg delay in 2nd half of course) -
 *                                         (avg delay in 1st half), in days
 *  4. student_avg_grade                — AVG(homework.grade) across graded rows
 *
 * Every view does LEFT JOIN on students, so students with no homework still
 * appear (with NULL/0 metrics).
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. missed_homework_count
  await knex.raw(`
    CREATE OR REPLACE VIEW student_missed_homework_count AS
    SELECT
      s.id   AS student_id,
      s.name AS name,
      COUNT(h.id) AS missed_homework_count
    FROM students s
    LEFT JOIN homework h
      ON s.id = h.student_id
     AND h.status = 'missed'
    GROUP BY s.id, s.name
  `);

  // 2. late_homework_count
  await knex.raw(`
    CREATE OR REPLACE VIEW student_late_homework_count AS
    SELECT
      s.id   AS student_id,
      s.name AS name,
      COUNT(h.id) AS late_homework_count
    FROM students s
    LEFT JOIN homework h
      ON s.id = h.student_id
     AND h.submitted_at IS NOT NULL
     AND h.submitted_at > h.deadline
    GROUP BY s.id, s.name
  `);

  // 3. submission_timing_shift
  // delay_days is integer (submitted_at::date - deadline). The view returns
  // numeric averages so downstream JSON serializes as numbers, not Postgres
  // intervals.
  await knex.raw(`
    CREATE OR REPLACE VIEW student_submission_timing_shift AS
    WITH ranked_homework AS (
      SELECT
        student_id,
        submitted_at,
        deadline,
        (submitted_at::date - deadline) AS delay_days,
        ROW_NUMBER() OVER (
          PARTITION BY student_id
          ORDER BY submitted_at
        ) AS rn,
        COUNT(*) OVER (
          PARTITION BY student_id
        ) AS total_cnt
      FROM homework
      WHERE submitted_at IS NOT NULL
    )
    SELECT
      s.id   AS student_id,
      s.name AS name,
      AVG(CASE WHEN rn <= total_cnt * 0.5 THEN delay_days END)::numeric(10,2) AS early_avg_delay,
      AVG(CASE WHEN rn >  total_cnt * 0.5 THEN delay_days END)::numeric(10,2) AS late_avg_delay,
      (
        AVG(CASE WHEN rn >  total_cnt * 0.5 THEN delay_days END)
        -
        AVG(CASE WHEN rn <= total_cnt * 0.5 THEN delay_days END)
      )::numeric(10,2) AS submission_timing_shift
    FROM students s
    LEFT JOIN ranked_homework h
      ON s.id = h.student_id
    GROUP BY s.id, s.name
  `);

  // 4. avg_grade — averages over graded homework rows
  // (homework.grade is NULL on missed rows; AVG already ignores NULLs).
  await knex.raw(`
    CREATE OR REPLACE VIEW student_avg_grade AS
    SELECT
      s.id   AS student_id,
      s.name AS name,
      AVG(h.grade)::numeric(5,2) AS avg_grade
    FROM students s
    LEFT JOIN homework h
      ON s.id = h.student_id
    GROUP BY s.id, s.name
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP VIEW IF EXISTS student_avg_grade`);
  await knex.raw(`DROP VIEW IF EXISTS student_submission_timing_shift`);
  await knex.raw(`DROP VIEW IF EXISTS student_late_homework_count`);
  await knex.raw(`DROP VIEW IF EXISTS student_missed_homework_count`);
}

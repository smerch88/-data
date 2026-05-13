/**
 * Migration: expand_login_events_per_site
 *
 * This migration wipes login_events because the new NOT NULL column id_site
 * cannot be backfilled — source data was already aggregated to per-day grain
 * and the per-site breakdown is gone. After running `migrate:up` you MUST
 * re-run the seed to repopulate login_events from the raw OULAD data.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // --- Change A: create vle_sites dim table ---

  await knex.schema.createTable('vle_sites', (t) => {
    t.integer('id_site').primary();
    t.text('activity_type').notNullable();
    t.integer('week_from').nullable();
    t.integer('week_to').nullable();
  });

  // --- Change B: expand login_events to per-site grain ---

  // Step 1: drop old unique constraint (student_id, occurred_on)
  await knex.raw(`
    ALTER TABLE login_events
      DROP CONSTRAINT login_events_student_occurred_unique
  `);

  // Step 2: wipe all rows — id_site can't be backfilled; seed must be re-run
  await knex.raw(`DELETE FROM login_events`);

  // Step 3: add id_site as NOT NULL FK to vle_sites (safe because table is empty)
  await knex.raw(`
    ALTER TABLE login_events
      ADD COLUMN id_site INTEGER NOT NULL
        REFERENCES vle_sites (id_site) ON DELETE RESTRICT
  `);

  // Step 4: add new unique constraint at per-site grain
  await knex.raw(`
    ALTER TABLE login_events
      ADD CONSTRAINT login_events_student_site_occurred_unique
        UNIQUE (student_id, id_site, occurred_on)
  `);

  // Step 5: index for FK lookups on id_site
  await knex.raw(`CREATE INDEX idx_login_events_id_site ON login_events (id_site)`);
}

export async function down(knex: Knex): Promise<void> {
  // Reverse order of up steps

  // Step 1: drop per-site index
  await knex.raw(`DROP INDEX idx_login_events_id_site`);

  // Step 2: drop new unique constraint
  await knex.raw(`
    ALTER TABLE login_events
      DROP CONSTRAINT login_events_student_site_occurred_unique
  `);

  // Step 3: drop id_site column (auto-drops the FK to vle_sites)
  await knex.raw(`ALTER TABLE login_events DROP COLUMN id_site`);

  // Step 4: wipe rows — they had id_site; without it they can't satisfy the
  // old (student_id, occurred_on) unique constraint cleanly
  await knex.raw(`DELETE FROM login_events`);

  // Step 5: restore old unique constraint at per-day grain
  await knex.raw(`
    ALTER TABLE login_events
      ADD CONSTRAINT login_events_student_occurred_unique
        UNIQUE (student_id, occurred_on)
  `);

  // Step 6: drop vle_sites dim table
  await knex.schema.dropTableIfExists('vle_sites');
}

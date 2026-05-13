import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // --- Change 1: add slack_id to students ---

  // Step 1: add nullable column
  await knex.schema.alterTable('students', (t) => {
    t.text('slack_id').nullable();
  });

  // Step 2: backfill — 'stud_011391' → 'U011391' (strip 'stud_' prefix, prepend 'U')
  await knex.raw(`UPDATE students SET slack_id = 'U' || substr(id, 6)`);

  // Step 3: tighten to NOT NULL now that every row has a value
  await knex.raw(`ALTER TABLE students ALTER COLUMN slack_id SET NOT NULL`);

  // --- Change 2: create login_events ---

  await knex.schema.createTable('login_events', (t) => {
    t.bigIncrements('id').primary();
    t.text('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    t.date('occurred_on').notNullable();
    t.integer('sum_clicks').notNullable();
  });

  await knex.raw(`
    ALTER TABLE login_events
      ADD CONSTRAINT login_events_student_occurred_unique
        UNIQUE (student_id, occurred_on)
  `);

  await knex.raw(`CREATE INDEX idx_login_events_student_id ON login_events (student_id)`);
  await knex.raw(`CREATE INDEX idx_login_events_occurred_on ON login_events (occurred_on)`);
}

export async function down(knex: Knex): Promise<void> {
  // Drop login_events first — it has a FK pointing at students
  await knex.schema.dropTableIfExists('login_events');

  await knex.schema.alterTable('students', (t) => {
    t.dropColumn('slack_id');
  });
}

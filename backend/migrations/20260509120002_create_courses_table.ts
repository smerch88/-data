import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('courses', (t) => {
    t.text('id').primary();
    t.text('name').notNullable();
    t.integer('total_modules').notNullable();
    t.integer('duration_weeks').notNullable();
    t.text('format').notNullable();
  });

  await knex.raw(`
    ALTER TABLE courses
      ADD CONSTRAINT courses_format_check
        CHECK (format IN ('bootcamp', 'self_paced', 'live'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('courses');
}

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('students', (t) => {
    t.text('id').primary();
    t.text('name').notNullable();
    t.text('email').notNullable();
    t.text('course_id').notNullable().references('id').inTable('courses').onDelete('RESTRICT');
    t.text('mentor_id').notNullable().references('id').inTable('mentors').onDelete('RESTRICT');
    t.date('enrollment_date').notNullable();
    t.integer('current_module').notNullable();
    t.text('status').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE students
      ADD CONSTRAINT students_status_check
        CHECK (status IN ('active', 'paused', 'dropped', 'completed'))
  `);

  await knex.raw(`CREATE INDEX idx_students_status ON students (status)`);
  await knex.raw(`CREATE INDEX idx_students_course_id ON students (course_id)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('students');
}

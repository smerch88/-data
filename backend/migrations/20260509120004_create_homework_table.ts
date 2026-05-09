import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('homework', (t) => {
    t.bigIncrements('id').primary();
    t.text('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    t.text('hw_id').notNullable();
    t.integer('module').notNullable();
    t.text('title').notNullable();
    t.text('topic').notNullable();
    t.date('deadline').notNullable();
    t.timestamp('submitted_at', { useTz: true }).nullable();
    t.text('status').notNullable();
    t.integer('grade').nullable();
  });

  await knex.raw(`
    ALTER TABLE homework
      ADD CONSTRAINT homework_status_check
        CHECK (status IN ('missed', 'late', 'submitted', 'graded'))
  `);

  await knex.raw(`CREATE INDEX idx_homework_student_id ON homework (student_id)`);
  await knex.raw(`CREATE INDEX idx_homework_deadline ON homework (deadline)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('homework');
}

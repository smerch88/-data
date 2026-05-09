import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('mentors', (t) => {
    t.text('id').primary();
    t.text('name').notNullable();
    t.text('slack_id').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mentors');
}

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('slack_messages', (t) => {
    t.bigIncrements('id').primary();
    t.text('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    t.text('channel_type').notNullable();
    t.boolean('is_from_student').notNullable();
    t.text('message_text').notNullable();
    t.timestamp('sent_at', { useTz: true }).notNullable();
    t.boolean('mentioned_mentor').notNullable().defaultTo(false);
  });

  await knex.raw(`
    ALTER TABLE slack_messages
      ADD CONSTRAINT slack_messages_channel_type_check
        CHECK (channel_type IN ('mentor_dm', 'group_chat', 'support_chat'))
  `);

  await knex.raw(`CREATE INDEX idx_slack_messages_student_id ON slack_messages (student_id)`);
  await knex.raw(`CREATE INDEX idx_slack_messages_sent_at ON slack_messages (sent_at)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('slack_messages');
}

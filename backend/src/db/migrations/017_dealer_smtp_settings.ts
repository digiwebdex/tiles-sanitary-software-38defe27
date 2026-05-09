import type { Knex } from 'knex';

/**
 * Per-dealer SMTP configuration so each tenant can use their own
 * outgoing email server (Gmail App Pass, business SMTP, etc.).
 * Falls back to the global env-level SMTP if no row exists.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dealer_smtp_settings', (t) => {
    t.uuid('dealer_id').primary().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('host', 255).notNullable();
    t.integer('port').notNullable().defaultTo(587);
    t.boolean('secure').notNullable().defaultTo(false); // SSL/TLS
    t.string('username', 255).notNullable();
    t.text('password').notNullable(); // stored as-is (consider KMS later)
    t.string('from_name', 255).nullable();
    t.string('from_email', 255).notNullable();
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dealer_smtp_settings');
}

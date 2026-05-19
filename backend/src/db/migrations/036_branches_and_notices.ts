import type { Knex } from 'knex';

/**
 * Phase 8: Manage Branch + Notice Setup.
 *
 *   branches      — dealer's physical branch / outlet directory
 *   notices       — system-wide notices/announcements shown to staff
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('branches', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('code', 32).notNullable();
    t.string('name', 200).notNullable();
    t.text('address');
    t.string('phone', 50);
    t.string('email', 200);
    t.string('manager_name', 200);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('is_default').notNullable().defaultTo(false);
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'code']);
    t.index(['dealer_id', 'is_active']);
  });

  await knex.schema.createTable('notices', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.text('body').notNullable();
    t.string('severity', 20).notNullable().defaultTo('info'); // info | warning | critical
    t.string('audience', 20).notNullable().defaultTo('all');   // all | admin | manager | accountant | salesman
    t.date('start_date');
    t.date('end_date');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('pinned').notNullable().defaultTo(false);
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'is_active']);
    t.index(['dealer_id', 'pinned']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notices');
  await knex.schema.dropTableIfExists('branches');
}

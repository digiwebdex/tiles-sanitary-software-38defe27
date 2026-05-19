import type { Knex } from 'knex';

/**
 * Phase 14 — Shift Management
 *
 *   shifts                per-dealer shift templates (start/end time, grace, working days)
 *   employees.shift_id    optional FK to default shift for the employee
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shifts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('code', 32).notNullable();
    t.string('name', 100).notNullable();
    t.string('start_time', 8).notNullable(); // HH:MM
    t.string('end_time', 8).notNullable();
    t.integer('grace_minutes').notNullable().defaultTo(10);
    t.integer('half_day_after_minutes').notNullable().defaultTo(120); // late > X => half day
    // Working days bitmap: comma-separated weekday indices 0=Sun..6=Sat. Default Sun-Thu.
    t.string('working_days', 32).notNullable().defaultTo('0,1,2,3,4,6');
    t.string('color', 16).defaultTo('#f59e0b');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'code']);
    t.index(['dealer_id', 'is_active']);
  });

  await knex.schema.alterTable('employees', (t) => {
    t.uuid('shift_id').references('id').inTable('shifts').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('employees', (t) => {
    t.dropColumn('shift_id');
  });
  await knex.schema.dropTableIfExists('shifts');
}

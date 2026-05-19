import type { Knex } from 'knex';

/**
 * Phase 9 — Employee Leave Management
 *
 *   leave_types       per-dealer leave categories with annual quota (e.g. Casual, Sick, Annual)
 *   leave_balances    per-employee per-year per-type running balance
 *   leave_requests    requests with approval workflow (pending/approved/rejected/cancelled)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('leave_types', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('code', 32).notNullable();
    t.string('name', 100).notNullable();
    t.integer('annual_quota').notNullable().defaultTo(0); // total days per year
    t.boolean('is_paid').notNullable().defaultTo(true);
    t.string('color', 16).defaultTo('#3b82f6');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'code']);
    t.index(['dealer_id', 'is_active']);
  });

  await knex.schema.createTable('leave_balances', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.uuid('leave_type_id').notNullable().references('id').inTable('leave_types').onDelete('CASCADE');
    t.integer('year').notNullable();
    t.decimal('allocated', 6, 2).notNullable().defaultTo(0);
    t.decimal('used', 6, 2).notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['employee_id', 'leave_type_id', 'year']);
    t.index(['dealer_id', 'employee_id', 'year']);
  });

  await knex.schema.createTable('leave_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.uuid('leave_type_id').notNullable().references('id').inTable('leave_types').onDelete('RESTRICT');
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.decimal('days', 6, 2).notNullable().defaultTo(0);
    t.text('reason');
    t.string('status', 20).notNullable().defaultTo('pending'); // pending | approved | rejected | cancelled
    t.uuid('decided_by');
    t.timestamp('decided_at', { useTz: true });
    t.text('decision_note');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'status']);
    t.index(['dealer_id', 'employee_id']);
    t.index(['dealer_id', 'start_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('leave_requests');
  await knex.schema.dropTableIfExists('leave_balances');
  await knex.schema.dropTableIfExists('leave_types');
}

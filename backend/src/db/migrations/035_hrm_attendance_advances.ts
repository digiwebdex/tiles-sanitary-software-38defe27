import type { Knex } from 'knex';

/**
 * Phase 7: HRM attendance + salary advances.
 *
 *   employee_attendance      — daily attendance (present | absent | leave | half | late)
 *   salary_advances          — cash/bank advances to employees, deducted from payroll
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('employee_attendance', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.date('att_date').notNullable();
    t.string('status', 20).notNullable(); // present | absent | leave | half | late
    t.string('check_in', 8);   // HH:MM
    t.string('check_out', 8);
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'employee_id', 'att_date']);
    t.index(['dealer_id', 'att_date']);
  });

  await knex.schema.createTable('salary_advances', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('RESTRICT');
    t.decimal('amount', 14, 2).notNullable();
    t.decimal('settled_amount', 14, 2).notNullable().defaultTo(0);
    t.string('payment_method', 20).notNullable().defaultTo('cash');
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.date('issue_date').notNullable().defaultTo(knex.fn.now());
    t.string('status', 20).notNullable().defaultTo('open'); // open | settled | cancelled
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'employee_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('salary_advances');
  await knex.schema.dropTableIfExists('employee_attendance');
}

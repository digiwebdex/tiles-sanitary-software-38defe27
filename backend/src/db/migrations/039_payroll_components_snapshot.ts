import type { Knex } from 'knex';

/**
 * Phase 11: Payroll Integration
 *
 * Extend salary_payments to capture component breakdown when paying salary
 * with auto-applied allowances/deductions (from Phase 10 salary_components).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('salary_payments', (t) => {
    t.decimal('components_allowance', 14, 2).notNullable().defaultTo(0);
    t.decimal('components_deduction', 14, 2).notNullable().defaultTo(0);
    t.jsonb('components_snapshot'); // [{component_id, code, name, kind, amount}]
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('salary_payments', (t) => {
    t.dropColumn('components_allowance');
    t.dropColumn('components_deduction');
    t.dropColumn('components_snapshot');
  });
}

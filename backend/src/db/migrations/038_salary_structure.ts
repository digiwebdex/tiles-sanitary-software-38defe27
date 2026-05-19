import type { Knex } from 'knex';

/**
 * Phase 10: Salary Structure
 *
 *   salary_components            — dealer-level library of allowances & deductions
 *   employee_salary_components   — per-employee assignments (overrides default amounts)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('salary_components', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('code', 32).notNullable();
    t.string('name', 200).notNullable();
    t.enu('kind', ['allowance', 'deduction'], { useNative: true, enumName: 'salary_component_kind' }).notNullable();
    t.enu('calc', ['fixed', 'percent_basic'], { useNative: true, enumName: 'salary_component_calc' }).notNullable().defaultTo('fixed');
    t.decimal('default_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('default_percent', 6, 3).notNullable().defaultTo(0);
    t.boolean('is_taxable').notNullable().defaultTo(true);
    t.boolean('active').notNullable().defaultTo(true);
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'code']);
    t.index(['dealer_id', 'active']);
  });

  await knex.schema.createTable('employee_salary_components', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.uuid('component_id').notNullable().references('id').inTable('salary_components').onDelete('CASCADE');
    t.decimal('amount_override', 14, 2);   // null = use component default
    t.decimal('percent_override', 6, 3);   // null = use component default
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['employee_id', 'component_id']);
    t.index(['dealer_id', 'employee_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('employee_salary_components');
  await knex.schema.dropTableIfExists('salary_components');
  await knex.raw('DROP TYPE IF EXISTS salary_component_calc');
  await knex.raw('DROP TYPE IF EXISTS salary_component_kind');
}

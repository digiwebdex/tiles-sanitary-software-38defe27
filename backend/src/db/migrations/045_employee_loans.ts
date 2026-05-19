import type { Knex } from 'knex';

/**
 * Phase 19 — Employee Loan & EMI Tracker
 *
 *   employee_loans         loan headers (principal, tenure, status)
 *   employee_loan_emis     pre-generated installment schedule + repayment tracking
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('employee_loans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.string('loan_code', 40).notNullable();
    t.decimal('principal', 14, 2).notNullable();
    t.integer('tenure_months').notNullable();
    t.decimal('emi_amount', 12, 2).notNullable();
    t.date('issue_date').notNullable();
    t.date('first_emi_date').notNullable();
    t.string('payment_method', 16).notNullable().defaultTo('cash'); // cash | bank
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.string('status', 16).notNullable().defaultTo('active'); // active | closed | cancelled
    t.text('reason');
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'loan_code']);
    t.index(['dealer_id', 'employee_id']);
    t.index(['dealer_id', 'status']);
  });

  await knex.schema.createTable('employee_loan_emis', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('loan_id').notNullable().references('id').inTable('employee_loans').onDelete('CASCADE');
    t.integer('installment_no').notNullable();
    t.date('due_date').notNullable();
    t.decimal('amount_due', 12, 2).notNullable();
    t.decimal('amount_paid', 12, 2).notNullable().defaultTo(0);
    t.date('paid_date');
    t.string('status', 16).notNullable().defaultTo('pending'); // pending | partial | paid | waived
    t.string('payment_source', 24); // salary_deduction | manual | cash | bank
    t.string('reference', 80); // salary period (YYYY-MM) or txn ref
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['loan_id', 'installment_no']);
    t.index(['dealer_id', 'status', 'due_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('employee_loan_emis');
  await knex.schema.dropTableIfExists('employee_loans');
}

import type { Knex } from 'knex';

/**
 * P4 — EMI (Equated Monthly Installment) plans.
 *
 *   emi_plans      — header: principal, tenure, start_date, status
 *   emi_schedule   — generated monthly installments with due_date + paid tracking
 *
 * Feeds EMI Details Report and overdue-alert notifications.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('emi_plans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().index();
    t.string('plan_no', 50).notNullable();
    t.uuid('customer_id').notNullable().index();
    t.uuid('sale_id').nullable().index();
    t.decimal('principal', 18, 2).notNullable();
    t.integer('tenure_months').notNullable();
    t.decimal('installment_amount', 18, 2).notNullable();
    t.date('start_date').notNullable();
    t.string('status', 20).notNullable().defaultTo('active'); // active | closed | cancelled
    t.text('narration').nullable();
    t.uuid('created_by').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'plan_no']);
    t.index(['dealer_id', 'status']);
  });

  await knex.schema.createTable('emi_schedule', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('plan_id').notNullable()
      .references('id').inTable('emi_plans').onDelete('CASCADE');
    t.uuid('dealer_id').notNullable().index();
    t.integer('installment_no').notNullable();
    t.date('due_date').notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.decimal('paid_amount', 18, 2).notNullable().defaultTo(0);
    t.date('paid_date').nullable();
    t.string('status', 20).notNullable().defaultTo('pending'); // pending | paid | partial | overdue
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['plan_id', 'installment_no']);
    t.index(['dealer_id', 'due_date']);
    t.index(['dealer_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('emi_schedule');
  await knex.schema.dropTableIfExists('emi_plans');
}

import type { Knex } from 'knex';

/**
 * P3 — Manual journal entries (double-entry bookkeeping).
 *
 *   journal_entries        — header (voucher_no, narration, entry_date)
 *   journal_entry_lines    — debit/credit lines per account
 *
 * Used for adjustments, opening balances, accruals, and feeds the Trial Balance.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('journal_entries', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().index();
    t.string('voucher_no', 50).notNullable();
    t.date('entry_date').notNullable();
    t.text('narration').nullable();
    t.uuid('created_by').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'voucher_no']);
    t.index(['dealer_id', 'entry_date']);
  });

  await knex.schema.createTable('journal_entry_lines', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('journal_entry_id').notNullable()
      .references('id').inTable('journal_entries').onDelete('CASCADE');
    t.uuid('dealer_id').notNullable().index();
    t.string('account', 100).notNullable();
    t.decimal('debit', 18, 2).notNullable().defaultTo(0);
    t.decimal('credit', 18, 2).notNullable().defaultTo(0);
    t.text('line_narration').nullable();
    t.integer('line_order').notNullable().defaultTo(0);
    t.index(['dealer_id', 'account']);
    t.index('journal_entry_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('journal_entry_lines');
  await knex.schema.dropTableIfExists('journal_entries');
}

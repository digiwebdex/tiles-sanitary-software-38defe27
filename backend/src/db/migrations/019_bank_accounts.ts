import type { Knex } from 'knex';

/**
 * Multi-Bank Account support.
 *
 *   bank_accounts  — one row per bank account a dealer holds
 *   bank_ledger    — credit/debit movements on a bank account (parallel to cash_ledger)
 *
 * Cash payments continue to flow through `cash_ledger`. Bank payments now
 * flow through `bank_ledger` referencing a `bank_account_id`. Consolidated
 * Cashbook views can UNION the two when needed.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bank_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('bank_name', 120).notNullable();
    t.string('account_name', 120).notNullable();
    t.string('account_number', 60).notNullable();
    t.string('branch', 120);
    t.string('routing_no', 30);
    t.string('account_type', 30).defaultTo('current'); // current/savings/cc
    t.decimal('opening_balance', 14, 2).notNullable().defaultTo(0);
    t.date('opened_on').defaultTo(knex.fn.now());
    t.boolean('is_active').notNullable().defaultTo(true);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('dealer_id');
    t.unique(['dealer_id', 'account_number']);
  });

  await knex.schema.createTable('bank_ledger', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('bank_account_id').notNullable().references('id').inTable('bank_accounts').onDelete('RESTRICT');
    t.string('type', 40).notNullable(); // deposit | withdrawal | sale | payment | expense | transfer | adjustment | opening_balance
    t.decimal('amount', 14, 2).notNullable(); // signed: + credit, - debit
    t.text('description');
    t.string('reference_type', 50);
    t.uuid('reference_id');
    t.date('entry_date').notNullable().defaultTo(knex.fn.now());
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'bank_account_id']);
    t.index(['dealer_id', 'entry_date']);
  });

  // Seed opening balance ledger entries for any pre-existing accounts (none yet, but trigger for future)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.bank_account_opening_balance_ledger()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance <> 0 THEN
        INSERT INTO public.bank_ledger (
          dealer_id, bank_account_id, type, amount, description, entry_date
        ) VALUES (
          NEW.dealer_id, NEW.id, 'opening_balance', NEW.opening_balance,
          'Opening balance', COALESCE(NEW.opened_on, CURRENT_DATE)
        );
      END IF;
      RETURN NEW;
    END;
    $$;
  `);

  await knex.raw(`
    CREATE TRIGGER trg_bank_account_opening
    AFTER INSERT ON public.bank_accounts
    FOR EACH ROW EXECUTE FUNCTION public.bank_account_opening_balance_ledger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TRIGGER IF EXISTS trg_bank_account_opening ON public.bank_accounts');
  await knex.raw('DROP FUNCTION IF EXISTS public.bank_account_opening_balance_ledger()');
  await knex.schema.dropTableIfExists('bank_ledger');
  await knex.schema.dropTableIfExists('bank_accounts');
}

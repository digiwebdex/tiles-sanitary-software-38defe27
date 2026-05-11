import type { Knex } from 'knex';

/**
 * Phase 2: HRM + Director/Investor + Warehouse modules.
 *
 *   employees             — staff register
 *   salary_structures     — basic + allowance % per employee (current effective row)
 *   salary_payments       — monthly disbursement (also pushes to cash_ledger)
 *   directors             — director/investor register
 *   director_transactions — deposit/withdrawal/dividend (also cashbook posting)
 *   warehouses            — godown register
 *   warehouse_transfers   — in/out/transfer movements with optional cost expense
 */
export async function up(knex: Knex): Promise<void> {
  // ── HRM ──
  await knex.schema.createTable('employees', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('employee_code', 30);
    t.string('name', 120).notNullable();
    t.string('designation', 80);
    t.string('department', 80);
    t.string('phone', 30);
    t.string('email', 120);
    t.string('nid', 30);
    t.text('address');
    t.date('joining_date');
    t.string('status', 20).notNullable().defaultTo('active'); // active | inactive | terminated
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('dealer_id');
    t.unique(['dealer_id', 'employee_code']);
  });

  await knex.schema.createTable('salary_structures', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.decimal('basic', 14, 2).notNullable().defaultTo(0);
    t.decimal('house_rent_pct', 6, 2).notNullable().defaultTo(0);     // % of basic
    t.decimal('medical_pct', 6, 2).notNullable().defaultTo(0);
    t.decimal('transport_pct', 6, 2).notNullable().defaultTo(0);
    t.decimal('other_allowance', 14, 2).notNullable().defaultTo(0);    // flat
    t.decimal('deduction', 14, 2).notNullable().defaultTo(0);          // flat
    t.date('effective_from').notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'employee_id']);
  });

  await knex.schema.createTable('salary_payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('RESTRICT');
    t.string('period', 7).notNullable();   // YYYY-MM
    t.decimal('basic', 14, 2).notNullable().defaultTo(0);
    t.decimal('house_rent', 14, 2).notNullable().defaultTo(0);
    t.decimal('medical', 14, 2).notNullable().defaultTo(0);
    t.decimal('transport', 14, 2).notNullable().defaultTo(0);
    t.decimal('other_allowance', 14, 2).notNullable().defaultTo(0);
    t.decimal('deduction', 14, 2).notNullable().defaultTo(0);
    t.decimal('net_payable', 14, 2).notNullable().defaultTo(0);
    t.string('payment_method', 20).notNullable().defaultTo('cash');    // cash | bank
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.date('payment_date').notNullable().defaultTo(knex.fn.now());
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'employee_id', 'period']);
    t.index(['dealer_id', 'period']);
  });

  // ── Directors / Investors ──
  await knex.schema.createTable('directors', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('name', 120).notNullable();
    t.string('role', 60); // Director / Investor / Partner
    t.string('phone', 30);
    t.string('email', 120);
    t.text('address');
    t.decimal('share_pct', 6, 2).defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('dealer_id');
  });

  await knex.schema.createTable('director_transactions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('director_id').notNullable().references('id').inTable('directors').onDelete('RESTRICT');
    t.string('type', 20).notNullable();    // deposit | withdrawal | dividend
    t.decimal('amount', 14, 2).notNullable(); // always positive
    t.string('payment_method', 20).notNullable().defaultTo('cash');  // cash | bank
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.date('entry_date').notNullable().defaultTo(knex.fn.now());
    t.text('description');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'director_id']);
    t.index(['dealer_id', 'entry_date']);
  });

  // ── Warehouses ──
  await knex.schema.createTable('warehouses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('name', 120).notNullable();
    t.string('code', 30);
    t.text('address');
    t.string('manager_name', 120);
    t.string('manager_phone', 30);
    t.boolean('is_default').notNullable().defaultTo(false);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'code']);
    t.index('dealer_id');
  });

  await knex.schema.createTable('warehouse_transfers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('transfer_no', 30);
    t.uuid('from_warehouse_id').references('id').inTable('warehouses').onDelete('SET NULL');
    t.uuid('to_warehouse_id').references('id').inTable('warehouses').onDelete('SET NULL');
    t.uuid('product_id').references('id').inTable('products').onDelete('SET NULL');
    t.string('product_name_snapshot', 200);
    t.decimal('quantity', 14, 3).notNullable().defaultTo(0);
    t.string('unit', 20).defaultTo('pc');
    t.decimal('transport_cost', 14, 2).notNullable().defaultTo(0);
    t.string('payment_method', 20).defaultTo('cash');  // for transport_cost
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.date('transfer_date').notNullable().defaultTo(knex.fn.now());
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'transfer_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('warehouse_transfers');
  await knex.schema.dropTableIfExists('warehouses');
  await knex.schema.dropTableIfExists('director_transactions');
  await knex.schema.dropTableIfExists('directors');
  await knex.schema.dropTableIfExists('salary_payments');
  await knex.schema.dropTableIfExists('salary_structures');
  await knex.schema.dropTableIfExists('employees');
}

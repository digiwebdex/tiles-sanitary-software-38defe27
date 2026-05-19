import type { Knex } from 'knex';

/**
 * Phase 5: Warehouse transfer request/approval workflow + SQFT awareness.
 *  status: requested | approved | rejected | received | cancelled
 *  qty_sqft: optional SQFT-equivalent (for tiles) tracked alongside box/piece quantity
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('warehouse_transfers', (t) => {
    t.string('status', 20).notNullable().defaultTo('received');
    t.decimal('qty_sqft', 14, 3).notNullable().defaultTo(0);
    t.uuid('requested_by');
    t.timestamp('requested_at', { useTz: true });
    t.uuid('approved_by');
    t.timestamp('approved_at', { useTz: true });
    t.uuid('received_by');
    t.timestamp('received_at', { useTz: true });
    t.text('reject_reason');
  });
  // backfill existing rows: treat them as already received
  await knex('warehouse_transfers')
    .whereNull('received_at')
    .update({ status: 'received', received_at: knex.fn.now() });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('warehouse_transfers', (t) => {
    t.dropColumn('status');
    t.dropColumn('qty_sqft');
    t.dropColumn('requested_by');
    t.dropColumn('requested_at');
    t.dropColumn('approved_by');
    t.dropColumn('approved_at');
    t.dropColumn('received_by');
    t.dropColumn('received_at');
    t.dropColumn('reject_reason');
  });
}

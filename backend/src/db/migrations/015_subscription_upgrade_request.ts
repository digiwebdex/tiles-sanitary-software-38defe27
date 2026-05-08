import type { Knex } from 'knex';

/**
 * Adds optional columns on subscription_payments so a dealer-side
 * upgrade request can flow through the same table the super admin
 * already reviews. Idempotent.
 */
export async function up(knex: Knex): Promise<void> {
  const has = (col: string) => knex.schema.hasColumn('subscription_payments', col);

  if (!(await has('requested_plan_id'))) {
    await knex.schema.alterTable('subscription_payments', (t) => {
      t.uuid('requested_plan_id').nullable().references('id').inTable('plans').onDelete('SET NULL');
    });
  }
  if (!(await has('requested_billing_cycle'))) {
    await knex.schema.alterTable('subscription_payments', (t) => {
      t.string('requested_billing_cycle', 20).nullable();
    });
  }
  if (!(await has('source'))) {
    await knex.schema.alterTable('subscription_payments', (t) => {
      // 'super_admin' (default) | 'dealer_request'
      t.string('source', 30).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('subscription_payments', (t) => {
    t.dropColumn('requested_plan_id');
    t.dropColumn('requested_billing_cycle');
    t.dropColumn('source');
  });
}

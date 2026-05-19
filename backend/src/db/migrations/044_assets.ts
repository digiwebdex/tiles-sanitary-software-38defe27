import type { Knex } from 'knex';

/**
 * Phase 18 — Asset Assignment Tracking
 *
 *   assets               company-owned asset catalog
 *   asset_assignments    immutable assignment history (assign + return events)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('assets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('tag', 60).notNullable(); // e.g. LAP-001
    t.string('name', 200).notNullable();
    t.string('category', 60); // laptop | phone | vehicle | furniture | tool | other
    t.string('serial_no', 120);
    t.string('brand', 80);
    t.string('model', 120);
    t.date('purchase_date');
    t.decimal('purchase_cost', 12, 2).defaultTo(0);
    t.string('condition', 16).notNullable().defaultTo('good'); // new|good|fair|damaged|lost
    t.string('status', 16).notNullable().defaultTo('available'); // available|assigned|retired|lost
    t.uuid('assigned_to').references('id').inTable('employees').onDelete('SET NULL');
    t.date('assigned_at');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'tag']);
    t.index(['dealer_id', 'status']);
    t.index(['dealer_id', 'assigned_to']);
  });

  await knex.schema.createTable('asset_assignments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.date('assigned_date').notNullable();
    t.date('returned_date');
    t.string('condition_at_assignment', 16);
    t.string('condition_at_return', 16);
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'asset_id']);
    t.index(['dealer_id', 'employee_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('asset_assignments');
  await knex.schema.dropTableIfExists('assets');
}

import type { Knex } from 'knex';

/**
 * Phase 16 — Performance Reviews & KPIs
 *
 *   performance_reviews   periodic review header (per employee, per period)
 *   performance_kpis      weighted KPI line items per review
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('performance_reviews', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.string('period', 16).notNullable(); // e.g. 2026-Q1 or 2026-05
    t.string('reviewer', 120);
    t.decimal('overall_rating', 5, 2).notNullable().defaultTo(0); // 0..100
    t.string('grade', 8); // A+, A, B, C, D
    t.text('strengths');
    t.text('improvements');
    t.text('comments');
    t.string('status', 16).notNullable().defaultTo('draft'); // draft | finalized
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'employee_id', 'period']);
    t.index(['dealer_id', 'period']);
  });

  await knex.schema.createTable('performance_kpis', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('review_id').notNullable().references('id').inTable('performance_reviews').onDelete('CASCADE');
    t.string('kpi_name', 120).notNullable();
    t.decimal('weight', 5, 2).notNullable().defaultTo(0); // % weight (sum should ~100)
    t.decimal('target', 18, 2).notNullable().defaultTo(0);
    t.decimal('achieved', 18, 2).notNullable().defaultTo(0);
    t.decimal('score', 5, 2).notNullable().defaultTo(0); // 0..100
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['review_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('performance_kpis');
  await knex.schema.dropTableIfExists('performance_reviews');
}

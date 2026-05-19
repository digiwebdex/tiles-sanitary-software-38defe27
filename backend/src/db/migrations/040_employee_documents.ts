import type { Knex } from 'knex';

/**
 * Phase 13 — Employee Documents
 *
 *   employee_documents  per-employee file/document metadata with expiry tracking
 *                       Stores URL pointing to /uploads/... or external link.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('employee_documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.string('doc_type', 50).notNullable(); // nid, passport, contract, certificate, photo, other
    t.string('title', 200).notNullable();
    t.string('doc_number', 100); // e.g. NID number
    t.string('file_url', 1000);
    t.date('issue_date');
    t.date('expiry_date');
    t.text('notes');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'employee_id']);
    t.index(['dealer_id', 'expiry_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('employee_documents');
}

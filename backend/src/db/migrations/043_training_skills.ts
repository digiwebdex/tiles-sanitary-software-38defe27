import type { Knex } from 'knex';

/**
 * Phase 17 — Training & Skill Matrix
 *
 *   skills                 dealer-scoped skill catalog
 *   employee_skills        proficiency per employee per skill (1..5)
 *   training_programs      training courses
 *   training_enrollments   per-employee enrollment + completion tracking
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('skills', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('code', 32).notNullable();
    t.string('name', 120).notNullable();
    t.string('category', 60); // technical | soft | sales | product | other
    t.text('description');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['dealer_id', 'code']);
    t.index(['dealer_id', 'is_active']);
  });

  await knex.schema.createTable('employee_skills', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.uuid('skill_id').notNullable().references('id').inTable('skills').onDelete('CASCADE');
    t.integer('proficiency').notNullable().defaultTo(1); // 1=Beginner..5=Expert
    t.date('last_assessed');
    t.string('assessed_by', 120);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['employee_id', 'skill_id']);
    t.index(['dealer_id', 'employee_id']);
    t.index(['dealer_id', 'skill_id']);
  });

  await knex.schema.createTable('training_programs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.text('description');
    t.string('trainer', 120);
    t.string('mode', 20).defaultTo('in_person'); // in_person | online | hybrid
    t.decimal('duration_hours', 6, 2).defaultTo(0);
    t.decimal('cost', 12, 2).defaultTo(0);
    t.date('start_date');
    t.date('end_date');
    t.string('status', 16).notNullable().defaultTo('planned'); // planned | ongoing | completed | cancelled
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['dealer_id', 'status']);
  });

  await knex.schema.createTable('training_enrollments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('program_id').notNullable().references('id').inTable('training_programs').onDelete('CASCADE');
    t.uuid('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.string('status', 16).notNullable().defaultTo('enrolled'); // enrolled | in_progress | completed | dropped
    t.decimal('score', 5, 2); // 0..100
    t.date('completed_date');
    t.string('certificate_url', 500);
    t.text('feedback');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['program_id', 'employee_id']);
    t.index(['dealer_id', 'employee_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('training_enrollments');
  await knex.schema.dropTableIfExists('training_programs');
  await knex.schema.dropTableIfExists('employee_skills');
  await knex.schema.dropTableIfExists('skills');
}

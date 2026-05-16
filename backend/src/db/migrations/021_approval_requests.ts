import type { Knex } from 'knex';

/**
 * Phase 3S: Approval workflow tables + RPCs.
 *
 *   approval_requests  — fingerprinted approval control for risky actions
 *   approval_settings  — per-dealer toggles + thresholds
 *
 * RPCs: decide_approval_request, consume_approval_request,
 *       cancel_approval_request, expire_stale_approvals
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('approval_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.string('approval_type', 64).notNullable();
    t.string('status', 24).notNullable().defaultTo('pending');
    t.string('action_hash', 128).notNullable();
    t.jsonb('context_data').notNullable().defaultTo('{}');
    t.text('reason');
    t.string('source_type', 64).notNullable();
    t.uuid('source_id');
    t.uuid('requested_by');
    t.uuid('decided_by');
    t.timestamp('decided_at', { useTz: true });
    t.text('decision_note');
    t.timestamp('consumed_at', { useTz: true });
    t.uuid('consumed_by');
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(['dealer_id', 'status']);
    t.index(['dealer_id', 'created_at']);
    t.index(['dealer_id', 'approval_type']);
  });

  await knex.schema.createTable('approval_settings', (t) => {
    t.uuid('dealer_id').primary().references('id').inTable('dealers').onDelete('CASCADE');
    t.boolean('require_backorder_approval').notNullable().defaultTo(true);
    t.boolean('require_mixed_shade_approval').notNullable().defaultTo(true);
    t.boolean('require_mixed_caliber_approval').notNullable().defaultTo(true);
    t.boolean('require_credit_override_approval').notNullable().defaultTo(true);
    t.boolean('require_overdue_override_approval').notNullable().defaultTo(true);
    t.boolean('require_stock_adjustment_approval').notNullable().defaultTo(false);
    t.boolean('require_sale_cancel_approval').notNullable().defaultTo(true);
    t.decimal('discount_approval_threshold', 6, 2).notNullable().defaultTo(10);
    t.boolean('auto_approve_for_admins').notNullable().defaultTo(true);
    t.integer('approval_expiry_hours').notNullable().defaultTo(24);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.decide_approval_request(_id uuid, _decision text, _note text)
    RETURNS void LANGUAGE plpgsql AS $$
    DECLARE r record;
    BEGIN
      SELECT * INTO r FROM approval_requests WHERE id = _id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Approval request not found'; END IF;
      IF r.status <> 'pending' THEN RAISE EXCEPTION 'Approval request is not pending (status=%)', r.status; END IF;
      IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
      UPDATE approval_requests
        SET status = _decision, decided_at = now(), decision_note = _note, updated_at = now()
        WHERE id = _id;
    END $$;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.consume_approval_request(_id uuid, _hash text, _source_id uuid)
    RETURNS void LANGUAGE plpgsql AS $$
    DECLARE r record;
    BEGIN
      SELECT * INTO r FROM approval_requests WHERE id = _id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Approval request not found'; END IF;
      IF r.status NOT IN ('approved','auto_approved') THEN RAISE EXCEPTION 'Approval not in consumable state (status=%)', r.status; END IF;
      IF r.action_hash <> _hash THEN RAISE EXCEPTION 'Action hash mismatch'; END IF;
      IF r.expires_at < now() THEN RAISE EXCEPTION 'Approval expired'; END IF;
      UPDATE approval_requests
        SET status = 'consumed',
            consumed_at = now(),
            source_id = COALESCE(_source_id, source_id),
            updated_at = now()
        WHERE id = _id;
    END $$;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.cancel_approval_request(_id uuid, _reason text)
    RETURNS void LANGUAGE plpgsql AS $$
    DECLARE r record;
    BEGIN
      SELECT * INTO r FROM approval_requests WHERE id = _id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Approval request not found'; END IF;
      IF r.status NOT IN ('pending','approved','auto_approved') THEN RAISE EXCEPTION 'Cannot cancel (status=%)', r.status; END IF;
      UPDATE approval_requests
        SET status = 'cancelled',
            reason = COALESCE(_reason, reason),
            updated_at = now()
        WHERE id = _id;
    END $$;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.expire_stale_approvals(_dealer_id uuid)
    RETURNS int LANGUAGE plpgsql AS $$
    DECLARE c int;
    BEGIN
      UPDATE approval_requests
        SET status = 'expired', updated_at = now()
        WHERE dealer_id = _dealer_id AND status = 'pending' AND expires_at < now();
      GET DIAGNOSTICS c = ROW_COUNT;
      RETURN c;
    END $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP FUNCTION IF EXISTS public.expire_stale_approvals(uuid)');
  await knex.raw('DROP FUNCTION IF EXISTS public.cancel_approval_request(uuid, text)');
  await knex.raw('DROP FUNCTION IF EXISTS public.consume_approval_request(uuid, text, uuid)');
  await knex.raw('DROP FUNCTION IF EXISTS public.decide_approval_request(uuid, text, text)');
  await knex.schema.dropTableIfExists('approval_settings');
  await knex.schema.dropTableIfExists('approval_requests');
}

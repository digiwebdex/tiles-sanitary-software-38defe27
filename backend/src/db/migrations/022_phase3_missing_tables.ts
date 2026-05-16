import { Knex } from 'knex';

/**
 * Phase 3 catch-up migration: creates missing tables/enums/functions/columns that
 * existed in the original Supabase schema but were never ported to the VPS Postgres.
 *
 * Idempotent: uses IF NOT EXISTS / DO blocks so reruns are safe.
 */
export async function up(knex: Knex): Promise<void> {
  // ────────────────────────────────────────────────────────────────────────────
  // 1) Enums
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_type') THEN
        CREATE TYPE public.commission_type AS ENUM ('percent','flat_per_sale','flat_per_unit');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status') THEN
        CREATE TYPE public.commission_status AS ENUM ('pending','earned','settled','cancelled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_source_type') THEN
        CREATE TYPE public.referral_source_type AS ENUM ('fitter','engineer','agent','other');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sample_recipient_type') THEN
        CREATE TYPE public.sample_recipient_type AS ENUM ('customer','prospect','staff','other');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sample_issue_status') THEN
        CREATE TYPE public.sample_issue_status AS ENUM ('issued','partially_returned','returned','damaged','lost','converted');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_message_type') THEN
        CREATE TYPE public.whatsapp_message_type AS ENUM (
          'invoice_share','payment_receipt','delivery_update',
          'overdue_reminder','quotation_share','generic'
        );
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_message_status') THEN
        CREATE TYPE public.whatsapp_message_status AS ENUM ('queued','sent','delivered','failed','skipped');
      END IF;
    END$$;
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 2) projects + project_sites + sequence
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.project_code_sequences (
      dealer_id uuid PRIMARY KEY REFERENCES public.dealers(id) ON DELETE CASCADE,
      next_project_no integer NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
      project_code text NOT NULL,
      project_name text NOT NULL,
      start_date date,
      expected_end_date date,
      status text NOT NULL DEFAULT 'active',
      notes text,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (dealer_id, project_code)
    );
    CREATE INDEX IF NOT EXISTS idx_projects_dealer ON public.projects(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_projects_customer ON public.projects(customer_id);

    CREATE TABLE IF NOT EXISTS public.project_sites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
      site_name text NOT NULL,
      address text,
      contact_person text,
      contact_phone text,
      status text NOT NULL DEFAULT 'active',
      notes text,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_project_sites_dealer ON public.project_sites(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_project_sites_project ON public.project_sites(project_id);
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 3) price_tiers + price_tier_items
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.price_tiers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      is_default boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (dealer_id, name)
    );

    CREATE TABLE IF NOT EXISTS public.price_tier_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      tier_id uuid NOT NULL REFERENCES public.price_tiers(id) ON DELETE CASCADE,
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      rate numeric(14,2) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tier_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_price_tier_items_dealer ON public.price_tier_items(dealer_id);
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 4) quotations + quotation_items
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.quotations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      quotation_no text NOT NULL,
      revision_no integer NOT NULL DEFAULT 0,
      parent_quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
      customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
      customer_name_text text,
      customer_phone_text text,
      customer_address_text text,
      project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
      site_id uuid REFERENCES public.project_sites(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'active',
      quote_date date NOT NULL DEFAULT CURRENT_DATE,
      valid_until date NOT NULL DEFAULT (CURRENT_DATE + 7),
      subtotal numeric(14,2) NOT NULL DEFAULT 0,
      discount_type text NOT NULL DEFAULT 'flat',
      discount_value numeric(14,2) NOT NULL DEFAULT 0,
      total_amount numeric(14,2) NOT NULL DEFAULT 0,
      notes text,
      terms_text text,
      converted_sale_id uuid,
      converted_by uuid,
      converted_at timestamptz,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_quotations_dealer ON public.quotations(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_quotations_customer ON public.quotations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(dealer_id, status);

    CREATE TABLE IF NOT EXISTS public.quotation_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
      product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
      product_name_snapshot text NOT NULL,
      product_sku_snapshot text,
      unit_type text NOT NULL DEFAULT 'piece',
      per_box_sft numeric(14,4),
      quantity numeric(14,4) NOT NULL DEFAULT 0,
      rate numeric(14,2) NOT NULL DEFAULT 0,
      discount_value numeric(14,2) NOT NULL DEFAULT 0,
      line_total numeric(14,2) NOT NULL DEFAULT 0,
      rate_source text NOT NULL DEFAULT 'default',
      tier_id uuid REFERENCES public.price_tiers(id) ON DELETE SET NULL,
      original_resolved_rate numeric(14,2),
      preferred_shade_code text,
      preferred_caliber text,
      preferred_batch_no text,
      measurement_snapshot jsonb,
      notes text,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items(quotation_id);
    CREATE INDEX IF NOT EXISTS idx_quotation_items_dealer ON public.quotation_items(dealer_id);
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 5) referral_sources + sale_commissions
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.referral_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      name text NOT NULL,
      phone text,
      source_type public.referral_source_type NOT NULL DEFAULT 'other',
      default_commission_type public.commission_type,
      default_commission_value numeric(14,2),
      active boolean NOT NULL DEFAULT true,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_referral_sources_dealer ON public.referral_sources(dealer_id);

    CREATE TABLE IF NOT EXISTS public.sale_commissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      sale_id uuid NOT NULL UNIQUE REFERENCES public.sales(id) ON DELETE CASCADE,
      referral_source_id uuid NOT NULL REFERENCES public.referral_sources(id) ON DELETE RESTRICT,
      commission_type public.commission_type NOT NULL DEFAULT 'percent',
      commission_value numeric(14,2) NOT NULL DEFAULT 0,
      commission_base_amount numeric(14,2) NOT NULL DEFAULT 0,
      calculated_commission_amount numeric(14,2) NOT NULL DEFAULT 0,
      settled_amount numeric(14,2) NOT NULL DEFAULT 0,
      status public.commission_status NOT NULL DEFAULT 'pending',
      payable_at date,
      settled_at timestamptz,
      notes text,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_sale_commissions_dealer ON public.sale_commissions(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_sale_commissions_source ON public.sale_commissions(referral_source_id);
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 6) sample_issues
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.sample_issues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
      customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
      recipient_name text NOT NULL,
      recipient_phone text,
      recipient_type public.sample_recipient_type NOT NULL DEFAULT 'customer',
      quantity numeric(14,4) NOT NULL,
      returned_qty numeric(14,4) NOT NULL DEFAULT 0,
      damaged_qty numeric(14,4) NOT NULL DEFAULT 0,
      lost_qty numeric(14,4) NOT NULL DEFAULT 0,
      issue_date date NOT NULL DEFAULT CURRENT_DATE,
      expected_return_date date,
      returned_date date,
      status public.sample_issue_status NOT NULL DEFAULT 'issued',
      notes text,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_sample_issues_dealer ON public.sample_issues(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_sample_issues_product ON public.sample_issues(product_id);
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 7) demand_planning_settings
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.demand_planning_settings (
      dealer_id uuid PRIMARY KEY REFERENCES public.dealers(id) ON DELETE CASCADE,
      velocity_window_days integer NOT NULL DEFAULT 30,
      target_cover_days integer NOT NULL DEFAULT 30,
      reorder_cover_days integer NOT NULL DEFAULT 14,
      safety_stock_days integer NOT NULL DEFAULT 7,
      stockout_cover_days integer NOT NULL DEFAULT 3,
      incoming_window_days integer NOT NULL DEFAULT 30,
      dead_stock_days integer NOT NULL DEFAULT 180,
      fast_moving_30d_qty integer NOT NULL DEFAULT 30,
      slow_moving_30d_max integer NOT NULL DEFAULT 5,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 8) whatsapp_message_logs + whatsapp_settings
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      provider text NOT NULL DEFAULT 'manual',
      message_type public.whatsapp_message_type NOT NULL,
      status public.whatsapp_message_status NOT NULL DEFAULT 'queued',
      source_type text NOT NULL,
      source_id uuid,
      recipient_phone text NOT NULL,
      recipient_name text,
      message_text text NOT NULL,
      template_key text,
      payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      provider_message_id text,
      error_message text,
      idempotency_key text,
      sent_at timestamptz,
      failed_at timestamptz,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wa_logs_dealer ON public.whatsapp_message_logs(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_wa_logs_source ON public.whatsapp_message_logs(source_type, source_id);

    CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
      dealer_id uuid PRIMARY KEY REFERENCES public.dealers(id) ON DELETE CASCADE,
      default_country_code text NOT NULL DEFAULT '880',
      prefer_manual_send boolean NOT NULL DEFAULT true,
      enable_invoice_share boolean NOT NULL DEFAULT true,
      enable_payment_receipt boolean NOT NULL DEFAULT true,
      enable_delivery_update boolean NOT NULL DEFAULT true,
      enable_overdue_reminder boolean NOT NULL DEFAULT true,
      enable_quotation_share boolean NOT NULL DEFAULT true,
      template_invoice_share text,
      template_payment_receipt text,
      template_delivery_update text,
      template_overdue_reminder text,
      template_quotation_share text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 9) display_stock
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.display_stock (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      display_qty numeric(14,4) NOT NULL DEFAULT 0,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (dealer_id, product_id)
    );
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 10) purchase_shortage_links
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.purchase_shortage_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
      purchase_item_id uuid,
      sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
      planned_qty numeric(14,4) NOT NULL DEFAULT 0,
      link_type text NOT NULL DEFAULT 'backorder',
      notes text,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_psl_dealer ON public.purchase_shortage_links(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_psl_purchase ON public.purchase_shortage_links(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_psl_sale_item ON public.purchase_shortage_links(sale_item_id);
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 11) sale_item_batches
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.sale_item_batches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
      batch_id uuid NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
      allocated_qty numeric(14,4) NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_sib_sale_item ON public.sale_item_batches(sale_item_id);
    CREATE INDEX IF NOT EXISTS idx_sib_batch ON public.sale_item_batches(batch_id);
    CREATE INDEX IF NOT EXISTS idx_sib_dealer ON public.sale_item_batches(dealer_id);
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 12) sale_items new columns (fulfillment_status, backorder_qty, allocated_qty, tier_id)
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    ALTER TABLE public.sale_items
      ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'fulfilled',
      ADD COLUMN IF NOT EXISTS backorder_qty numeric(14,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS allocated_qty numeric(14,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.price_tiers(id) ON DELETE SET NULL;
  `);

  // ────────────────────────────────────────────────────────────────────────────
  // 13) Functions: get_next_project_code, expire_stale_quotations, revise_quotation
  // ────────────────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.get_next_project_code(p_dealer_id uuid)
    RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $fn$
    DECLARE
      v_next integer;
    BEGIN
      INSERT INTO public.project_code_sequences (dealer_id, next_project_no)
      VALUES (p_dealer_id, 1)
      ON CONFLICT (dealer_id) DO NOTHING;

      UPDATE public.project_code_sequences
        SET next_project_no = next_project_no + 1
        WHERE dealer_id = p_dealer_id
        RETURNING next_project_no - 1 INTO v_next;

      RETURN 'PRJ-' || LPAD(v_next::text, 4, '0');
    END;
    $fn$;

    CREATE OR REPLACE FUNCTION public.expire_stale_quotations(_dealer_id uuid)
    RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $fn$
    DECLARE
      _count integer := 0;
    BEGIN
      UPDATE public.quotations
      SET status = 'expired'
      WHERE dealer_id = _dealer_id
        AND status = 'active'
        AND valid_until < CURRENT_DATE;
      GET DIAGNOSTICS _count = ROW_COUNT;
      RETURN _count;
    END;
    $fn$;

    CREATE OR REPLACE FUNCTION public.revise_quotation(_quotation_id uuid, _dealer_id uuid)
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $fn$
    DECLARE
      _parent record;
      _root_id uuid;
      _root_no text;
      _next_rev integer;
      _new_id uuid;
      _cur record;
    BEGIN
      SELECT * INTO _parent
      FROM public.quotations
      WHERE id = _quotation_id AND dealer_id = _dealer_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation not found';
      END IF;

      IF _parent.status NOT IN ('active','expired') THEN
        RAISE EXCEPTION 'Only active or expired quotations can be revised (current: %)', _parent.status;
      END IF;

      IF _parent.parent_quotation_id IS NULL THEN
        _root_id := _parent.id;
        _root_no := _parent.quotation_no;
      ELSE
        _cur := _parent;
        LOOP
          EXIT WHEN _cur.parent_quotation_id IS NULL;
          SELECT * INTO _cur FROM public.quotations WHERE id = _cur.parent_quotation_id;
          IF NOT FOUND THEN EXIT; END IF;
        END LOOP;
        _root_id := _cur.id;
        _root_no := _cur.quotation_no;
      END IF;

      SELECT COALESCE(MAX(revision_no), 0) + 1 INTO _next_rev
      FROM public.quotations
      WHERE dealer_id = _dealer_id
        AND (id = _root_id OR parent_quotation_id = _root_id);

      UPDATE public.quotations
      SET status = 'revised'
      WHERE id = _quotation_id;

      INSERT INTO public.quotations (
        dealer_id, quotation_no, revision_no, parent_quotation_id,
        customer_id, customer_name_text, customer_phone_text, customer_address_text,
        status, quote_date, valid_until,
        subtotal, discount_type, discount_value, total_amount,
        notes, terms_text
      ) VALUES (
        _dealer_id, _root_no, _next_rev, _root_id,
        _parent.customer_id, _parent.customer_name_text, _parent.customer_phone_text, _parent.customer_address_text,
        'active', CURRENT_DATE, _parent.valid_until,
        _parent.subtotal, _parent.discount_type, _parent.discount_value, _parent.total_amount,
        _parent.notes, _parent.terms_text
      ) RETURNING id INTO _new_id;

      INSERT INTO public.quotation_items (
        dealer_id, quotation_id, product_id,
        product_name_snapshot, product_sku_snapshot,
        unit_type, per_box_sft, quantity, rate,
        discount_value, line_total,
        preferred_shade_code, preferred_caliber, preferred_batch_no,
        notes, sort_order
      )
      SELECT
        dealer_id, _new_id, product_id,
        product_name_snapshot, product_sku_snapshot,
        unit_type, per_box_sft, quantity, rate,
        discount_value, line_total,
        preferred_shade_code, preferred_caliber, preferred_batch_no,
        notes, sort_order
      FROM public.quotation_items
      WHERE quotation_id = _quotation_id;

      RETURN _new_id;
    END;
    $fn$;
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // Intentional no-op: this is a forward-only catch-up migration. Use a manual
  // migration if rollback is ever needed.
}

import { Knex } from 'knex';

/**
 * Phase A — Leads CRM
 *
 * Adds:
 *   - public.leads          : prospect/lead tracking before conversion to customer
 *   - public.lead_visits    : visit / follow-up activity log
 *
 * Multi-tenant via dealer_id. Idempotent (uses IF NOT EXISTS).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE public.lead_status AS ENUM ('new','contacted','qualified','converted','lost');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_source') THEN
        CREATE TYPE public.lead_source AS ENUM ('walk_in','phone','referral','online','facebook','whatsapp','other');
      END IF;
    END$$;
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.leads (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id       uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      name            text NOT NULL,
      phone           text,
      email           text,
      address         text,
      company         text,
      source          public.lead_source NOT NULL DEFAULT 'walk_in',
      status          public.lead_status NOT NULL DEFAULT 'new',
      interest        text,
      estimated_value numeric(14,2) DEFAULT 0,
      assigned_to     uuid,
      next_followup   date,
      notes           text,
      converted_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
      converted_at    timestamptz,
      created_by      uuid,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS leads_dealer_idx        ON public.leads(dealer_id);
    CREATE INDEX IF NOT EXISTS leads_status_idx        ON public.leads(dealer_id, status);
    CREATE INDEX IF NOT EXISTS leads_next_followup_idx ON public.leads(dealer_id, next_followup);
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.lead_visits (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id    uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      lead_id      uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
      visit_date   date NOT NULL DEFAULT CURRENT_DATE,
      visit_type   text NOT NULL DEFAULT 'visit',
      outcome      text,
      next_action  text,
      next_date    date,
      notes        text,
      visited_by   uuid,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS lead_visits_dealer_idx ON public.lead_visits(dealer_id);
    CREATE INDEX IF NOT EXISTS lead_visits_lead_idx   ON public.lead_visits(lead_id);
    CREATE INDEX IF NOT EXISTS lead_visits_date_idx   ON public.lead_visits(dealer_id, visit_date);
  `);

  // touch trigger for updated_at (ensure shared function exists)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
    CREATE TRIGGER trg_leads_updated_at
      BEFORE UPDATE ON public.leads
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS public.lead_visits CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS public.leads CASCADE;`);
  await knex.raw(`DROP TYPE  IF EXISTS public.lead_source;`);
  await knex.raw(`DROP TYPE  IF EXISTS public.lead_status;`);
}

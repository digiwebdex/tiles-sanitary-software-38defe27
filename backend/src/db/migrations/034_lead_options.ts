import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.lead_options (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id   uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      kind        text NOT NULL CHECK (kind IN ('source','status','visit_type','outcome')),
      value       text NOT NULL,
      label       text NOT NULL,
      color       text,
      sort_order  int  NOT NULL DEFAULT 0,
      is_active   boolean NOT NULL DEFAULT true,
      created_at  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (dealer_id, kind, value)
    );
    CREATE INDEX IF NOT EXISTS lead_options_dealer_kind_idx
      ON public.lead_options(dealer_id, kind);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS public.lead_options CASCADE;`);
}

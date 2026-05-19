import { Knex } from 'knex';

/**
 * Phase B — File Manager
 *
 * public.dealer_files : per-dealer document/file registry. Files
 * themselves live under ./uploads/files/<dealer_id>/<uuid><ext>,
 * this table tracks metadata + folder categorisation.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.dealer_files (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id     uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      folder        text NOT NULL DEFAULT 'general',
      name          text NOT NULL,
      original_name text NOT NULL,
      mime_type     text,
      size_bytes    bigint NOT NULL DEFAULT 0,
      url           text NOT NULL,
      description   text,
      uploaded_by   uuid,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS dealer_files_dealer_idx ON public.dealer_files(dealer_id);
    CREATE INDEX IF NOT EXISTS dealer_files_folder_idx ON public.dealer_files(dealer_id, folder);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS public.dealer_files CASCADE;`);
}

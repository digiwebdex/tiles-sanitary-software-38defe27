import { Knex } from 'knex';

/**
 * Phase C — Holiday Setup
 *
 * public.holidays : per-dealer holiday calendar used by HR / Attendance /
 * Payroll. `recurring=true` repeats yearly on the same month/day.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE public.holiday_type AS ENUM (
        'public', 'religious', 'national', 'company', 'weekend', 'other'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS public.holidays (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id   uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
      holiday_date date NOT NULL,
      name        text NOT NULL,
      type        public.holiday_type NOT NULL DEFAULT 'public',
      recurring   boolean NOT NULL DEFAULT false,
      paid        boolean NOT NULL DEFAULT true,
      notes       text,
      created_by  uuid,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (dealer_id, holiday_date, name)
    );
    CREATE INDEX IF NOT EXISTS holidays_dealer_idx ON public.holidays(dealer_id);
    CREATE INDEX IF NOT EXISTS holidays_dealer_date_idx ON public.holidays(dealer_id, holiday_date);

    DROP TRIGGER IF EXISTS trg_holidays_updated_at ON public.holidays;
    CREATE TRIGGER trg_holidays_updated_at
      BEFORE UPDATE ON public.holidays
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS public.holidays CASCADE;
    DROP TYPE IF EXISTS public.holiday_type;
  `);
}

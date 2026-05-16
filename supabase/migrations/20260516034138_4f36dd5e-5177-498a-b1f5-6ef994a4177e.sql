CREATE TABLE IF NOT EXISTS public.cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  closing_date date NOT NULL,
  opening_cash numeric(14,2) NOT NULL DEFAULT 0,
  system_cash_in numeric(14,2) NOT NULL DEFAULT 0,
  system_cash_out numeric(14,2) NOT NULL DEFAULT 0,
  expected_closing numeric(14,2) NOT NULL DEFAULT 0,
  counted_cash numeric(14,2) NOT NULL DEFAULT 0,
  denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
  variance numeric(14,2) NOT NULL DEFAULT 0,
  variance_reason text,
  notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected')),
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  approval_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_closings_unique_per_day UNIQUE (dealer_id, closing_date)
);

CREATE INDEX IF NOT EXISTS idx_cash_closings_dealer_date ON public.cash_closings(dealer_id, closing_date DESC);

CREATE TRIGGER trg_cash_closings_updated_at
BEFORE UPDATE ON public.cash_closings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer admins view own closings" ON public.cash_closings FOR SELECT
USING (dealer_id = public.get_user_dealer_id(auth.uid()) OR public.is_super_admin());

CREATE POLICY "Dealer admins insert own closings" ON public.cash_closings FOR INSERT
WITH CHECK (dealer_id = public.get_user_dealer_id(auth.uid()) AND public.has_role(auth.uid(), 'dealer_admin'::app_role));

CREATE POLICY "Dealer admins update own closings" ON public.cash_closings FOR UPDATE
USING (dealer_id = public.get_user_dealer_id(auth.uid()) AND public.has_role(auth.uid(), 'dealer_admin'::app_role));
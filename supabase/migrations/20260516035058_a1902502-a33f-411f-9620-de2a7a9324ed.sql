
CREATE TABLE public.purchase_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','converted','discarded')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'auto_low_stock' CHECK (source IN ('auto_low_stock','manual')),
  converted_purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_drafts_dealer ON public.purchase_drafts(dealer_id, status);

CREATE TABLE public.purchase_draft_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.purchase_drafts(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  suggested_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
  suggested_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_draft_items_draft ON public.purchase_draft_items(draft_id);
CREATE INDEX idx_purchase_draft_items_dealer ON public.purchase_draft_items(dealer_id);

ALTER TABLE public.purchase_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_draft_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer admins manage drafts" ON public.purchase_drafts
  FOR ALL TO authenticated
  USING (dealer_id = get_user_dealer_id(auth.uid()) AND has_role(auth.uid(),'dealer_admin'))
  WITH CHECK (dealer_id = get_user_dealer_id(auth.uid()) AND has_role(auth.uid(),'dealer_admin'));
CREATE POLICY "Dealer users view drafts" ON public.purchase_drafts
  FOR SELECT TO authenticated
  USING (dealer_id = get_user_dealer_id(auth.uid()));

CREATE POLICY "Dealer admins manage draft items" ON public.purchase_draft_items
  FOR ALL TO authenticated
  USING (dealer_id = get_user_dealer_id(auth.uid()) AND has_role(auth.uid(),'dealer_admin'))
  WITH CHECK (dealer_id = get_user_dealer_id(auth.uid()) AND has_role(auth.uid(),'dealer_admin'));
CREATE POLICY "Dealer users view draft items" ON public.purchase_draft_items
  FOR SELECT TO authenticated
  USING (dealer_id = get_user_dealer_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_purchase_drafts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_purchase_drafts_updated_at
  BEFORE UPDATE ON public.purchase_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_purchase_drafts_updated_at();

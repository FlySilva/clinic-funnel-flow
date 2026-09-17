ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS appointment_date date,
  ADD COLUMN IF NOT EXISTS appointment_time text,
  ADD COLUMN IF NOT EXISTS appointment_notes text;

CREATE TABLE IF NOT EXISTS public.lead_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'bot',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_messages_lead_idx ON public.lead_messages (lead_id, created_at);

GRANT SELECT, INSERT ON public.lead_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_messages TO authenticated;
GRANT ALL ON public.lead_messages TO service_role;
ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_messages_public_read ON public.lead_messages FOR SELECT USING (true);
CREATE POLICY lead_messages_public_insert ON public.lead_messages FOR INSERT WITH CHECK (true);
CREATE POLICY lead_messages_admin_delete ON public.lead_messages FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.zapi_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  instance_id text NOT NULL DEFAULT '',
  token text NOT NULL DEFAULT '',
  client_token text NOT NULL DEFAULT '',
  webhook_secret text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.zapi_settings TO authenticated;
GRANT ALL ON public.zapi_settings TO service_role;
ALTER TABLE public.zapi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY zapi_admin_all ON public.zapi_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER zapi_touch BEFORE UPDATE ON public.zapi_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.zapi_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_messages;
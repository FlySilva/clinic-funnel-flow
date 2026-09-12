CREATE TABLE public.treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  ticket text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treatments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatments TO authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "treatments_public_read" ON public.treatments FOR SELECT USING (true);
CREATE POLICY "treatments_admin_write" ON public.treatments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_public_read" ON public.questions FOR SELECT USING (true);
CREATE POLICY "questions_admin_write" ON public.questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  color text NOT NULL DEFAULT 'secondary',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_public_read" ON public.tags FOR SELECT USING (true);
CREATE POLICY "tags_admin_write" ON public.tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  clinic_name text NOT NULL DEFAULT 'Clínica Vitreo',
  clinic_whatsapp text NOT NULL DEFAULT '',
  booking_url text NOT NULL DEFAULT '',
  greeting text NOT NULL DEFAULT 'Olá! Aqui é a Lia, assistente virtual da Clínica Vitreo ✨',
  periods text[] NOT NULL DEFAULT ARRAY['Manhã (8h às 12h)','Tarde (12h às 18h)','Noite (18h às 20h)'],
  forward_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Contato novo',
  phone text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'novo',
  treatment text,
  tags text[] NOT NULL DEFAULT '{}',
  period text,
  score int NOT NULL DEFAULT 20,
  source text NOT NULL DEFAULT 'WhatsApp',
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  booking_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_public_read" ON public.leads FOR SELECT USING (true);
CREATE POLICY "leads_public_insert" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "leads_public_update" ON public.leads FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "leads_admin_delete" ON public.leads FOR DELETE TO authenticated USING (true);

CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  event text NOT NULL,
  status int NOT NULL DEFAULT 200,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.integration_events TO anon;
GRANT SELECT, INSERT, DELETE ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_public_read" ON public.integration_events FOR SELECT USING (true);
CREATE POLICY "events_public_insert" ON public.integration_events FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.app_settings (id) VALUES (true);

INSERT INTO public.treatments (label, ticket, sort_order) VALUES
  ('Harmonização Facial', 'R$ 2.400', 1),
  ('Toxina Botulínica', 'R$ 1.200', 2),
  ('Preenchimento Labial', 'R$ 1.800', 3),
  ('Limpeza de Pele Profunda', 'R$ 350', 4),
  ('Laser & Rejuvenescimento', 'R$ 3.100', 5);

INSERT INTO public.tags (label) VALUES
  ('Primeira vez'), ('Retorno'), ('Alta intenção'), ('Sem orçamento'), ('Avaliação marcada');

INSERT INTO public.questions (prompt, options, sort_order) VALUES
  ('Você já realizou esse procedimento antes?',
   '[{"label":"Sim, já realizei","points":15,"tag":"Retorno","disqualify":false},{"label":"Não, seria a primeira vez","points":8,"tag":"Primeira vez","disqualify":false}]'::jsonb, 1),
  ('Qual faixa de investimento você tem em mente para esse cuidado?',
   '[{"label":"Até R$ 1.000","points":10,"tag":"","disqualify":false},{"label":"Entre R$ 1.000 e R$ 3.000","points":22,"tag":"Alta intenção","disqualify":false},{"label":"Acima de R$ 3.000","points":32,"tag":"Alta intenção","disqualify":false},{"label":"Só estou pesquisando preço","points":0,"tag":"Sem orçamento","disqualify":true}]'::jsonb, 2);

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
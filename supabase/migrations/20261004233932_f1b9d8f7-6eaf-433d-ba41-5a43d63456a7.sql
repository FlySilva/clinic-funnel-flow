CREATE TYPE public.clinic_role AS ENUM ('owner','attendant');

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.clinic_members (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL DEFAULT '',
  role public.clinic_role NOT NULL DEFAULT 'attendant',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, user_id)
);
GRANT SELECT, UPDATE, DELETE ON public.clinic_members TO authenticated;
GRANT ALL ON public.clinic_members TO service_role;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.clinic_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.clinic_role NOT NULL DEFAULT 'attendant',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, email)
);
GRANT SELECT, INSERT, DELETE ON public.clinic_invites TO authenticated;
GRANT ALL ON public.clinic_invites TO service_role;
ALTER TABLE public.clinic_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_clinic_member(_clinic uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clinic_members WHERE clinic_id = _clinic AND user_id = _user)
$$;
CREATE OR REPLACE FUNCTION public.is_clinic_owner(_clinic uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clinic_members WHERE clinic_id = _clinic AND user_id = _user AND role = 'owner')
$$;

CREATE POLICY clinics_member_read ON public.clinics FOR SELECT TO authenticated USING (public.is_clinic_member(id, auth.uid()));
CREATE POLICY clinics_owner_update ON public.clinics FOR UPDATE TO authenticated USING (public.is_clinic_owner(id, auth.uid())) WITH CHECK (public.is_clinic_owner(id, auth.uid()));

CREATE POLICY members_read ON public.clinic_members FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id, auth.uid()));
CREATE POLICY members_owner_update ON public.clinic_members FOR UPDATE TO authenticated USING (public.is_clinic_owner(clinic_id, auth.uid()) AND user_id <> auth.uid()) WITH CHECK (public.is_clinic_owner(clinic_id, auth.uid()));
CREATE POLICY members_owner_delete ON public.clinic_members FOR DELETE TO authenticated USING (public.is_clinic_owner(clinic_id, auth.uid()) AND user_id <> auth.uid());

CREATE POLICY invites_owner_all ON public.clinic_invites FOR ALL TO authenticated USING (public.is_clinic_owner(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_owner(clinic_id, auth.uid()));

-- Clínica padrão para os dados existentes
INSERT INTO public.clinics (name, slug) VALUES ('Clínica Vitreo', 'clinica-vitreo');
INSERT INTO public.clinic_members (clinic_id, user_id, email, role)
  SELECT c.id, u.id, coalesce(u.email,''), 'owner' FROM auth.users u, public.clinics c WHERE c.slug = 'clinica-vitreo';

-- clinic_id nas tabelas de conteúdo
DO $$
DECLARE t text; v uuid;
BEGIN
  SELECT id INTO v FROM public.clinics WHERE slug = 'clinica-vitreo';
  FOREACH t IN ARRAY ARRAY['treatments','questions','tags','leads','integration_events','lead_messages','app_settings','zapi_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET clinic_id = %L', t, v);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN clinic_id SET NOT NULL', t);
  END LOOP;
END $$;

ALTER TABLE public.app_settings DROP COLUMN id CASCADE;
ALTER TABLE public.app_settings ADD PRIMARY KEY (clinic_id);
ALTER TABLE public.zapi_settings DROP COLUMN id CASCADE;
ALTER TABLE public.zapi_settings ADD PRIMARY KEY (clinic_id);
CREATE INDEX ON public.leads (clinic_id, updated_at DESC);
CREATE INDEX ON public.integration_events (clinic_id, created_at DESC);
CREATE INDEX ON public.zapi_settings (webhook_secret);

-- Remove políticas antigas
DROP POLICY IF EXISTS settings_admin_write ON public.app_settings;
DROP POLICY IF EXISTS settings_public_read ON public.app_settings;
DROP POLICY IF EXISTS events_public_insert ON public.integration_events;
DROP POLICY IF EXISTS events_public_read ON public.integration_events;
DROP POLICY IF EXISTS lead_messages_admin_delete ON public.lead_messages;
DROP POLICY IF EXISTS lead_messages_public_insert ON public.lead_messages;
DROP POLICY IF EXISTS lead_messages_public_read ON public.lead_messages;
DROP POLICY IF EXISTS leads_admin_delete ON public.leads;
DROP POLICY IF EXISTS leads_public_insert ON public.leads;
DROP POLICY IF EXISTS leads_public_read ON public.leads;
DROP POLICY IF EXISTS leads_public_update ON public.leads;
DROP POLICY IF EXISTS questions_admin_write ON public.questions;
DROP POLICY IF EXISTS questions_public_read ON public.questions;
DROP POLICY IF EXISTS tags_admin_write ON public.tags;
DROP POLICY IF EXISTS tags_public_read ON public.tags;
DROP POLICY IF EXISTS treatments_admin_write ON public.treatments;
DROP POLICY IF EXISTS treatments_public_read ON public.treatments;
DROP POLICY IF EXISTS zapi_admin_all ON public.zapi_settings;

REVOKE ALL ON public.app_settings, public.integration_events, public.lead_messages, public.leads, public.questions, public.tags, public.treatments, public.zapi_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings, public.integration_events, public.lead_messages, public.leads, public.questions, public.tags, public.treatments, public.zapi_settings TO authenticated;
GRANT ALL ON public.app_settings, public.integration_events, public.lead_messages, public.leads, public.questions, public.tags, public.treatments, public.zapi_settings TO service_role;

-- Config: membros leem, dono edita
CREATE POLICY m_read ON public.treatments FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id, auth.uid()));
CREATE POLICY o_write ON public.treatments FOR ALL TO authenticated USING (public.is_clinic_owner(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_owner(clinic_id, auth.uid()));
CREATE POLICY m_read ON public.questions FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id, auth.uid()));
CREATE POLICY o_write ON public.questions FOR ALL TO authenticated USING (public.is_clinic_owner(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_owner(clinic_id, auth.uid()));
CREATE POLICY m_read ON public.tags FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id, auth.uid()));
CREATE POLICY o_write ON public.tags FOR ALL TO authenticated USING (public.is_clinic_owner(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_owner(clinic_id, auth.uid()));
CREATE POLICY m_read ON public.app_settings FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id, auth.uid()));
CREATE POLICY o_write ON public.app_settings FOR ALL TO authenticated USING (public.is_clinic_owner(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_owner(clinic_id, auth.uid()));
CREATE POLICY o_all ON public.zapi_settings FOR ALL TO authenticated USING (public.is_clinic_owner(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_owner(clinic_id, auth.uid()));
-- Operação: todos os membros
CREATE POLICY m_all ON public.leads FOR ALL TO authenticated USING (public.is_clinic_member(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_member(clinic_id, auth.uid()));
CREATE POLICY m_all ON public.lead_messages FOR ALL TO authenticated USING (public.is_clinic_member(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_member(clinic_id, auth.uid()));
CREATE POLICY m_all ON public.integration_events FOR ALL TO authenticated USING (public.is_clinic_member(clinic_id, auth.uid())) WITH CHECK (public.is_clinic_member(clinic_id, auth.uid()));

-- Criar clínica (autocadastro) com dados iniciais
CREATE OR REPLACE FUNCTION public.create_clinic(_name text, _slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; uemail text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _slug !~ '^[a-z0-9][a-z0-9-]{2,40}$' THEN RAISE EXCEPTION 'invalid slug'; END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  INSERT INTO clinics (name, slug, created_by) VALUES (trim(_name), _slug, auth.uid()) RETURNING id INTO cid;
  INSERT INTO clinic_members (clinic_id, user_id, email, role) VALUES (cid, auth.uid(), coalesce(uemail,''), 'owner');
  INSERT INTO app_settings (clinic_id, clinic_name, greeting) VALUES (cid, trim(_name), 'Olá! Aqui é a Lia, assistente virtual da ' || trim(_name) || ' ✨');
  INSERT INTO zapi_settings (clinic_id, webhook_secret) VALUES (cid, encode(gen_random_bytes(16), 'hex'));
  INSERT INTO treatments (clinic_id, label, ticket, sort_order) VALUES
    (cid, 'Avaliação inicial', '', 1), (cid, 'Toxina Botulínica', 'R$ 1.200', 2), (cid, 'Limpeza de Pele', 'R$ 350', 3);
  INSERT INTO questions (clinic_id, prompt, options, sort_order) VALUES
    (cid, 'É a sua primeira vez fazendo esse procedimento?', '[{"label":"Sim, primeira vez","points":15,"tag":"Primeira vez","disqualify":false},{"label":"Já fiz antes","points":20,"tag":"Retorno","disqualify":false}]', 1),
    (cid, 'Você tem orçamento disponível para começar este mês?', '[{"label":"Sim","points":25,"tag":"Alta intenção","disqualify":false},{"label":"Ainda não","points":0,"tag":"Sem orçamento","disqualify":true}]', 2);
  INSERT INTO tags (clinic_id, label) VALUES (cid,'Primeira vez'),(cid,'Retorno'),(cid,'Alta intenção'),(cid,'Sem orçamento'),(cid,'Avaliação marcada');
  RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.create_clinic(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_clinic(text, text) TO authenticated;

-- Aceitar convites pendentes do e-mail do usuário logado
CREATE OR REPLACE FUNCTION public.accept_clinic_invites()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uemail text; n integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO uemail FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF uemail IS NULL THEN RETURN 0; END IF;
  INSERT INTO clinic_members (clinic_id, user_id, email, role)
    SELECT clinic_id, auth.uid(), uemail, role FROM clinic_invites WHERE lower(email) = uemail
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM clinic_invites WHERE lower(email) = uemail;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.accept_clinic_invites() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_clinic_invites() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.integration_events;
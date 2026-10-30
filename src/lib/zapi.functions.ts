import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sendSchema = z.object({
  leadId: z.string().uuid(),
  phone: z.string().min(8).max(24),
  message: z.string().min(1).max(2000),
});

/** Sends one of Lia's messages through the clinic's real WhatsApp (Z-API). */
export const sendLiaMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sendSchema.parse(data))
  .handler(async ({ data, context }) => {
    // RLS: the caller only sees leads of clinics they belong to.
    const { data: lead } = await context.supabase
      .from("leads")
      .select("id, clinic_id")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) return { ok: false, reason: "lead_not_found" as const };
    const clinicId = lead.clinic_id as string;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadZapiSettings, sendWhatsAppText } = await import("@/lib/zapi.server");

    const zapi = await loadZapiSettings(supabaseAdmin, clinicId);
    if (!zapi.enabled) return { ok: false, reason: "disabled" as const };
    if (!zapi.credentials) {
      await supabaseAdmin.from("integration_events").insert({
        clinic_id: clinicId,
        lead_id: data.leadId,
        event: "whatsapp.send_failed",
        status: 503,
        payload: { reason: "Credenciais da Z-API não configuradas", phone: data.phone },
      });
      return { ok: false, reason: "missing_credentials" as const };
    }

    const res = await sendWhatsAppText(zapi.credentials, data.phone, data.message);
    await supabaseAdmin.from("integration_events").insert({
      clinic_id: clinicId,
      lead_id: data.leadId,
      event: res.ok ? "whatsapp.message_sent" : "whatsapp.send_failed",
      status: res.status,
      payload: { phone: data.phone, message: data.message, response: res.body },
    });
    return { ok: res.ok, reason: "sent" as const, status: res.status, body: res.body };
  });

const testSchema = z.object({
  clinicId: z.string().uuid(),
  phone: z.string().min(8).max(24),
  message: z.string().min(1).max(500),
});

/** Owner-only connection test for the Z-API settings screen. */
export const testZapiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => testSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_clinic_owner", {
      _clinic: data.clinicId,
      _user: context.userId,
    });
    if (!isOwner) return { ok: false, status: 403, body: "Apenas o responsável da clínica pode testar." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadZapiSettings, sendWhatsAppText } = await import("@/lib/zapi.server");

    const zapi = await loadZapiSettings(supabaseAdmin, data.clinicId);
    if (!zapi.credentials) return { ok: false, status: 0, body: "Credenciais não cadastradas." };

    const res = await sendWhatsAppText(zapi.credentials, data.phone, data.message);
    await supabaseAdmin.from("integration_events").insert({
      clinic_id: data.clinicId,
      event: res.ok ? "zapi.test_ok" : "zapi.test_failed",
      status: res.status,
      payload: { phone: data.phone, response: res.body },
    });
    return res;
  });

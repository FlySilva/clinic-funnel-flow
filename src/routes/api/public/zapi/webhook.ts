import { createFileRoute } from "@tanstack/react-router";

import { loadBotConfig } from "@/lib/bot-config";
import {
  DEFAULT_LEAD_NAME,
  emptyLead,
  handleReply,
  openingMessages,
  type BotLead,
} from "@/lib/bot-engine";
import { loadZapiSettings, sendWhatsAppText } from "@/lib/zapi.server";

type Incoming = {
  phone?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  senderName?: string;
  text?: { message?: string };
  message?: string;
};

function extractText(body: Incoming): string {
  return (body.text?.message ?? body.message ?? "").toString().trim();
}

export const Route = createFileRoute("/api/public/zapi/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Incoming;
        try {
          body = (await request.json()) as Incoming;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const zapi = await loadZapiSettings(supabaseAdmin);

        if (zapi.webhookSecret) {
          const url = new URL(request.url);
          const provided =
            request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret") ?? "";
          if (provided !== zapi.webhookSecret) return new Response("Invalid secret", { status: 401 });
        }

        if (body.fromMe || body.isGroup || !body.phone) return Response.json({ ignored: true });

        const text = extractText(body);
        if (!text) return Response.json({ ignored: true });

        const config = await loadBotConfig(supabaseAdmin as never);
        const phone = body.phone.replace(/\D/g, "");

        const { data: existing } = await supabaseAdmin
          .from("leads")
          .select("*")
          .eq("phone", phone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let leadId = existing?.id as string | undefined;
        let lead: BotLead;
        let isNew = false;

        if (existing) {
          lead = {
            name: existing.name ?? DEFAULT_LEAD_NAME,
            stage: (existing.stage ?? "novo") as BotLead["stage"],
            treatment: existing.treatment ?? null,
            tags: (existing.tags as string[]) ?? [],
            period: existing.period ?? null,
            score: existing.score ?? 20,
            notes: (existing.notes as BotLead["notes"]) ?? [],
            booking_url: existing.booking_url ?? null,
          };
        } else {
          isNew = true;
          lead = emptyLead();
          const { data: inserted, error } = await supabaseAdmin
            .from("leads")
            .insert({
              name: body.senderName?.trim() || DEFAULT_LEAD_NAME,
              phone,
              stage: "novo",
              score: 20,
              source: "WhatsApp (Z-API)",
              tags: [],
              notes: [],
            })
            .select("id")
            .single();
          if (error) return new Response(error.message, { status: 500 });
          leadId = inserted.id;
          if (body.senderName?.trim()) lead.name = body.senderName.trim();
        }

        await supabaseAdmin
          .from("lead_messages")
          .insert({ lead_id: leadId!, direction: "user", body: text });

        const replies: string[] = [];
        if (isNew) {
          replies.push(...openingMessages(config));
        } else {
          const turn = handleReply(lead, config, text);
          lead = { ...lead, ...turn.patch };
          replies.push(...turn.replies);

          await supabaseAdmin
            .from("leads")
            .update({
              name: lead.name,
              stage: lead.stage,
              treatment: lead.treatment,
              tags: lead.tags,
              period: lead.period,
              score: lead.score,
              notes: lead.notes,
              booking_url: lead.booking_url,
            })
            .eq("id", leadId!);

          for (const ev of turn.events) {
            await supabaseAdmin.from("integration_events").insert({
              lead_id: leadId!,
              event: ev.event,
              status: 200,
              payload: { ...ev.payload, phone, channel: "whatsapp" },
            });
          }
        }

        for (const message of replies) {
          await supabaseAdmin
            .from("lead_messages")
            .insert({ lead_id: leadId!, direction: "bot", body: message });
        }

        if (!zapi.enabled) {
          return Response.json({ ok: true, lead_id: leadId, sent: 0, reason: "zapi_disabled" });
        }

        if (!zapi.credentials) {
          await supabaseAdmin.from("integration_events").insert({
            lead_id: leadId!,
            event: "whatsapp.send_failed",
            status: 503,
            payload: { reason: "Credenciais da Z-API não configuradas", phone },
          });
          return Response.json({ ok: false, reason: "missing_zapi_credentials" }, { status: 200 });
        }

        for (const message of replies) {
          const res = await sendWhatsAppText(zapi.credentials, phone, message);
          await supabaseAdmin.from("integration_events").insert({
            lead_id: leadId!,
            event: res.ok ? "whatsapp.message_sent" : "whatsapp.send_failed",
            status: res.status,
            payload: { phone, message, response: res.body },
          });
        }

        return Response.json({ ok: true, lead_id: leadId, sent: replies.length });
      },
    },
  },
});

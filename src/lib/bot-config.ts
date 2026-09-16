import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_SETTINGS, type BotConfig, type BotQuestion, type BotOption } from "./bot-engine";

/** Loads treatments, questions and clinic settings from the database. */
export async function loadBotConfig(client: SupabaseClient<any, any, any>): Promise<BotConfig> {
  const [settingsRes, treatmentsRes, questionsRes] = await Promise.all([
    client.from("app_settings").select("*").limit(1).maybeSingle(),
    client.from("treatments").select("*").eq("active", true).order("sort_order"),
    client.from("questions").select("*").eq("active", true).order("sort_order"),
  ]);

  const s = (settingsRes.data ?? {}) as Record<string, unknown>;

  return {
    settings: {
      clinic_name: (s['clinic_name'] as string) ?? DEFAULT_SETTINGS.clinic_name,
      clinic_whatsapp: (s['clinic_whatsapp'] as string) ?? "",
      booking_url: (s['booking_url'] as string) ?? "",
      greeting: (s['greeting'] as string) ?? DEFAULT_SETTINGS.greeting,
      periods: ((s['periods'] as string[]) ?? DEFAULT_SETTINGS.periods).filter(Boolean),
      forward_enabled: (s['forward_enabled'] as boolean) ?? true,
    },
    treatments: (treatmentsRes.data ?? []).map((t: Record<string, unknown>) => ({
      id: t['id'] as string,
      label: t['label'] as string,
      ticket: (t['ticket'] as string) ?? "",
    })),
    questions: (questionsRes.data ?? []).map(
      (q: Record<string, unknown>): BotQuestion => ({
        id: q['id'] as string,
        prompt: q['prompt'] as string,
        options: ((q['options'] as BotOption[]) ?? []).map((o) => ({
          label: o.label,
          points: Number(o.points ?? 0),
          tag: o.tag || undefined,
          disqualify: Boolean(o.disqualify),
        })),
      }),
    ),
  };
}

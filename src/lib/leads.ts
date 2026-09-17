import type { BotLead } from "./bot-engine";
import type { Lead, StageId } from "./funnel";

export type LeadRow = Record<string, any>;

export function rowToLead(row: LeadRow): Lead {
  return {
    id: row['id'] as string,
    name: (row['name'] as string) ?? "Contato novo",
    phone: (row['phone'] as string) ?? "",
    stage: ((row['stage'] as string) ?? "novo") as StageId,
    treatment: (row['treatment'] as string) ?? undefined,
    tags: (row['tags'] as string[]) ?? [],
    period: (row['period'] as string) ?? undefined,
    score: Number(row['score'] ?? 20),
    source: (row['source'] as string) ?? "WhatsApp",
    createdAt: new Date(row['created_at'] ?? Date.now()).getTime(),
    updatedAt: new Date(row['updated_at'] ?? Date.now()).getTime(),
    notes: (row['notes'] as { label: string; value: string }[]) ?? [],
  };
}

export function rowToBotLead(row: LeadRow): BotLead {
  return {
    name: (row['name'] as string) ?? "Contato novo",
    stage: ((row['stage'] as string) ?? "novo") as StageId,
    treatment: (row['treatment'] as string) ?? null,
    tags: (row['tags'] as string[]) ?? [],
    period: (row['period'] as string) ?? null,
    score: Number(row['score'] ?? 20),
    notes: (row['notes'] as BotLead["notes"]) ?? [],
    booking_url: (row['booking_url'] as string) ?? null,
  };
}

export const randomPhone = () => {
  const n = Math.floor(10000000 + Math.random() * 89999999).toString();
  return `+55 11 9${n.slice(0, 4)}-${n.slice(4)}`;
};

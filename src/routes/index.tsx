import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  MessageCircle,
  Settings,
  Stethoscope,
  Webhook,
  Zap,
} from "lucide-react";

import { CrmBoard } from "@/components/crm-board";
import { WhatsAppSimulator } from "@/components/whatsapp-simulator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { loadBotConfig } from "@/lib/bot-config";
import { DEFAULT_LEAD_NAME, type BotLead } from "@/lib/bot-engine";
import { STAGES, timeOf, type Lead } from "@/lib/funnel";
import { randomPhone, rowToBotLead, rowToLead, type LeadRow } from "@/lib/leads";
import { sendLiaMessage } from "@/lib/zapi.functions";

const TITLE = "Funil WhatsApp + CRM para Clínicas | Vitreo Flow";
const DESCRIPTION =
  "Simulador interativo de triagem no WhatsApp com painel CRM Kanban que move o lead em tempo real: tags de procedimento, qualificação e webhooks de integração.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const qc = useQueryClient();
  const sendReal = useServerFn(sendLiaMessage);
  const [activeId, setActiveId] = useState<string>("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["bot-config"],
    queryFn: () => loadBotConfig(supabase as never),
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  // Atualização em tempo real do CRM
  useEffect(() => {
    const channel = supabase
      .channel("crm-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        qc.invalidateQueries({ queryKey: ["leads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "integration_events" }, () => {
        qc.invalidateQueries({ queryKey: ["events"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const startConversation = async () => {
    if (creating) return;
    setCreating(true);
    const phone = randomPhone();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: DEFAULT_LEAD_NAME,
        phone,
        stage: "novo",
        score: 20,
        source: "Simulador WhatsApp",
        tags: [],
        notes: [],
      })
      .select("*")
      .single();
    setCreating(false);
    if (error || !data) return;
    setActiveId(data.id);
    setSelected(null);
    await supabase.from("integration_events").insert({
      lead_id: data.id,
      event: "lead.created",
      status: 200,
      payload: { phone, channel: "whatsapp" },
    });
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  // Cria o lead da conversa apenas no cliente (evita divergência de renderização)
  useEffect(() => {
    if (!activeId) void startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leads = useMemo(() => rows.map(rowToLead), [rows]);
  const activeRow = rows.find((r) => r['id'] === activeId);
  const activeBotLead: BotLead | null = activeRow ? rowToBotLead(activeRow) : null;

  const persist = async (patch: Partial<BotLead>) => {
    if (!activeRow) return;
    const next = { ...rowToBotLead(activeRow), ...patch };
    await supabase
      .from("leads")
      .update({
        name: next.name,
        stage: next.stage,
        treatment: next.treatment,
        tags: next.tags,
        period: next.period,
        score: next.score,
        notes: next.notes,
        booking_url: next.booking_url,
      })
      .eq("id", activeId);
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  const saveMessages = async (items: { direction: "bot" | "user"; body: string }[]) => {
    if (!activeId || items.length === 0) return;
    await supabase
      .from("lead_messages")
      .insert(items.map((m) => ({ lead_id: activeId, direction: m.direction, body: m.body })));
  };

  const forwardToWhatsApp = async (replies: string[]) => {
    const clinic = config?.settings.clinic_whatsapp?.trim();
    if (!config?.settings.forward_enabled || !clinic || !activeId) return;
    for (const message of replies) {
      await sendReal({ data: { leadId: activeId, phone: clinic, message } });
    }
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const onTurn = async ({
    userText,
    replies,
    patch,
    events: turnEvents,
  }: {
    userText: string;
    replies: string[];
    patch: Partial<BotLead>;
    events: { event: string; payload: Record<string, unknown> }[];
  }) => {
    await saveMessages([
      { direction: "user", body: userText },
      ...replies.map((body) => ({ direction: "bot" as const, body })),
    ]);
    await persist(patch);
    if (turnEvents.length && activeId) {
      await supabase.from("integration_events").insert(
        turnEvents.map((e) => ({
          lead_id: activeId,
          event: e.event,
          status: 200,
          payload: { ...e.payload, channel: "whatsapp" },
        })),
      );
      qc.invalidateQueries({ queryKey: ["events"] });
    }
    void forwardToWhatsApp(replies);
  };

  const kpis = useMemo(() => {
    const booked = leads.filter((l) => l.stage === "agendado").length;
    const qualified = leads.filter((l) => ["qualificado", "agendado"].includes(l.stage)).length;
    return {
      total: leads.length,
      qualified,
      booked,
      rate: Math.round((booked / Math.max(1, leads.length)) * 100),
    };
  }, [leads]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Stethoscope className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                {config?.settings.clinic_name ?? "Vitreo Flow"}
              </h1>
              <p className="text-xs text-muted-foreground">
                Funil de vendas no WhatsApp + CRM para clínicas
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Kpi icon={MessageCircle} label="Leads" value={String(kpis.total)} />
            <Kpi icon={Zap} label="Qualificados" value={String(kpis.qualified)} />
            <Kpi icon={CheckCircle2} label="Agendados" value={String(kpis.booked)} />
            <Kpi icon={Activity} label="Conversão" value={`${kpis.rate}%`} />
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/agendamentos">
                <CalendarDays className="size-4" aria-hidden /> Agendamentos
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/admin">
                <Settings className="size-4" aria-hidden /> Administração
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-5 py-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="h-[680px]">
          {config && activeRow && activeBotLead ? (
            <WhatsAppSimulator
              key={activeId}
              leadId={activeId}
              phone={(activeRow['phone'] as string) ?? ""}
              lead={activeBotLead}
              config={config}
              clinicName={config.settings.clinic_name}
              onTurn={onTurn}
              onOpening={(replies) =>
                void saveMessages(replies.map((body) => ({ direction: "bot" as const, body })))
              }
              onRestart={() => void startConversation()}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-3xl border border-border bg-card text-sm text-muted-foreground">
              Abrindo conversa…
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Pipeline comercial</h2>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <span className="size-1.5 animate-pulse rounded-full bg-stage-booked" />
                sincronizando em tempo real
              </Badge>
              <p className="ml-auto text-xs text-muted-foreground">
                Clique em um card para ver a ficha do lead
              </p>
            </div>
            <CrmBoard leads={leads} activeId={activeId} onSelect={setSelected} />
          </div>

          <section className="rounded-3xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Webhook className="size-4 text-primary" aria-hidden />
              <h2 className="text-base font-semibold">Webhooks de integração</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                registrados no banco de dados
              </span>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto font-mono text-[11px]">
              {events.map((e) => (
                <div key={e['id']} className="rounded-xl border border-border bg-secondary/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-stage-booked/25 px-1.5 py-0.5 font-bold">
                      {e['status']}
                    </span>
                    <span className="font-semibold text-primary">{e['event']}</span>
                    <span className="ml-auto text-muted-foreground">
                      {timeOf(new Date(e['created_at']).getTime())}
                    </span>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
                    {JSON.stringify(e['payload'], null, 2)}
                  </pre>
                </div>
              ))}
              {events.length === 0 ? (
                <p className="font-sans text-sm text-muted-foreground">
                  Nenhuma integração registrada ainda.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  {selected.phone} · origem {selected.source}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{STAGES.find((s) => s.id === selected.stage)?.label}</Badge>
                <Badge variant="outline">Score {selected.score}</Badge>
                {selected.period ? <Badge variant="outline">{selected.period}</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.tags.length ? (
                  selected.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Sem tags de procedimento ainda.</p>
                )}
              </div>
              <Separator />
              <dl className="space-y-2 text-sm">
                {selected.notes.length ? (
                  selected.notes.map((n) => (
                    <div key={n.label} className="flex gap-3">
                      <dt className="w-40 shrink-0 text-muted-foreground">{n.label}</dt>
                      <dd className="font-medium">{n.value}</dd>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    O bot ainda não coletou respostas deste lead.
                  </p>
                )}
                <div className="flex gap-3">
                  <dt className="w-40 shrink-0 text-muted-foreground">Entrou em</dt>
                  <dd className="font-medium">{timeOf(selected.createdAt)}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-40 shrink-0 text-muted-foreground">Atualizado</dt>
                  <dd className="font-medium">{timeOf(selected.updatedAt)}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/60 px-3 py-2">
      <Icon className="size-4 text-primary" aria-hidden />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold leading-none">{value}</p>
      </div>
    </div>
  );
}

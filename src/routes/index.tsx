import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Activity, CheckCircle2, MessageCircle, Stethoscope, Webhook, Zap } from "lucide-react";

import { CrmBoard } from "@/components/crm-board";
import { WhatsAppSimulator } from "@/components/whatsapp-simulator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  STAGES,
  randomPhone,
  seedLeads,
  timeOf,
  uid,
  type Lead,
  type WebhookEvent,
} from "@/lib/funnel";

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

const newLead = (): Lead => ({
  id: uid(),
  name: "Contato novo",
  phone: randomPhone(),
  stage: "novo",
  tags: [],
  score: 20,
  source: "WhatsApp Business API",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  notes: [],
});

function Index() {
  const [first] = useState(newLead);
  const [leads, setLeads] = useState<Lead[]>([first, ...seedLeads]);
  const [activeId, setActiveId] = useState(first.id);
  const [events, setEvents] = useState<WebhookEvent[]>([
    {
      id: uid(),
      event: "lead.created",
      status: 200,
      at: Date.now(),
      payload: { lead_id: first.id, phone: first.phone, channel: "whatsapp" },
    },
  ]);
  const [selected, setSelected] = useState<Lead | null>(null);

  const activeLead = leads.find((l) => l.id === activeId) ?? first;

  const onWebhook = useCallback((event: string, payload: Record<string, unknown>) => {
    setEvents((prev) => [
      { id: uid(), event, status: 200, at: Date.now(), payload },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const onPatch = useCallback(
    (patch: Partial<Lead>) => {
      setLeads((prev) =>
        prev.map((l) => (l.id === activeId ? { ...l, ...patch, updatedAt: Date.now() } : l)),
      );
      setSelected((s) => (s && s.id === activeId ? { ...s, ...patch, updatedAt: Date.now() } : s));
    },
    [activeId],
  );

  const onRestart = useCallback(() => {
    const lead = newLead();
    setLeads((prev) => [lead, ...prev]);
    setActiveId(lead.id);
    setSelected(null);
    onWebhook("lead.created", { lead_id: lead.id, phone: lead.phone, channel: "whatsapp" });
  }, [onWebhook]);

  const kpis = useMemo(() => {
    const booked = leads.filter((l) => l.stage === "agendado").length;
    const qualified = leads.filter((l) =>
      ["qualificado", "agendado"].includes(l.stage),
    ).length;
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
              <h1 className="text-lg font-semibold leading-tight">Vitreo Flow</h1>
              <p className="text-xs text-muted-foreground">
                Funil de vendas no WhatsApp + CRM para clínicas
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Kpi icon={MessageCircle} label="Leads" value={String(kpis.total)} />
            <Kpi icon={Zap} label="Qualificados" value={String(kpis.qualified)} />
            <Kpi icon={CheckCircle2} label="Agendados" value={String(kpis.booked)} />
            <Kpi icon={Activity} label="Conversão" value={`${kpis.rate}%`} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-5 py-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="h-[680px]">
          <WhatsAppSimulator
            key={activeLead.id}
            lead={activeLead}
            onPatch={onPatch}
            onWebhook={onWebhook}
            onRestart={onRestart}
          />
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
            <CrmBoard leads={leads} activeId={activeLead.id} onSelect={setSelected} />
          </div>

          <section className="rounded-3xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Webhook className="size-4 text-primary" aria-hidden />
              <h2 className="text-base font-semibold">Webhooks de integração</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                POST https://api.clinica.app/hooks/crm
              </span>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto font-mono text-[11px]">
              {events.map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-secondary/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-stage-booked/25 px-1.5 py-0.5 font-bold">
                      {e.status} OK
                    </span>
                    <span className="font-semibold text-primary">{e.event}</span>
                    <span className="ml-auto text-muted-foreground">{timeOf(e.at)}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </div>
              ))}
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

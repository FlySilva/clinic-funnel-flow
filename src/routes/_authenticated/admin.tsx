import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Plus, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, timeOf } from "@/lib/funnel";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração do funil | Vitreo Flow" },
      {
        name: "description",
        content:
          "Edite tratamentos, perguntas de qualificação, tags e acompanhe leads e integrações da clínica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Row = Record<string, any>;

function useTable(table: string, order: string) {
  return useQuery({
    queryKey: ["admin", table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table as never).select("*").order(order as never);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Administração do funil</h1>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">Ver funil</Link>
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm" className="gap-1">
              <LogOut className="size-4" aria-hidden /> Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <Tabs defaultValue="tratamentos">
          <TabsList className="flex-wrap">
            <TabsTrigger value="tratamentos">Tratamentos</TabsTrigger>
            <TabsTrigger value="perguntas">Perguntas</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="clinica">Clínica</TabsTrigger>
          </TabsList>

          <TabsContent value="tratamentos" className="mt-4">
            <TreatmentsTab />
          </TabsContent>
          <TabsContent value="perguntas" className="mt-4">
            <QuestionsTab />
          </TabsContent>
          <TabsContent value="tags" className="mt-4">
            <TagsTab />
          </TabsContent>
          <TabsContent value="leads" className="mt-4">
            <LeadsTab />
          </TabsContent>
          <TabsContent value="integracoes" className="mt-4">
            <EventsTab />
          </TabsContent>
          <TabsContent value="clinica" className="mt-4">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

/* ---------------- Tratamentos ---------------- */

function TreatmentsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useTable("treatments", "sort_order");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "treatments"] });

  const add = async () => {
    await supabase
      .from("treatments")
      .insert({ label: "Novo tratamento", ticket: "", sort_order: data.length + 1 });
    refresh();
  };

  return (
    <Panel
      title="Tratamentos do menu"
      action={
        <Button size="sm" onClick={add} className="gap-1">
          <Plus className="size-4" aria-hidden /> Adicionar
        </Button>
      }
    >
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
      <div className="space-y-3">
        {data.map((row) => (
          <TreatmentRow key={row['id']} row={row} onSaved={refresh} />
        ))}
      </div>
    </Panel>
  );
}

function TreatmentRow({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [label, setLabel] = useState(row['label'] as string);
  const [ticket, setTicket] = useState((row['ticket'] as string) ?? "");
  const [active, setActive] = useState(Boolean(row['active']));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase.from("treatments").update({ label, ticket, active }).eq("id", row['id']);
    setSaving(false);
    onSaved();
  };
  const remove = async () => {
    await supabase.from("treatments").delete().eq("id", row['id']);
    onSaved();
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label>Nome</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="w-40 space-y-1.5">
        <Label>Ticket médio</Label>
        <Input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="R$ 1.200" />
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Switch checked={active} onCheckedChange={setActive} id={`t-${row['id']}`} />
        <Label htmlFor={`t-${row['id']}`}>Ativo</Label>
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="gap-1">
        <Save className="size-4" aria-hidden /> Salvar
      </Button>
      <Button size="sm" variant="ghost" onClick={remove} aria-label="Excluir tratamento">
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/* ---------------- Perguntas ---------------- */

type OptionRow = { label: string; points: number; tag: string; disqualify: boolean };

function QuestionsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useTable("questions", "sort_order");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "questions"] });

  const add = async () => {
    await supabase.from("questions").insert({
      prompt: "Nova pergunta de qualificação",
      options: [{ label: "Opção 1", points: 10, tag: "", disqualify: false }],
      sort_order: data.length + 1,
    });
    refresh();
  };

  return (
    <Panel
      title="Perguntas de qualificação"
      action={
        <Button size="sm" onClick={add} className="gap-1">
          <Plus className="size-4" aria-hidden /> Adicionar
        </Button>
      }
    >
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
      <div className="space-y-4">
        {data.map((row) => (
          <QuestionRow key={row['id']} row={row} onSaved={refresh} />
        ))}
      </div>
    </Panel>
  );
}

function QuestionRow({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(row['prompt'] as string);
  const [active, setActive] = useState(Boolean(row['active']));
  const [options, setOptions] = useState<OptionRow[]>(
    ((row['options'] as OptionRow[]) ?? []).map((o) => ({
      label: o.label ?? "",
      points: Number(o.points ?? 0),
      tag: o.tag ?? "",
      disqualify: Boolean(o.disqualify),
    })),
  );

  const setOption = (i: number, patch: Partial<OptionRow>) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const save = async () => {
    await supabase.from("questions").update({ prompt, options, active }).eq("id", row['id']);
    onSaved();
  };
  const remove = async () => {
    await supabase.from("questions").delete().eq("id", row['id']);
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-secondary/40 p-3">
      <div className="space-y-1.5">
        <Label>Pergunta</Label>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Respostas</Label>
        {options.map((o, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-2">
            <div className="min-w-44 flex-1 space-y-1">
              <Label className="text-[11px]">Texto</Label>
              <Input value={o.label} onChange={(e) => setOption(i, { label: e.target.value })} />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-[11px]">Pontos</Label>
              <Input
                type="number"
                value={o.points}
                onChange={(e) => setOption(i, { points: Number(e.target.value) })}
              />
            </div>
            <div className="w-36 space-y-1">
              <Label className="text-[11px]">Tag</Label>
              <Input value={o.tag} onChange={(e) => setOption(i, { tag: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                checked={o.disqualify}
                onCheckedChange={(v) => setOption(i, { disqualify: v })}
              />
              <span className="text-xs text-muted-foreground">Desqualifica</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Remover resposta"
              onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() =>
            setOptions((prev) => [...prev, { label: "Nova resposta", points: 10, tag: "", disqualify: false }])
          }
        >
          <Plus className="size-4" aria-hidden /> Resposta
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} id={`q-${row['id']}`} />
          <Label htmlFor={`q-${row['id']}`}>Ativa</Label>
        </div>
        <Button size="sm" onClick={save} className="ml-auto gap-1">
          <Save className="size-4" aria-hidden /> Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} aria-label="Excluir pergunta">
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Tags ---------------- */

function TagsTab() {
  const qc = useQueryClient();
  const { data = [] } = useTable("tags", "label");
  const [label, setLabel] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "tags"] });

  const add = async () => {
    if (!label.trim()) return;
    await supabase.from("tags").insert({ label: label.trim() });
    setLabel("");
    refresh();
  };

  return (
    <Panel title="Tags de procedimento e perfil">
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          value={label}
          placeholder="Nova tag"
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button onClick={add} className="gap-1">
          <Plus className="size-4" aria-hidden /> Adicionar
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.map((row) => (
          <span
            key={row['id']}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-xs"
          >
            {row['label']}
            <button
              type="button"
              aria-label={`Excluir tag ${row['label']}`}
              onClick={async () => {
                await supabase.from("tags").delete().eq("id", row['id']);
                refresh();
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" aria-hidden />
            </button>
          </span>
        ))}
      </div>
    </Panel>
  );
}

/* ---------------- Leads ---------------- */

function LeadsTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 8000,
  });

  return (
    <Panel title={`Leads (${data.length})`}>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
      <div className="space-y-2">
        {data.map((l) => (
          <div key={l['id']} className="rounded-2xl border border-border bg-secondary/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{l['name']}</p>
              <span className="text-xs text-muted-foreground">{l['phone']}</span>
              <Badge variant="secondary" className="text-[10px]">
                {STAGES.find((s) => s.id === l['stage'])?.label ?? l['stage']}
              </Badge>
              {l['treatment'] ? (
                <Badge variant="outline" className="text-[10px]">
                  {l['treatment']}
                </Badge>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">
                score {l['score']} · {timeOf(new Date(l['updated_at']).getTime())}
              </span>
            </div>
            {Array.isArray(l['notes']) && l['notes'].length ? (
              <>
                <Separator className="my-2" />
                <dl className="grid gap-1 text-xs sm:grid-cols-2">
                  {(l['notes'] as { label: string; value: string }[]).map((n, i) => (
                    <div key={i} className="flex gap-2">
                      <dt className="text-muted-foreground">{n.label}:</dt>
                      <dd className="font-medium">{n.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
          </div>
        ))}
        {!isLoading && data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lead registrado ainda.</p>
        ) : null}
      </div>
    </Panel>
  );
}

/* ---------------- Integrações ---------------- */

function EventsTab() {
  const { data = [] } = useQuery({
    queryKey: ["admin", "integration_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 8000,
  });

  return (
    <Panel title="Integrações e mensagens enviadas">
      <div className="space-y-2 font-mono text-[11px]">
        {data.map((e) => (
          <div key={e['id']} className="rounded-xl border border-border bg-secondary/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-card px-1.5 py-0.5 font-bold">{e['status']}</span>
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
        {data.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground">Nenhuma integração registrada.</p>
        ) : null}
      </div>
    </Panel>
  );
}

/* ---------------- Clínica ---------------- */

function SettingsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as Row | null;
    },
  });

  const [form, setForm] = useState<Row | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!form) return <Panel title="Dados da clínica">Carregando…</Panel>;

  const save = async () => {
    await supabase
      .from("app_settings")
      .update({
        clinic_name: form['clinic_name'],
        clinic_whatsapp: form['clinic_whatsapp'],
        booking_url: form['booking_url'],
        greeting: form['greeting'],
        periods: String(form['periods'])
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean),
        forward_enabled: form['forward_enabled'],
      })
      .eq("id", form['id']);
    qc.invalidateQueries({ queryKey: ["admin", "app_settings"] });
    qc.invalidateQueries({ queryKey: ["bot-config"] });
  };

  const periodsText = Array.isArray(form['periods'])
    ? (form['periods'] as string[]).join("\n")
    : String(form['periods'] ?? "");

  return (
    <Panel title="Dados da clínica">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome da clínica</Label>
          <Input
            value={form['clinic_name'] ?? ""}
            onChange={(e) => setForm({ ...form, clinic_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>WhatsApp da clínica</Label>
          <Input
            value={form['clinic_whatsapp'] ?? ""}
            placeholder="5511999999999"
            onChange={(e) => setForm({ ...form, clinic_whatsapp: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Link de agendamento</Label>
          <Input
            value={form['booking_url'] ?? ""}
            placeholder="https://agenda.clinica.com.br"
            onChange={(e) => setForm({ ...form, booking_url: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Saudação da Lia</Label>
          <Textarea
            rows={3}
            value={form['greeting'] ?? ""}
            onChange={(e) => setForm({ ...form, greeting: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Períodos de atendimento (um por linha)</Label>
          <Textarea
            rows={3}
            value={periodsText}
            onChange={(e) => setForm({ ...form, periods: e.target.value })}
          />
        </div>
      </div>
      <Button className="mt-4 gap-1" onClick={save}>
        <Save className="size-4" aria-hidden /> Salvar alterações
      </Button>
    </Panel>
  );
}

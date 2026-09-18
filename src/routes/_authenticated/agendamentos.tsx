import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { timeOf } from "@/lib/funnel";

export const Route = createFileRoute("/_authenticated/agendamentos")({
  head: () => ({
    meta: [
      { title: "Agendamentos confirmados | Vitreo Flow" },
      {
        name: "description",
        content:
          "Acompanhe os leads agendados da clínica com data, horário, procedimento e observações de cada avaliação confirmada.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppointmentsPage,
});

type Row = Record<string, any>;

function AppointmentsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("stage", "agendado")
        .order("appointment_date", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 8000,
  });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Agendamentos</h1>
            <p className="text-xs text-muted-foreground">
              {data.length} avaliação(ões) confirmada(s)
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">Ver funil</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Administração</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-3 px-5 py-6">
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
        {data.map((row) => (
          <AppointmentCard key={row['id']} row={row} />
        ))}
        {!isLoading && data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum lead agendado ainda. Assim que a Lia confirmar um horário, ele aparece aqui.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function AppointmentCard({ row }: { row: Row }) {
  const qc = useQueryClient();
  const [date, setDate] = useState((row['appointment_date'] as string) ?? "");
  const [time, setTime] = useState((row['appointment_time'] as string) ?? "");
  const [notes, setNotes] = useState((row['appointment_notes'] as string) ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase
      .from("leads")
      .update({
        appointment_date: date || null,
        appointment_time: time || null,
        appointment_notes: notes || null,
      })
      .eq("id", row['id']);
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{row['name']}</p>
        <span className="text-xs text-muted-foreground">{row['phone']}</span>
        {row['treatment'] ? <Badge variant="secondary">{row['treatment']}</Badge> : null}
        {row['period'] ? <Badge variant="outline">{row['period']}</Badge> : null}
        <span className="ml-auto text-xs text-muted-foreground">
          atualizado {timeOf(new Date(row['updated_at']).getTime())}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[180px_160px_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Horário</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <Button size="sm" className="gap-1" onClick={save} disabled={saving}>
        <Save className="size-4" aria-hidden /> Salvar agendamento
      </Button>
    </section>
  );
}

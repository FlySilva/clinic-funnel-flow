import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Phone, RotateCcw, Send, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TREATMENTS, timeOf, uid, type ChatMessage, type Lead } from "@/lib/funnel";

type Step = "menu" | "experiencia" | "orcamento" | "nome" | "periodo" | "fim" | "perdido";

const BUDGETS = [
  { label: "Até R$ 1.000", points: 10 },
  { label: "Entre R$ 1.000 e R$ 3.000", points: 22 },
  { label: "Acima de R$ 3.000", points: 32 },
  { label: "Só estou pesquisando preço", points: -100 },
];

const PERIODS = ["Manhã (8h às 12h)", "Tarde (12h às 18h)", "Noite (18h às 20h)"];

type Props = {
  lead: Lead;
  onPatch: (patch: Partial<Lead>) => void;
  onWebhook: (event: string, payload: Record<string, unknown>) => void;
  onRestart: () => void;
};

export function WhatsAppSimulator({ lead, onPatch, onWebhook, onRestart }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<Step>("menu");
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pushBot = useCallback((text: string, delay = 700) => {
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: uid(), from: "bot", text, at: Date.now() }]);
    }, delay);
    timers.current.push(t);
  }, []);

  // Abertura do bot de triagem
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]);
    setStep("menu");
    setDraft("");
    pushBot(
      "Olá! Aqui é a Lia, assistente virtual da Clínica Vitreo ✨\nQue bom ter você por aqui!",
      500,
    );
    pushBot(
      "Para eu te direcionar ao especialista certo, escolha o tratamento de interesse:\n\n" +
        TREATMENTS.map((t, i) => `${i + 1}) ${t.label}`).join("\n"),
      1500,
    );
    return () => timers.current.forEach(clearTimeout);
  }, [lead.id, pushBot]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const pushUser = (text: string) =>
    setMessages((m) => [...m, { id: uid(), from: "user", text, at: Date.now() }]);

  const answer = (index: number, label: string) => {
    pushUser(label);

    if (step === "menu") {
      const treatment = TREATMENTS[index]!;
      onPatch({
        stage: "triagem",
        treatment: treatment.label,
        tags: [treatment.label],
        score: 35,
        notes: [{ label: "Interesse", value: `${treatment.label} · ticket médio ${treatment.ticket}` }],
      });
      onWebhook("lead.stage_changed", {
        lead_id: lead.id,
        from: "novo",
        to: "triagem",
        treatment: treatment.key,
      });
      pushBot(
        `Perfeito! ${treatment.label} é um dos nossos queridinhos 💚\n\nVocê já realizou esse procedimento antes?\n\n1) Sim, já realizei\n2) Não, seria a primeira vez`,
        1100,
      );
      setStep("experiencia");
      return;
    }

    if (step === "experiencia") {
      const already = index === 0;
      onPatch({
        score: lead.score + (already ? 15 : 8),
        tags: [...lead.tags, already ? "Retorno" : "Primeira vez"],
        notes: [...lead.notes, { label: "Já realizou", value: already ? "Sim" : "Não" }],
      });
      pushBot(
        "Anotado! E qual faixa de investimento você tem em mente para esse cuidado?\n\n" +
          BUDGETS.map((b, i) => `${i + 1}) ${b.label}`).join("\n"),
        1100,
      );
      setStep("orcamento");
      return;
    }

    if (step === "orcamento") {
      const budget = BUDGETS[index]!;
      if (budget.points < 0) {
        onPatch({
          stage: "desqualificado",
          score: 15,
          tags: [...lead.tags, "Sem orçamento"],
          notes: [...lead.notes, { label: "Orçamento", value: budget.label }],
        });
        onWebhook("lead.disqualified", {
          lead_id: lead.id,
          reason: "budget_not_defined",
          nurture_sequence: "conteudo_educativo_30d",
        });
        pushBot(
          "Sem problemas! Vou te enviar nossos conteúdos e promoções por aqui. Quando quiser agendar, é só me chamar 🌿",
          1100,
        );
        setStep("perdido");
        return;
      }
      onPatch({
        stage: "qualificado",
        score: Math.min(98, lead.score + budget.points),
        tags: [...lead.tags, "Alta intenção"],
        notes: [...lead.notes, { label: "Orçamento", value: budget.label }],
      });
      onWebhook("lead.qualified", {
        lead_id: lead.id,
        budget: budget.label,
        assigned_to: "Consultora Bruna",
      });
      pushBot("Ótimo! Para registrar sua ficha, me diga seu nome completo, por favor.", 1100);
      setStep("nome");
      return;
    }

    if (step === "periodo") {
      const period = PERIODS[index]!;
      onPatch({
        stage: "agendado",
        period,
        score: Math.min(99, lead.score + 10),
        tags: [...lead.tags, "Avaliação marcada"],
        notes: [...lead.notes, { label: "Melhor período", value: period }],
      });
      onWebhook("appointment.created", {
        lead_id: lead.id,
        patient: lead.name,
        procedure: lead.treatment,
        preferred_window: period,
        calendar: "Unidade Jardins",
      });
      pushBot(
        `Prontinho, ${lead.name.split(" ")[0]}! Sua avaliação foi reservada para o período da ${(period.split(" ")[0] ?? "").toLowerCase()} 💚\nNossa equipe confirma o horário exato em instantes.`,
        1200,
      );
      setStep("fim");
    }
  };

  const sendText = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft("");

    if (step === "nome") {
      pushUser(value);
      onPatch({
        name: value,
        score: Math.min(98, lead.score + 5),
        notes: [...lead.notes, { label: "Nome completo", value }],
      });
      onWebhook("lead.updated", { lead_id: lead.id, full_name: value });
      pushBot(
        `Obrigada, ${value.split(" ")[0]}! Qual o melhor período para sua avaliação?\n\n` +
          PERIODS.map((p, i) => `${i + 1}) ${p}`).join("\n"),
        1100,
      );
      setStep("periodo");
      return;
    }

    // Nas etapas de menu o paciente também pode digitar o número da opção
    const options =
      step === "menu"
        ? TREATMENTS.map((t) => t.label)
        : step === "experiencia"
          ? ["Sim, já realizei", "Não, seria a primeira vez"]
          : step === "orcamento"
            ? BUDGETS.map((b) => b.label)
            : step === "periodo"
              ? PERIODS
              : [];
    const idx = Number(value) - 1;
    if (options[idx]) {
      answer(idx, options[idx]!);
    } else {
      pushUser(value);
      pushBot("Não entendi 😅 Responda com o número de uma das opções acima.", 800);
    }
  };

  const quickReplies =
    step === "menu"
      ? TREATMENTS.map((t) => t.label)
      : step === "experiencia"
        ? ["Sim, já realizei", "Não, seria a primeira vez"]
        : step === "orcamento"
          ? BUDGETS.map((b) => b.label)
          : step === "periodo"
            ? PERIODS
            : [];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 bg-wa-header px-4 py-3 text-primary-foreground">
        <div className="flex size-10 items-center justify-center rounded-full bg-wa-out text-sm font-bold text-wa-out-foreground">
          LV
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Clínica Vitreo · Lia</p>
          <p className="text-xs opacity-75">{typing ? "digitando…" : "online"}</p>
        </div>
        <Phone className="size-4 opacity-80" aria-hidden />
        <Video className="size-4 opacity-80" aria-hidden />
        <button
          type="button"
          onClick={onRestart}
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium transition hover:bg-white/25"
        >
          <RotateCcw className="size-3" aria-hidden /> Nova conversa
        </button>
      </div>

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-wa-bg px-4 py-4">
        <p className="mx-auto w-fit rounded-full bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
          {lead.phone}
        </p>
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[82%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm shadow-sm",
                m.from === "user"
                  ? "rounded-br-sm bg-wa-out text-wa-out-foreground"
                  : "rounded-bl-sm bg-wa-in text-card-foreground",
              )}
            >
              {m.text}
              <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
                {timeOf(m.at)}
                {m.from === "user" ? (
                  <CheckCheck className="size-3" aria-hidden />
                ) : (
                  <Check className="size-3" aria-hidden />
                )}
              </span>
            </div>
          </div>
        ))}
        {typing ? (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-wa-in px-3 py-3 shadow-sm">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {quickReplies.length > 0 && !typing ? (
        <div className="flex flex-wrap gap-2 border-t border-border bg-card px-3 py-3">
          {quickReplies.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => answer(i, label)}
              className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition hover:border-primary hover:bg-accent"
            >
              <span className="mr-1 font-bold text-primary">{i + 1}</span>
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
        className="flex items-center gap-2 border-t border-border bg-card px-3 py-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            step === "nome"
              ? "Digite o nome completo do paciente…"
              : step === "fim" || step === "perdido"
                ? "Conversa encerrada pelo bot"
                : "Digite o número da opção…"
          }
          disabled={step === "fim" || step === "perdido"}
          className="rounded-full"
          aria-label="Mensagem do paciente"
        />
        <Button
          type="submit"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          disabled={step === "fim" || step === "perdido"}
          aria-label="Enviar mensagem"
        >
          <Send className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

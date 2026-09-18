import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Phone, RotateCcw, Send, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { timeOf, uid, type ChatMessage } from "@/lib/funnel";
import {
  currentStep,
  handleReply,
  openingMessages,
  optionsFor,
  type BotConfig,
  type BotLead,
} from "@/lib/bot-engine";

type Props = {
  leadId: string;
  phone: string;
  lead: BotLead;
  config: BotConfig;
  clinicName: string;
  onTurn: (args: {
    userText: string;
    replies: string[];
    patch: Partial<BotLead>;
    events: { event: string; payload: Record<string, unknown> }[];
  }) => void;
  onOpening: (replies: string[]) => void;
  onRestart: () => void;
};

export function WhatsAppSimulator({
  leadId,
  phone,
  lead,
  config,
  clinicName,
  onTurn,
  onOpening,
  onRestart,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const opened = useRef<string>("");

  const pushBot = (text: string, delay: number) => {
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: uid(), from: "bot", text, at: Date.now() }]);
    }, delay);
    timers.current.push(t);
  };

  // Abertura do bot, com a saudação e o menu vindos do banco
  useEffect(() => {
    if (!leadId || opened.current === leadId) return;
    opened.current = leadId;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]);
    setDraft("");
    const replies = openingMessages(config);
    replies.forEach((text, i) => pushBot(text, 500 + i * 900));
    onOpening(replies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setMessages((m) => [...m, { id: uid(), from: "user", text: value, at: Date.now() }]);
    const turn = handleReply(lead, config, value);
    turn.replies.forEach((reply, i) => pushBot(reply, 900 + i * 800));
    onTurn({ userText: value, replies: turn.replies, patch: turn.patch, events: turn.events });
  };

  const step = currentStep(lead, config);
  const quickReplies = optionsFor(lead, config);
  const closed = step === "fim" || step === "perdido";
  const initials = clinicName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 bg-wa-header px-4 py-3 text-primary-foreground">
        <div className="flex size-10 items-center justify-center rounded-full bg-wa-out text-sm font-bold text-wa-out-foreground">
          {initials || "LV"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{clinicName} · Lia</p>
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
          {phone}
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
              onClick={() => send(label)}
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
          send(draft);
          setDraft("");
        }}
        className="flex items-center gap-2 border-t border-border bg-card px-3 py-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            step === "nome"
              ? "Digite o nome completo do paciente…"
              : closed
                ? "Conversa encerrada pelo bot"
                : "Digite o número da opção…"
          }
          disabled={closed}
          className="rounded-full"
          aria-label="Mensagem do paciente"
        />
        <Button
          type="submit"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          disabled={closed}
          aria-label="Enviar mensagem"
        >
          <Send className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

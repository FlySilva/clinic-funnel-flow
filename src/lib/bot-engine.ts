import type { StageId } from "./funnel";

export type Note = { label: string; value: string };

export type BotOption = {
  label: string;
  points?: number;
  tag?: string;
  disqualify?: boolean;
};

export type BotQuestion = { id: string; prompt: string; options: BotOption[] };
export type BotTreatment = { id: string; label: string; ticket: string };

export type BotSettings = {
  clinic_name: string;
  clinic_whatsapp: string;
  booking_url: string;
  greeting: string;
  periods: string[];
  forward_enabled: boolean;
};

export type BotConfig = {
  settings: BotSettings;
  treatments: BotTreatment[];
  questions: BotQuestion[];
};

export type BotLead = {
  name: string;
  stage: StageId;
  treatment: string | null;
  tags: string[];
  period: string | null;
  score: number;
  notes: Note[];
  booking_url: string | null;
};

export type BotStep = "menu" | "pergunta" | "nome" | "periodo" | "fim" | "perdido";

export const DEFAULT_LEAD_NAME = "Contato novo";

export const DEFAULT_SETTINGS: BotSettings = {
  clinic_name: "Clínica Vitreo",
  clinic_whatsapp: "",
  booking_url: "",
  greeting: "Olá! Aqui é a Lia, assistente virtual da Clínica Vitreo ✨",
  periods: ["Manhã (8h às 12h)", "Tarde (12h às 18h)", "Noite (18h às 20h)"],
  forward_enabled: true,
};

export function answeredQuestions(lead: BotLead, config: BotConfig): BotQuestion[] {
  return config.questions.filter((q) => lead.notes.some((n) => n.label === q.prompt));
}

export function currentQuestion(lead: BotLead, config: BotConfig): BotQuestion | null {
  return config.questions.find((q) => !lead.notes.some((n) => n.label === q.prompt)) ?? null;
}

export function currentStep(lead: BotLead, config: BotConfig): BotStep {
  if (lead.stage === "desqualificado") return "perdido";
  if (!lead.treatment) return "menu";
  if (currentQuestion(lead, config)) return "pergunta";
  if (!lead.name || lead.name === DEFAULT_LEAD_NAME) return "nome";
  if (!lead.period) return "periodo";
  return "fim";
}

export function optionsFor(lead: BotLead, config: BotConfig): string[] {
  const step = currentStep(lead, config);
  if (step === "menu") return config.treatments.map((t) => t.label);
  if (step === "pergunta") return (currentQuestion(lead, config)?.options ?? []).map((o) => o.label);
  if (step === "periodo") return config.settings.periods;
  return [];
}

const numbered = (items: string[]) => items.map((label, i) => `${i + 1}) ${label}`).join("\n");

export function promptFor(lead: BotLead, config: BotConfig): string | null {
  const step = currentStep(lead, config);
  if (step === "menu")
    return `Para eu te direcionar ao especialista certo, escolha o tratamento de interesse:\n\n${numbered(
      config.treatments.map((t) => t.label),
    )}`;
  if (step === "pergunta") {
    const q = currentQuestion(lead, config)!;
    return `${q.prompt}\n\n${numbered(q.options.map((o) => o.label))}`;
  }
  if (step === "nome") return "Para registrar sua ficha, me diga seu nome completo, por favor.";
  if (step === "periodo")
    return `Qual o melhor período para sua avaliação?\n\n${numbered(config.settings.periods)}`;
  return null;
}

export function openingMessages(config: BotConfig): string[] {
  const lead = emptyLead();
  return [config.settings.greeting, promptFor(lead, config) ?? ""].filter(Boolean);
}

export function emptyLead(): BotLead {
  return {
    name: DEFAULT_LEAD_NAME,
    stage: "novo",
    treatment: null,
    tags: [],
    period: null,
    score: 20,
    notes: [],
    booking_url: null,
  };
}

function resolveIndex(text: string, options: string[]): number {
  const value = text.trim();
  const asNumber = Number(value) - 1;
  if (Number.isInteger(asNumber) && options[asNumber]) return asNumber;
  const lower = value.toLowerCase();
  const exact = options.findIndex((o) => o.toLowerCase() === lower);
  if (exact >= 0) return exact;
  if (lower.length >= 4) {
    const partial = options.findIndex((o) => o.toLowerCase().includes(lower));
    if (partial >= 0) return partial;
  }
  return -1;
}

export type BotTurn = {
  patch: Partial<BotLead>;
  replies: string[];
  events: { event: string; payload: Record<string, unknown> }[];
};

export function handleReply(lead: BotLead, config: BotConfig, text: string): BotTurn {
  const step = currentStep(lead, config);
  const { booking_url } = config.settings;

  if (step === "fim" || step === "perdido") {
    return {
      patch: {},
      replies: ["Nossa equipe já está com sua ficha e responde por aqui em instantes 💚"],
      events: [],
    };
  }

  if (step === "nome") {
    const name = text.trim();
    if (name.length < 2) {
      return { patch: {}, replies: ["Pode me enviar seu nome completo, por favor?"], events: [] };
    }
    const patch: Partial<BotLead> = {
      name,
      score: Math.min(98, lead.score + 5),
      notes: [...lead.notes, { label: "Nome completo", value: name }],
    };
    const next = { ...lead, ...patch } as BotLead;
    return {
      patch,
      replies: [`Obrigada, ${name.split(" ")[0]}! ${promptFor(next, config)}`],
      events: [{ event: "lead.updated", payload: { full_name: name } }],
    };
  }

  const options = optionsFor(lead, config);
  const index = resolveIndex(text, options);
  if (index < 0) {
    return {
      patch: {},
      replies: [`Não entendi 😅 Responda com o número de uma das opções:\n\n${numbered(options)}`],
      events: [],
    };
  }

  if (step === "menu") {
    const treatment = config.treatments[index]!;
    const patch: Partial<BotLead> = {
      stage: "triagem",
      treatment: treatment.label,
      tags: Array.from(new Set([...lead.tags, treatment.label])),
      score: 35,
      notes: [
        ...lead.notes,
        {
          label: "Interesse",
          value: treatment.ticket
            ? `${treatment.label} · ticket médio ${treatment.ticket}`
            : treatment.label,
        },
      ],
    };
    const next = { ...lead, ...patch } as BotLead;
    return {
      patch,
      replies: [
        `Perfeito! ${treatment.label} é um dos nossos queridinhos 💚\n\n${promptFor(next, config)}`,
      ],
      events: [
        {
          event: "lead.stage_changed",
          payload: { from: lead.stage, to: "triagem", treatment: treatment.label },
        },
      ],
    };
  }

  if (step === "pergunta") {
    const question = currentQuestion(lead, config)!;
    const option = question.options[index]!;
    const notes = [...lead.notes, { label: question.prompt, value: option.label }];
    const tags = option.tag
      ? Array.from(new Set([...lead.tags, option.tag]))
      : lead.tags;

    if (option.disqualify) {
      return {
        patch: { stage: "desqualificado", score: 15, tags, notes },
        replies: [
          "Sem problemas! Vou te enviar nossos conteúdos e novidades por aqui. Quando quiser agendar, é só me chamar 🌿",
        ],
        events: [
          {
            event: "lead.disqualified",
            payload: { reason: option.label, nurture_sequence: "conteudo_educativo_30d" },
          },
        ],
      };
    }

    const score = Math.min(98, lead.score + (option.points ?? 0));
    const remaining = config.questions.filter(
      (q) => !notes.some((n) => n.label === q.prompt),
    ).length;
    const stage: StageId = remaining === 0 ? "qualificado" : lead.stage;
    const patch: Partial<BotLead> = { stage, score, tags, notes };
    const next = { ...lead, ...patch } as BotLead;
    return {
      patch,
      replies: [`Anotado! ${promptFor(next, config)}`],
      events:
        remaining === 0
          ? [{ event: "lead.qualified", payload: { score, treatment: lead.treatment } }]
          : [],
    };
  }

  // periodo
  const period = config.settings.periods[index]!;
  const patch: Partial<BotLead> = {
    stage: "agendado",
    period,
    score: Math.min(99, lead.score + 10),
    tags: Array.from(new Set([...lead.tags, "Avaliação marcada"])),
    notes: [...lead.notes, { label: "Melhor período", value: period }],
    booking_url: booking_url || null,
  };
  const firstName = (lead.name === DEFAULT_LEAD_NAME ? "" : lead.name.split(" ")[0]) ?? "";
  const bookingLine = booking_url
    ? `\n\nPara escolher o horário exato, é só clicar aqui: ${booking_url}`
    : "\nNossa equipe confirma o horário exato em instantes.";
  return {
    patch,
    replies: [
      `Prontinho${firstName ? `, ${firstName}` : ""}! Sua avaliação foi reservada para o período da ${(
        period.split(" ")[0] ?? ""
      ).toLowerCase()} 💚${bookingLine}`,
    ],
    events: [
      {
        event: "appointment.created",
        payload: { procedure: lead.treatment, preferred_window: period, booking_url },
      },
    ],
  };
}

export type StageId =
  | "novo"
  | "triagem"
  | "qualificado"
  | "agendado"
  | "desqualificado";

export type Stage = {
  id: StageId;
  label: string;
  hint: string;
  accent: string; // tailwind class using semantic tokens
};

export const STAGES: Stage[] = [
  { id: "novo", label: "Novo Lead", hint: "Entrou pelo WhatsApp", accent: "bg-stage-new" },
  { id: "triagem", label: "Em Triagem", hint: "Respondendo o bot", accent: "bg-stage-triage" },
  {
    id: "qualificado",
    label: "Qualificado",
    hint: "Perfil compatível",
    accent: "bg-stage-qualified",
  },
  { id: "agendado", label: "Agendado", hint: "Avaliação marcada", accent: "bg-stage-booked" },
  {
    id: "desqualificado",
    label: "Desqualificado",
    hint: "Fora do perfil agora",
    accent: "bg-stage-lost",
  },
];

export type Treatment = {
  key: string;
  label: string;
  ticket: string;
};

export const TREATMENTS: Treatment[] = [
  { key: "harmonizacao", label: "Harmonização Facial", ticket: "R$ 2.400" },
  { key: "botox", label: "Toxina Botulínica", ticket: "R$ 1.200" },
  { key: "preenchimento", label: "Preenchimento Labial", ticket: "R$ 1.800" },
  { key: "limpeza", label: "Limpeza de Pele Profunda", ticket: "R$ 350" },
  { key: "laser", label: "Laser & Rejuvenescimento", ticket: "R$ 3.100" },
];

export type Lead = {
  id: string;
  name: string;
  phone: string;
  stage: StageId;
  treatment?: string;
  tags: string[];
  period?: string;
  score: number;
  source: string;
  createdAt: number;
  updatedAt: number;
  notes: { label: string; value: string }[];
};

export type WebhookEvent = {
  id: string;
  event: string;
  status: number;
  at: number;
  payload: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  from: "bot" | "user";
  text: string;
  at: number;
};

export const timeOf = (ts: number) =>
  new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const uid = () => Math.random().toString(36).slice(2, 10);

export const randomPhone = () => {
  const n = Math.floor(10000000 + Math.random() * 89999999).toString();
  return `+55 11 9${n.slice(0, 4)}-${n.slice(4)}`;
};

export const seedLeads: Lead[] = [
  {
    id: "seed-1",
    name: "Mariana Alves",
    phone: "+55 11 98812-4471",
    stage: "agendado",
    treatment: "Preenchimento Labial",
    tags: ["Preenchimento Labial", "Retorno", "Alta intenção"],
    period: "Tarde",
    score: 88,
    source: "Anúncio Instagram",
    createdAt: Date.now() - 1000 * 60 * 220,
    updatedAt: Date.now() - 1000 * 60 * 40,
    notes: [
      { label: "Já fez procedimento", value: "Sim" },
      { label: "Orçamento", value: "R$ 1.000 a R$ 3.000" },
    ],
  },
  {
    id: "seed-2",
    name: "Carolina Prado",
    phone: "+55 11 99674-2210",
    stage: "qualificado",
    treatment: "Harmonização Facial",
    tags: ["Harmonização Facial", "Primeira vez"],
    score: 72,
    source: "Google Ads",
    createdAt: Date.now() - 1000 * 60 * 150,
    updatedAt: Date.now() - 1000 * 60 * 26,
    notes: [
      { label: "Já fez procedimento", value: "Não" },
      { label: "Orçamento", value: "Acima de R$ 3.000" },
    ],
  },
  {
    id: "seed-3",
    name: "Juliana Ferraz",
    phone: "+55 11 99120-7788",
    stage: "triagem",
    treatment: "Toxina Botulínica",
    tags: ["Toxina Botulínica"],
    score: 45,
    source: "WhatsApp orgânico",
    createdAt: Date.now() - 1000 * 60 * 65,
    updatedAt: Date.now() - 1000 * 60 * 9,
    notes: [{ label: "Etapa do bot", value: "Perguntas de qualificação" }],
  },
  {
    id: "seed-4",
    name: "Renata Lopes",
    phone: "+55 11 98330-1156",
    stage: "desqualificado",
    treatment: "Limpeza de Pele Profunda",
    tags: ["Limpeza de Pele Profunda", "Sem orçamento"],
    score: 18,
    source: "Indicação",
    createdAt: Date.now() - 1000 * 60 * 320,
    updatedAt: Date.now() - 1000 * 60 * 118,
    notes: [{ label: "Motivo", value: "Apenas pesquisando preço" }],
  },
];

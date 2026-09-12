import { CalendarClock, Flame, Tag, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STAGES, timeOf, type Lead, type StageId } from "@/lib/funnel";

type Props = {
  leads: Lead[];
  activeId: string;
  onSelect: (lead: Lead) => void;
};

export function CrmBoard({ leads, activeId, onSelect }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {STAGES.map((stage) => {
        const items = leads.filter((l) => l.stage === stage.id);
        return (
          <section
            key={stage.id}
            className="flex min-h-40 flex-col rounded-2xl border border-border bg-secondary/50 p-3"
          >
            <header className="mb-3 flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", stage.accent)} aria-hidden />
              <h3 className="text-sm font-semibold">{stage.label}</h3>
              <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {items.length}
              </span>
            </header>
            <p className="mb-3 text-[11px] text-muted-foreground">{stage.hint}</p>
            <div className="flex flex-1 flex-col gap-2">
              {items.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  stageId={stage.id}
                  active={lead.id === activeId}
                  onSelect={onSelect}
                />
              ))}
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-4 text-center text-[11px] text-muted-foreground">
                  Vazio
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LeadCard({
  lead,
  stageId,
  active,
  onSelect,
}: {
  lead: Lead;
  stageId: StageId;
  active: boolean;
  onSelect: (lead: Lead) => void;
}) {
  const stage = STAGES.find((s) => s.id === stageId)!;
  return (
    <button
      type="button"
      onClick={() => onSelect(lead)}
      className={cn(
        "group w-full rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
        active && "border-primary ring-2 ring-ring/30",
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-8 w-1 rounded-full", stage.accent)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            <User className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {lead.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{lead.phone}</p>
        </div>
        <span
          className={cn(
            "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            lead.score >= 70
              ? "bg-stage-booked/20 text-foreground"
              : lead.score >= 40
                ? "bg-stage-triage/25 text-foreground"
                : "bg-stage-lost/20 text-foreground",
          )}
        >
          <Flame className="size-3" aria-hidden />
          {lead.score}
        </span>
      </div>

      {lead.treatment ? (
        <Badge variant="secondary" className="mt-2 gap-1 text-[10px] font-medium">
          <Tag className="size-3" aria-hidden />
          {lead.treatment}
        </Badge>
      ) : null}

      <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <CalendarClock className="size-3" aria-hidden />
        {lead.period ? `${lead.period} · ` : ""}atualizado {timeOf(lead.updatedAt)}
      </p>
    </button>
  );
}

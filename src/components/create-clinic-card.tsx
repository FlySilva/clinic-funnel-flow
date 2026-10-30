import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/clinic";

/** Shown to a signed-in user who doesn't belong to any clinic yet. */
export function CreateClinicCard() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = slugify(name);
    if (name.trim().length < 3 || slug.length < 3) {
      setStatus("Informe um nome com pelo menos 3 letras.");
      return;
    }
    setLoading(true);
    setStatus("");
    const { error } = await supabase.rpc("create_clinic", { _name: name.trim(), _slug: slug });
    setLoading(false);
    if (error) {
      setStatus(
        error.message.includes("duplicate")
          ? "Já existe uma clínica com esse nome. Tente outro."
          : `Não foi possível criar: ${error.message}`,
      );
      return;
    }
    await qc.invalidateQueries();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={create}
        className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Building2 className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Crie sua clínica</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua conta ainda não faz parte de nenhuma clínica. Crie a sua ou peça um convite ao
            responsável.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clinic-name">Nome da clínica</Label>
          <Input id="clinic-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando…" : "Criar minha clínica"}
        </Button>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </form>
    </main>
  );
}

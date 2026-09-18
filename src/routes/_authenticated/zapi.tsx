import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PlugZap, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { testZapiConnection } from "@/lib/zapi.functions";

export const Route = createFileRoute("/_authenticated/zapi")({
  head: () => ({
    meta: [
      { title: "Conexão com o WhatsApp (Z-API) | Vitreo Flow" },
      {
        name: "description",
        content:
          "Cadastre o ID da instância, token e client-token da Z-API para a Lia enviar mensagens pelo WhatsApp real da clínica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ZapiPage,
});

type Row = Record<string, any>;

function ZapiPage() {
  const qc = useQueryClient();
  const runTest = useServerFn(testZapiConnection);

  const { data } = useQuery({
    queryKey: ["zapi_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zapi_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Row | null;
    },
  });

  const [form, setForm] = useState<Row>({
    instance_id: "",
    token: "",
    client_token: "",
    webhook_secret: "",
    enabled: false,
  });
  const [status, setStatus] = useState("");
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = async () => {
    setStatus("Salvando…");
    const payload = {
      id: true,
      instance_id: String(form['instance_id'] ?? "").trim(),
      token: String(form['token'] ?? "").trim(),
      client_token: String(form['client_token'] ?? "").trim(),
      webhook_secret: String(form['webhook_secret'] ?? "").trim(),
      enabled: Boolean(form['enabled']),
    };
    const { error } = await supabase.from("zapi_settings").upsert(payload).eq("id", true);
    setStatus(error ? `Erro ao salvar: ${error.message}` : "Credenciais salvas.");
    qc.invalidateQueries({ queryKey: ["zapi_settings"] });
  };

  const test = async () => {
    if (!testPhone.trim()) {
      setStatus("Informe um número para o teste.");
      return;
    }
    setStatus("Enviando mensagem de teste…");
    const res = await runTest({
      data: { phone: testPhone.trim(), message: "Teste de conexão da Lia ✨" },
    });
    setStatus(res.ok ? "Mensagem de teste enviada com sucesso." : `Falhou (${res.status}): ${res.body}`);
  };

  const webhookUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/api/public/zapi/webhook`;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <PlugZap className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Conexão com o WhatsApp</h1>
            <p className="text-xs text-muted-foreground">Credenciais da Z-API</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Administração</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/">Ver funil</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-5 py-6">
        <section className="grid gap-4 rounded-3xl border border-border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>ID da instância</Label>
            <Input
              value={form['instance_id'] ?? ""}
              onChange={(e) => setForm({ ...form, instance_id: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Token da instância</Label>
            <Input
              value={form['token'] ?? ""}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Client-Token</Label>
            <Input
              value={form['client_token'] ?? ""}
              onChange={(e) => setForm({ ...form, client_token: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Segredo do webhook</Label>
            <Input
              value={form['webhook_secret'] ?? ""}
              onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch
              id="zapi-enabled"
              checked={Boolean(form['enabled'])}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
            <Label htmlFor="zapi-enabled">Enviar mensagens reais pelo WhatsApp</Label>
          </div>
          <div className="sm:col-span-2">
            <Button className="gap-1" onClick={save}>
              <Save className="size-4" aria-hidden /> Salvar credenciais
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Testar envio</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label>Número de destino</Label>
              <Input
                value={testPhone}
                placeholder="5511999999999"
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-1" onClick={test}>
              <Send className="size-4" aria-hidden /> Enviar teste
            </Button>
          </div>
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        </section>

        <section className="space-y-2 rounded-3xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Endereço para receber mensagens</h2>
          <p className="text-xs text-muted-foreground">
            Configure este endereço na Z-API como webhook “ao receber mensagem”, incluindo o
            segredo acima.
          </p>
          <code className="block overflow-x-auto rounded-xl bg-secondary p-3 text-xs">
            {webhookUrl}?secret=SEU_SEGREDO
          </code>
        </section>
      </div>
    </main>
  );
}

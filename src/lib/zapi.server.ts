/** Z-API (WhatsApp) helpers. Server-only. */

export type ZapiCredentials = {
  instanceId: string;
  token: string;
  clientToken: string;
};

export type ZapiSettings = {
  credentials: ZapiCredentials | null;
  enabled: boolean;
  webhookSecret: string;
};

/** Prefers the credentials saved in the admin screen, falling back to env vars. */
export async function loadZapiSettings(admin: any, clinicId: string): Promise<ZapiSettings> {
  const { data } = await admin.from("zapi_settings").select("*").eq("clinic_id", clinicId).maybeSingle();
  return zapiFromRow((data ?? {}) as Record<string, any>);
}

/** Finds which clinic owns a webhook secret (each clinic has its own). */
export async function findClinicBySecret(admin: any, secret: string): Promise<string | null> {
  if (!secret) return null;
  const { data } = await admin
    .from("zapi_settings")
    .select("clinic_id")
    .eq("webhook_secret", secret)
    .neq("webhook_secret", "")
    .maybeSingle();
  return (data?.clinic_id as string) ?? null;
}

function zapiFromRow(row: Record<string, any>): ZapiSettings {

  const fromDb =
    row['instance_id'] && row['token'] && row['client_token']
      ? {
          instanceId: String(row['instance_id']),
          token: String(row['token']),
          clientToken: String(row['client_token']),
        }
      : null;

  return {
    credentials: fromDb,
    enabled: Boolean(row['enabled']),
    webhookSecret: String(row['webhook_secret'] ?? ""),
  };
}

export async function sendWhatsAppText(
  creds: ZapiCredentials,
  phone: string,
  message: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": creds.clientToken,
      },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
  } catch (err) {
    return { ok: false, status: 500, body: String(err).slice(0, 500) };
  }
}

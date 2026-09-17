/** Z-API (WhatsApp) helpers. Server-only. */

export type ZapiCredentials = {
  instanceId: string;
  token: string;
  clientToken: string;
};

/** Reads credentials from env vars (fallback when nothing is saved in the database). */
export function readZapiCredentialsFromEnv(): ZapiCredentials | null {
  const instanceId = process.env['ZAPI_INSTANCE_ID'];
  const token = process.env['ZAPI_TOKEN'];
  const clientToken = process.env['ZAPI_CLIENT_TOKEN'];
  if (!instanceId || !token || !clientToken) return null;
  return { instanceId, token, clientToken };
}

export type ZapiSettings = {
  credentials: ZapiCredentials | null;
  enabled: boolean;
  webhookSecret: string;
};

/** Prefers the credentials saved in the admin screen, falling back to env vars. */
export async function loadZapiSettings(admin: any): Promise<ZapiSettings> {
  const { data } = await admin.from("zapi_settings").select("*").limit(1).maybeSingle();
  const row = (data ?? {}) as Record<string, any>;

  const fromDb =
    row['instance_id'] && row['token'] && row['client_token']
      ? {
          instanceId: String(row['instance_id']),
          token: String(row['token']),
          clientToken: String(row['client_token']),
        }
      : null;

  return {
    credentials: fromDb ?? readZapiCredentialsFromEnv(),
    enabled: row['enabled'] === undefined ? true : Boolean(row['enabled']),
    webhookSecret: String(row['webhook_secret'] ?? process.env['ZAPI_WEBHOOK_SECRET'] ?? ""),
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

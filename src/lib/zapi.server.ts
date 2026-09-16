/** Z-API (WhatsApp) helpers. Server-only. */

export type ZapiCredentials = {
  instanceId: string;
  token: string;
  clientToken: string;
};

export function readZapiCredentials(): ZapiCredentials | null {
  const instanceId = process.env['ZAPI_INSTANCE_ID'];
  const token = process.env['ZAPI_TOKEN'];
  const clientToken = process.env['ZAPI_CLIENT_TOKEN'];
  if (!instanceId || !token || !clientToken) return null;
  return { instanceId, token, clientToken };
}

export async function sendWhatsAppText(
  creds: ZapiCredentials,
  phone: string,
  message: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`;
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
}

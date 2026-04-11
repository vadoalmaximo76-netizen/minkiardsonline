import { Resend } from 'resend';

async function getConnectorCredentials(): Promise<{ apiKey: string; fromEmail: string | null } | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY
      ? 'repl ' + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

    if (!xReplitToken || !hostname) return null;

    const res = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: { Accept: 'application/json', 'X-Replit-Token': xReplitToken },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const item = data.items?.[0];
    if (!item?.settings?.api_key) return null;

    return {
      apiKey: item.settings.api_key,
      fromEmail: item.settings.from_email || null,
    };
  } catch {
    return null;
  }
}

export async function getUncachableResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  // Priority 1: Direct environment variables (most reliable)
  const envApiKey = process.env.RESEND_API_KEY;
  const envFromEmail = process.env.RESEND_FROM_EMAIL;

  // Priority 2: Replit connector
  const connector = await getConnectorCredentials();

  const apiKey = envApiKey || connector?.apiKey;
  if (!apiKey) {
    throw new Error('Resend API key not configured. Set RESEND_API_KEY env var or configure the Resend integration.');
  }

  // Determine the from address — prefer env var, then connector
  const rawFromEmail = envFromEmail || connector?.fromEmail || null;

  // If no from address is configured at all, throw an explicit error
  if (!rawFromEmail) {
    throw new Error(
      'RESEND_FROM_EMAIL non configurato. ' +
      'Imposta la variabile d\'ambiente RESEND_FROM_EMAIL con un indirizzo mittente. ' +
      'Senza questa configurazione le email non possono essere inviate.'
    );
  }

  // Ensure the from address has a display name
  const fromEmail = rawFromEmail.includes('<') ? rawFromEmail : `MINKIARDS <${rawFromEmail}>`;

  console.log(`[Resend] Using API key: ${apiKey.slice(0, 8)}... | from: ${fromEmail}`);

  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

export async function logResendConfigStatus(): Promise<void> {
  const hasEnvApiKey = !!(process.env.RESEND_API_KEY);
  const hasEnvFromEmail = !!(process.env.RESEND_FROM_EMAIL);

  // Also probe the connector so we can report the real effective state
  const connector = await getConnectorCredentials().catch(() => null);
  const hasConnectorApiKey = !!(connector?.apiKey);
  const hasConnectorFromEmail = !!(connector?.fromEmail);

  const effectiveApiKey = hasEnvApiKey || hasConnectorApiKey;
  const effectiveFromEmail = hasEnvFromEmail || hasConnectorFromEmail;

  console.log('[Resend] Configuration status (env var / connector):');
  console.log(`  API key:    ${hasEnvApiKey ? '✅ env' : hasConnectorApiKey ? '✅ connector' : '❌ NOT SET'}`);
  console.log(`  From email: ${hasEnvFromEmail ? `✅ env (${process.env.RESEND_FROM_EMAIL})` : hasConnectorFromEmail ? `✅ connector (${connector!.fromEmail})` : '❌ NOT SET'}`);
  if (!effectiveApiKey || !effectiveFromEmail) {
    console.warn('[Resend] WARNING: Email sending (password recovery etc.) will fail until both RESEND_API_KEY and RESEND_FROM_EMAIL are properly configured (env var or Resend connector).');
  }
}

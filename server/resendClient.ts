import { Resend } from 'resend';

// Free email provider domains that cannot be verified/used as senders in Resend
const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.it', 'hotmail.fr',
  'outlook.com', 'outlook.it', 'live.com', 'live.it', 'yahoo.com',
  'yahoo.it', 'yahoo.fr', 'icloud.com', 'me.com', 'mac.com',
  'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it',
];

function isUnverifiableDomain(email: string): boolean {
  if (!email) return true;
  const domain = email.split('@').pop()?.toLowerCase() || '';
  return FREE_EMAIL_DOMAINS.includes(domain);
}

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
        headers: { Accept: 'application/json', X_REPLIT_TOKEN: xReplitToken },
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

  // Determine the from address — prefer env var, then connector, then safe default
  let rawFromEmail = envFromEmail || connector?.fromEmail || null;

  // If the from address is a free provider (e.g. gmail.com), it cannot be a verified
  // sender in Resend. Fall back to Resend's built-in test sender.
  if (!rawFromEmail || isUnverifiableDomain(rawFromEmail)) {
    if (rawFromEmail) {
      console.warn(
        `[Resend] from_email "${rawFromEmail}" uses an unverifiable domain. ` +
        'Falling back to onboarding@resend.dev (test mode — only delivers to the Resend account owner). ' +
        'To send to any email, set RESEND_FROM_EMAIL to an address on a domain you own and have verified in Resend.'
      );
    }
    rawFromEmail = 'MINKIARDS <onboarding@resend.dev>';
  }

  // Ensure the from address has a display name
  const fromEmail = rawFromEmail.includes('<') ? rawFromEmail : `MINKIARDS <${rawFromEmail}>`;

  console.log(`[Resend] Using API key: ${apiKey.slice(0, 8)}... | from: ${fromEmail}`);

  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

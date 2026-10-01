import type { MailConfig } from '../config/env';
import type { EmailMessage, EmailReceipt, Mailer } from './types';

/**
 * Mailgun transport.
 *
 * Calls the Mailgun Messages API directly with Node's built-in `fetch` and
 * `FormData` instead of pulling in an SDK. That keeps the dependency surface
 * (and the ESM/CJS interop risk) at zero while using exactly the same
 * documented endpoint the SDK uses:
 *
 *   POST {MAILGUN_API_BASE}/v3/{domain}/messages   (HTTP Basic: api:{key})
 *
 * The API key is only ever read from server-side config.
 */
export class MailgunMailer implements Mailer {
  readonly transport = 'mailgun' as const;

  private readonly apiKey: string;
  private readonly domain: string;
  private readonly apiBase: string;
  private readonly fromName: string;
  private readonly fromAddress: string;

  constructor(config: MailConfig) {
    if (!config.apiKey || !config.domain) {
      throw new Error('MailgunMailer requires MAILGUN_API_KEY and MAILGUN_DOMAIN.');
    }
    this.apiKey = config.apiKey;
    this.domain = config.domain;
    this.apiBase = config.apiBase;
    this.fromName = config.fromName;
    this.fromAddress = config.fromAddress;
  }

  async send(message: EmailMessage): Promise<EmailReceipt> {
    const body = new FormData();
    body.append('from', `${this.fromName} <${this.fromAddress}>`);
    body.append(
      'to',
      message.to.name ? `${message.to.name} <${message.to.address}>` : message.to.address,
    );
    body.append('subject', message.subject);
    body.append('text', message.text);
    body.append('html', message.html);
    if (message.replyTo) {
      body.append('h:Reply-To', message.replyTo.address);
    }

    const credentials = Buffer.from(`api:${this.apiKey}`).toString('base64');
    const response = await fetch(`${this.apiBase}/v3/${this.domain}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      body,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(
        `Mailgun rejected the message (${response.status}): ${payload.message ?? 'unknown error'}`,
      );
    }

    return { id: payload.id ?? null };
  }
}

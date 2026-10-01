import type { EmailMessage, EmailReceipt, Mailer } from './types';

/**
 * Development/CI transport: renders the email to stdout instead of sending it.
 *
 * This is the default, which is what lets a fresh clone (and the whole test
 * suite) run checkout end-to-end with no Mailgun account at all.
 */
export class ConsoleMailer implements Mailer {
  readonly transport = 'console' as const;

  constructor(private readonly silent = false) {}

  async send(message: EmailMessage): Promise<EmailReceipt> {
    if (!this.silent) {
      const recipient = message.to.name
        ? `${message.to.name} <${message.to.address}>`
        : message.to.address;

      console.log(
        [
          '',
          '──────────────────────────────────────────────────────────────',
          `  EMAIL (console transport — not actually sent)`,
          `  To:      ${recipient}`,
          `  Subject: ${message.subject}`,
          '──────────────────────────────────────────────────────────────',
          message.text,
          '──────────────────────────────────────────────────────────────',
          '',
        ].join('\n'),
      );
    }
    return { id: null };
  }
}

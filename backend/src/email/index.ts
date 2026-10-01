import type { AppConfig } from '../config/env';
import { ConsoleMailer } from './console-mailer';
import { MailgunMailer } from './mailgun-mailer';
import type { Mailer } from './types';

/**
 * Chooses the email transport from configuration.
 *
 * `console` is the default so that development, demos and CI all work with no
 * Mailgun account. Switch with `MAIL_TRANSPORT=mailgun` in production.
 */
export function createMailer(config: AppConfig): Mailer {
  if (config.mail.transport === 'mailgun') {
    return new MailgunMailer(config.mail);
  }
  return new ConsoleMailer(config.logLevel === 'silent');
}

export * from './types';
export * from './templates';

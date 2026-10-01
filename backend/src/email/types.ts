/**
 * The outbound email contract.
 *
 * Order confirmation is the only transactional email the shop sends, but the
 * interface is deliberately generic so a newsletter or shipping notification
 * needs no new plumbing.
 */
export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailMessage {
  to: EmailAddress;
  subject: string;
  html: string;
  /** Always supplied: some clients and all accessibility tools use it. */
  text: string;
  replyTo?: EmailAddress;
}

export interface EmailReceipt {
  /** Provider message id, when the transport returns one. */
  id: string | null;
}

export interface Mailer {
  readonly transport: 'console' | 'mailgun';
  send(message: EmailMessage): Promise<EmailReceipt>;
}

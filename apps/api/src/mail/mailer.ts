export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Outbound email. Feature code depends on this interface only; the transport is
 * chosen in MailModule (SMTP to Mailpit locally, SES SMTP in production, memory in tests).
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const MAILER = Symbol('MAILER');

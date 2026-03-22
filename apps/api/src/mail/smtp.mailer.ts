import { createTransport, type Transporter } from 'nodemailer';
import type { MailMessage, Mailer } from './mailer.js';

/** SMTP transport: Mailpit in local dev, Amazon SES SMTP in production. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    opts: { host: string; port: number; user?: string; pass?: string },
    private readonly from: string,
  ) {
    this.transport = createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.port === 465,
      auth: opts.user ? { user: opts.user, pass: opts.pass } : undefined,
    });
  }

  async send(message: MailMessage) {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

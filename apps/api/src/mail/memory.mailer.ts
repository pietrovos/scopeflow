import type { MailMessage, Mailer } from './mailer.js';

/** Captures messages for assertions in tests. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage) {
    this.sent.push(message);
  }

  to(address: string) {
    return this.sent.filter((m) => m.to === address);
  }

  clear() {
    this.sent.length = 0;
  }
}

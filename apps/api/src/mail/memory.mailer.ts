import type { MailMessage, Mailer } from './mailer.js';

/** Captures messages for assertions in tests. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  /** Simulate an SMTP outage. */
  failing = false;

  async send(message: MailMessage) {
    if (this.failing) throw new Error('SMTP unavailable');
    this.sent.push(message);
  }

  to(address: string) {
    return this.sent.filter((m) => m.to === address);
  }

  clear() {
    this.sent.length = 0;
  }
}

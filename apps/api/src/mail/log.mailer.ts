import { Logger } from '@nestjs/common';
import type { MailMessage, Mailer } from './mailer.js';

export class LogMailer implements Mailer {
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage) {
    this.logger.log(`to=${message.to} subject="${message.subject}"`);
  }
}

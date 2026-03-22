import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { MAILER } from './mailer.js';
import { LogMailer } from './log.mailer.js';
import { SmtpMailer } from './smtp.mailer.js';

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.MAIL_TRANSPORT === 'log'
          ? new LogMailer()
          : new SmtpMailer(
              { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS },
              env.MAIL_FROM,
            ),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}

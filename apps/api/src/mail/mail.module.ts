import { Global, Module } from '@nestjs/common';
import { MAILER } from './mailer.js';
import { LogMailer } from './log.mailer.js';

@Global()
@Module({
  providers: [{ provide: MAILER, useClass: LogMailer }],
  exports: [MAILER],
})
export class MailModule {}

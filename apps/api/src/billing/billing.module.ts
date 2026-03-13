import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { createStripe, STRIPE } from './stripe.provider.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, { provide: STRIPE, inject: [ENV], useFactory: (env: Env) => createStripe(env) }],
})
export class BillingModule {}

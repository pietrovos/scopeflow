import { Body, Controller, Get, Headers, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import type { AuthUser } from '../auth/users.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ManagersOnly, Roles } from '../tenancy/roles.decorator.js';
import { Tenant } from '../tenancy/tenant.decorator.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { BillingService } from './billing.service.js';

const checkoutSchema = z.object({ plan: z.enum(['PRO', 'AGENCY']) });

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @ManagersOnly()
  @Get('orgs/:orgId/billing')
  summary(@Tenant() t: TenantContext) {
    return this.billing.summary(t);
  }

  @Roles('OWNER')
  @Post('orgs/:orgId/billing/checkout')
  checkout(
    @Tenant() t: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>,
  ) {
    return this.billing.checkout(t, body.plan, user.email);
  }

  @Roles('OWNER')
  @Post('orgs/:orgId/billing/portal')
  portal(@Tenant() t: TenantContext) {
    return this.billing.portal(t);
  }

  /** Stripe calls this. Authenticated by signature, not by a user token. */
  @Public()
  @Post('billing/webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    const event = this.billing.verify(req.rawBody, signature);
    return this.billing.handle(event);
  }
}

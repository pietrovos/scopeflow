import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type Stripe from 'stripe';
import { PLAN_INFO, type Plan } from '@scopeflow/shared';
import { ENV, type Env } from '../config/env.js';
import { SystemPrismaService } from '../db/prisma.service.js';
import { TenantDb } from '../db/tenant-db.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { STRIPE, type StripeHandle } from './stripe.provider.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(STRIPE) private readonly stripe: StripeHandle,
    @Inject(ENV) private readonly env: Env,
    private readonly db: TenantDb,
    private readonly system: SystemPrismaService,
    private readonly activity: ActivityService,
  ) {}

  private priceFor(plan: Plan): string | undefined {
    if (plan === 'PRO') return this.env.STRIPE_PRICE_PRO;
    if (plan === 'AGENCY') return this.env.STRIPE_PRICE_AGENCY;
    return undefined;
  }

  private planForPrice(priceId: string | undefined): Plan | null {
    if (priceId && priceId === this.env.STRIPE_PRICE_PRO) return 'PRO';
    if (priceId && priceId === this.env.STRIPE_PRICE_AGENCY) return 'AGENCY';
    return null;
  }

  summary(t: TenantContext) {
    return this.db.run(t, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: t.orgId },
        select: { plan: true, subscriptionStatus: true, currentPeriodEnd: true, stripeCustomerId: true },
      });
      const [activeProjects, seats] = await Promise.all([
        tx.project.count({ where: { orgId: t.orgId, status: 'ACTIVE' } }),
        tx.membership.count({ where: { orgId: t.orgId, role: { not: 'CLIENT' } } }),
      ]);
      return {
        plan: org.plan,
        subscriptionStatus: org.subscriptionStatus,
        currentPeriodEnd: org.currentPeriodEnd,
        hasBillingAccount: Boolean(org.stripeCustomerId),
        usage: { activeProjects, seats },
        limits: PLAN_INFO[org.plan],
        checkoutAvailable: Boolean(this.stripe.api && this.env.STRIPE_PRICE_PRO && this.env.STRIPE_PRICE_AGENCY),
      };
    });
  }

  /** Starts Stripe Checkout for a paid plan. The org is linked via client_reference_id. */
  async checkout(t: TenantContext, plan: Plan, email: string) {
    const api = this.requireApi();
    const price = this.priceFor(plan);
    if (!price) throw new BadRequestException('Unknown plan');

    const customer = await this.db.run(t, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: t.orgId } });
      if (org.stripeCustomerId) return org.stripeCustomerId;
      const created = await api.customers.create(
        { name: org.name, email, metadata: { orgId: org.id } },
        { idempotencyKey: `customer-${org.id}` },
      );
      await tx.organization.update({ where: { id: org.id }, data: { stripeCustomerId: created.id } });
      return created.id;
    });

    const session = await api.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: t.orgId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { orgId: t.orgId } },
      success_url: `${this.env.WEB_URL}/orgs/${t.orgId}/settings/billing?checkout=success`,
      cancel_url: `${this.env.WEB_URL}/orgs/${t.orgId}/settings/billing?checkout=cancelled`,
    });
    return { url: session.url };
  }

  async portal(t: TenantContext) {
    const api = this.requireApi();
    const org = await this.db.run(t, (tx) => tx.organization.findUniqueOrThrow({ where: { id: t.orgId } }));
    if (!org.stripeCustomerId) throw new BadRequestException('No billing account yet');
    const session = await api.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${this.env.WEB_URL}/orgs/${t.orgId}/settings/billing`,
    });
    return { url: session.url };
  }

  /** Throws 400 if the signature doesn't match the raw body. */
  verify(rawBody: Buffer | undefined, signature: string | undefined): Stripe.Event {
    if (!this.env.STRIPE_WEBHOOK_SECRET) throw new ServiceUnavailableException('Webhooks are not configured');
    if (!rawBody || !signature) throw new BadRequestException('Missing signature');
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, this.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new BadRequestException('Invalid signature');
    }
  }

  /**
   * Applies a webhook event exactly once. The event ID is inserted into
   * processed_stripe_events in the same transaction as the side effects:
   * - a redelivery hits the primary key and is acknowledged without doing anything;
   * - a failure rolls back both, so Stripe's retry processes it from scratch;
   * - two concurrent deliveries serialize on the insert, and the second sees a duplicate.
   */
  async handle(event: Stripe.Event): Promise<{ status: 'processed' | 'duplicate' | 'ignored' }> {
    const events: Array<Parameters<ActivityService['publishCommitted']>[0][number]> = [];
    try {
      const status = await this.system.$transaction(async (tx) => {
        await tx.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
        const applied = await this.apply(tx, event, events);
        return applied ? ('processed' as const) : ('ignored' as const);
      });
      this.activity.publishCommitted(events);
      return { status };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`duplicate delivery of ${event.id} ignored`);
        return { status: 'duplicate' };
      }
      throw err;
    }
  }

  private async apply(tx: Tx, event: Stripe.Event, published: unknown[]): Promise<boolean> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = session.client_reference_id;
        if (!orgId || typeof session.customer !== 'string') return false;
        await tx.organization.update({
          where: { id: orgId },
          data: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
          },
        });
        return true;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return this.syncSubscription(tx, event, event.data.object, published);
      default:
        return false;
    }
  }

  private async syncSubscription(tx: Tx, event: Stripe.Event, sub: Stripe.Subscription, published: unknown[]) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const org = await tx.organization.findFirst({
      where: {
        OR: [{ stripeCustomerId: customerId }, { id: sub.metadata?.orgId ?? '00000000-0000-0000-0000-000000000000' }],
      },
    });
    if (!org) {
      this.logger.warn(`subscription ${sub.id} for unknown customer ${customerId}`);
      return false;
    }
    // Stripe does not guarantee delivery order. Ignore anything older than what we applied.
    const eventAt = new Date(event.created * 1000);
    if (org.billingSyncedAt && eventAt < org.billingSyncedAt) return false;

    const item = sub.items.data[0];
    const ended = event.type === 'customer.subscription.deleted' || sub.status === 'canceled';
    const plan: Plan = ended ? 'FREE' : (this.planForPrice(item?.price.id) ?? org.plan);
    await tx.organization.update({
      where: { id: org.id },
      data: {
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: ended ? null : sub.id,
        subscriptionStatus: sub.status,
        currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
        billingSyncedAt: eventAt,
      },
    });
    if (plan !== org.plan) {
      published.push(
        await tx.activityEvent.create({
          data: {
            orgId: org.id,
            type: 'billing.plan_changed',
            entityType: 'organization',
            entityId: org.id,
            data: { plan: PLAN_INFO[plan].name, from: PLAN_INFO[org.plan].name, stripeEventId: event.id },
          },
          include: ActivityService.include,
        }),
      );
    }
    return true;
  }

  private requireApi(): Stripe {
    if (!this.stripe.api) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'billing_unavailable',
        message: 'Billing is not configured on this server (STRIPE_SECRET_KEY is not set).',
      });
    }
    return this.stripe.api;
  }
}

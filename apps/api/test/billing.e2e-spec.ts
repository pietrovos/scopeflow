import request from 'supertest';
import Stripe from 'stripe';
import { createTestApp, type TestApp } from './support/app.js';
import { ownerDb, resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

const stripe = new Stripe('sk_test_unused');
const secret = process.env.STRIPE_WEBHOOK_SECRET!;

let counter = 0;
function event(type: string, object: Record<string, unknown>, opts: { id?: string; created?: number } = {}) {
  return {
    id: opts.id ?? `evt_test_${++counter}_${Date.now()}`,
    object: 'event',
    type,
    created: opts.created ?? Math.floor(Date.now() / 1000),
    api_version: '2026-09-30.endive',
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object },
  };
}

function subscription(customer: string, price: string, status = 'active') {
  return {
    id: 'sub_test_123',
    object: 'subscription',
    customer,
    status,
    metadata: {},
    items: { object: 'list', data: [{ id: 'si_1', price: { id: price }, current_period_end: 1_800_000_000 }] },
  };
}

describe('Stripe billing', () => {
  let t: TestApp;
  let w: World;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    w = await buildOrg(t, 'India');
    await ownerDb.organization.update({
      where: { id: w.org.id },
      data: { plan: 'FREE', stripeCustomerId: 'cus_india' },
    });
  });
  afterAll(() => t.close());

  const deliver = (payload: object, signature?: string) => {
    const body = JSON.stringify(payload);
    return request(t.server)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature ?? stripe.webhooks.generateTestHeaderString({ payload: body, secret }))
      .send(body);
  };
  const org = () => ownerDb.organization.findUniqueOrThrow({ where: { id: w.org.id } });

  it('rejects an unsigned or tampered webhook', async () => {
    const e = event('customer.subscription.updated', subscription('cus_india', 'price_agency_test'));
    await deliver(e, 't=1,v1=deadbeef').expect(400);
    const signed = stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(e), secret });
    await deliver({ ...e, data: { object: subscription('cus_india', 'price_pro_test') } }, signed).expect(400);
    expect((await org()).plan).toBe('FREE');
    expect(await ownerDb.processedStripeEvent.count()).toBe(0);
  });

  it('upgrades the org from a subscription event', async () => {
    await deliver(event('customer.subscription.updated', subscription('cus_india', 'price_pro_test'))).expect(200, {
      status: 'processed',
    });
    expect(await org()).toMatchObject({
      plan: 'PRO',
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_test_123',
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
    });
  });

  it('is idempotent: replaying the same event applies it once', async () => {
    const e = event('customer.subscription.updated', subscription('cus_india', 'price_agency_test'));
    await deliver(e).expect(200, { status: 'processed' });
    await deliver(e).expect(200, { status: 'duplicate' });

    expect((await org()).plan).toBe('AGENCY');
    expect(await ownerDb.processedStripeEvent.count({ where: { id: e.id } })).toBe(1);
    expect(await ownerDb.activityEvent.count({ where: { orgId: w.org.id, type: 'billing.plan_changed' } })).toBe(1);
  });

  it('processes concurrent duplicate deliveries exactly once', async () => {
    const e = event('customer.subscription.updated', subscription('cus_india', 'price_pro_test'));
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => deliver(e)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(results.filter((r) => r.body.status === 'processed')).toHaveLength(1);
    expect(await ownerDb.activityEvent.count({ where: { orgId: w.org.id, type: 'billing.plan_changed' } })).toBe(1);
  });

  it('ignores an older event that arrives after a newer one', async () => {
    const now = Math.floor(Date.now() / 1000);
    await deliver(
      event('customer.subscription.deleted', subscription('cus_india', 'price_pro_test', 'canceled'), { created: now }),
    ).expect(200, { status: 'processed' });
    await deliver(
      event('customer.subscription.updated', subscription('cus_india', 'price_pro_test'), { created: now - 60 }),
    ).expect(200, { status: 'ignored' });
    expect((await org()).plan).toBe('FREE');
  });

  it('does not record a failed event, so the retry can succeed', async () => {
    const pendingOrg = '6f1f6c2e-0c1a-4b7e-9a51-2f1a3c4d5e6f';
    const e = event('checkout.session.completed', {
      object: 'checkout.session',
      client_reference_id: pendingOrg,
      customer: 'cus_late',
      subscription: 'sub_late',
    });
    // Any non-2xx makes Stripe retry later.
    expect((await deliver(e)).status).toBeGreaterThanOrEqual(400);
    expect(await ownerDb.processedStripeEvent.count({ where: { id: e.id } })).toBe(0);

    await ownerDb.organization.create({ data: { id: pendingOrg, name: 'Late', slug: 'late' } });
    await deliver(e).expect(200, { status: 'processed' });
    expect(await ownerDb.organization.findUniqueOrThrow({ where: { id: pendingOrg } })).toMatchObject({
      stripeCustomerId: 'cus_late',
      stripeSubscriptionId: 'sub_late',
    });
  });

  it('shows billing to managers only and reports when checkout is unavailable', async () => {
    const summary = await (await t.as(w.admin)).get(`/orgs/${w.org.id}/billing`).expect(200);
    expect(summary.body).toMatchObject({
      plan: 'FREE',
      checkoutAvailable: false,
      usage: { activeProjects: 2, seats: 3 },
    });
    await (await t.as(w.member)).get(`/orgs/${w.org.id}/billing`).expect(403);
    await (await t.as(w.admin)).post(`/orgs/${w.org.id}/billing/checkout`).send({ plan: 'PRO' }).expect(403);
    const res = await (
      await t.as(w.owner)
    )
      .post(`/orgs/${w.org.id}/billing/checkout`)
      .send({ plan: 'PRO' })
      .expect(503);
    expect(res.body.error).toBe('billing_unavailable');
  });
});

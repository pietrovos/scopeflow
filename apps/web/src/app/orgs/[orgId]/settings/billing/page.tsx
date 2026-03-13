import { forbidden } from 'next/navigation';
import { isManager, PLAN_INFO, PLANS, type Plan, type PlanInfo } from '@scopeflow/shared';
import { serverApi } from '@/lib/server-api';
import type { OrgSummary } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ManageBillingButton, UpgradeButton } from '@/components/billing/billing-actions';

export const metadata = { title: 'Billing' };

interface BillingSummary {
  plan: Plan;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasBillingAccount: boolean;
  usage: { activeProjects: number; seats: number };
  limits: PlanInfo;
  checkoutAvailable: boolean;
}

const RANK: Record<Plan, number> = { FREE: 0, PRO: 1, AGENCY: 2 };

export default async function BillingPage({ params, searchParams }: PageProps<'/orgs/[orgId]/settings/billing'>) {
  const { orgId } = await params;
  const { checkout } = await searchParams;
  const org = await serverApi<OrgSummary>(`/orgs/${orgId}`);
  if (!isManager(org.role)) forbidden();
  const billing = await serverApi<BillingSummary>(`/orgs/${orgId}/billing`);
  const isOwner = org.role === 'OWNER';
  const troubled = billing.subscriptionStatus && !['active', 'trialing'].includes(billing.subscriptionStatus);

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your plan, usage and payment details. Payments are handled by Stripe."
        actions={
          isOwner && billing.hasBillingAccount && billing.checkoutAvailable ? (
            <ManageBillingButton orgId={orgId} />
          ) : undefined
        }
      />

      <div className="space-y-6">
        {checkout === 'success' && (
          <p role="status" className="rounded-md bg-success-soft px-4 py-3 text-sm text-success">
            Thanks! Your subscription is being activated. It can take a few seconds for Stripe to confirm.
          </p>
        )}
        {checkout === 'cancelled' && (
          <p role="status" className="rounded-md bg-surface-2 px-4 py-3 text-sm text-muted">
            Checkout was cancelled. You have not been charged.
          </p>
        )}
        {troubled && (
          <p role="alert" className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
            Your subscription is {billing.subscriptionStatus?.replace('_', ' ')}. Update your payment method to keep
            your plan.
          </p>
        )}
        {!billing.checkoutAvailable && (
          <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
            Online checkout isn’t configured on this server. Set <code className="font-mono">STRIPE_SECRET_KEY</code>{' '}
            and the price IDs (see <code className="font-mono">.env.example</code>) to enable Stripe test mode.
          </p>
        )}

        <Card className="grid gap-6 p-5 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
              {PLAN_INFO[billing.plan].name}
              {billing.subscriptionStatus && (
                <Badge tone={troubled ? 'warning' : 'success'}>{billing.subscriptionStatus}</Badge>
              )}
            </p>
            {billing.currentPeriodEnd && (
              <p className="mt-1 text-sm text-muted">Renews {formatDate(billing.currentPeriodEnd)}</p>
            )}
          </div>
          <Meter label="Active projects" used={billing.usage.activeProjects} max={billing.limits.maxActiveProjects} />
          <Meter label="Team seats" used={billing.usage.seats} max={billing.limits.maxSeats} />
        </Card>

        <ul className="grid gap-4 md:grid-cols-3">
          {PLANS.map((id) => {
            const p = PLAN_INFO[id];
            const current = id === billing.plan;
            const upgrade = RANK[id] > RANK[billing.plan];
            return (
              <li key={id}>
                <Card className={cn('flex h-full flex-col p-5', current && 'border-accent ring-1 ring-accent')}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">{p.name}</h2>
                    {current && <Badge tone="accent">Current</Badge>}
                  </div>
                  <p className="mt-2">
                    <span className="text-3xl font-semibold">${p.priceMonthly}</span>
                    <span className="text-sm text-muted"> / month</span>
                  </p>
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span aria-hidden="true" className="text-success">
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {upgrade && isOwner ? (
                      <UpgradeButton
                        orgId={orgId}
                        plan={id}
                        label={`Upgrade to ${p.name}`}
                        disabled={!billing.checkoutAvailable}
                      />
                    ) : upgrade ? (
                      <p className="text-sm text-muted">Only the owner can change the plan.</p>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function Meter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">
        {used}
        <span className="text-base font-normal text-muted"> / {max ?? 'unlimited'}</span>
      </p>
      {max !== null && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label={`${label} used`}
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={cn('h-full rounded-full', pct >= 100 ? 'bg-danger' : 'bg-accent')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

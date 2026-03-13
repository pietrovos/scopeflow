'use client';

import { useState } from 'react';
import type { Plan } from '@scopeflow/shared';
import { useApi } from '@/lib/api-context';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/** Redirects to Stripe Checkout or the Customer Portal; Stripe hosts the payment UI. */
export function UpgradeButton({
  orgId,
  plan,
  label,
  disabled,
}: {
  orgId: string;
  plan: Plan;
  label: string;
  disabled?: boolean;
}) {
  const api = useApi();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Button
      className="w-full"
      disabled={disabled}
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          const { url } = await api.post<{ url: string }>(`/orgs/${orgId}/billing/checkout`, { plan });
          window.location.href = url;
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Could not start checkout', 'error');
          setPending(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

export function ManageBillingButton({ orgId }: { orgId: string }) {
  const api = useApi();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          const { url } = await api.post<{ url: string }>(`/orgs/${orgId}/billing/portal`);
          window.location.href = url;
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Could not open the billing portal', 'error');
          setPending(false);
        }
      }}
    >
      Manage billing
    </Button>
  );
}

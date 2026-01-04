import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ROLE_LABELS } from '@scopeflow/shared';
import { serverApi } from '@/lib/server-api';
import type { Me } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { SignOutButton } from '@/components/shell/sign-out-button';

export const metadata = { title: 'Your organizations' };

export default async function OrgPicker() {
  const me = await serverApi<Me>('/me');
  if (me.organizations.length === 1) redirect(`/orgs/${me.organizations[0]!.id}`);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Hi {me.user.name.split(' ')[0]}</h1>
      <p className="mt-1 text-muted">Choose an organization to continue.</p>
      <Card className="mt-6">
        {me.organizations.length === 0 ? (
          <EmptyState
            title="You’re not in any organization yet"
            description="Create one for your agency, or ask a teammate or agency for an invitation link."
          />
        ) : (
          <ul className="divide-y divide-border">
            {me.organizations.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/orgs/${org.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-surface-2"
                >
                  <span className="font-medium">{org.name}</span>
                  <Badge>{ROLE_LABELS[org.role]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="mt-4 flex items-center justify-between">
        <Link href="/orgs/new" className="text-sm font-medium text-accent hover:underline">
          + Create an organization
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}

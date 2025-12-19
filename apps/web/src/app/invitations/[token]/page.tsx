import Link from 'next/link';
import { ROLE_LABELS } from '@scopeflow/shared';
import { auth } from '@/auth';
import type { InvitationPreview } from '@/lib/types';
import { ApiProvider } from '@/lib/api-context';
import { publicApiUrl } from '@/lib/server-api';
import { Card } from '@/components/ui/card';
import { SignInButton } from '@/components/shell/sign-in-button';
import { AcceptInvitation } from './accept-invitation';

export const metadata = { title: 'Invitation' };

async function preview(token: string): Promise<InvitationPreview | null> {
  const res = await fetch(`${process.env.API_INTERNAL_URL ?? 'http://localhost:4100'}/invitations/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as InvitationPreview) : null;
}

export default async function InvitationPage({ params }: PageProps<'/invitations/[token]'>) {
  const { token } = await params;
  const [inv, session] = await Promise.all([preview(token), auth()]);
  const signedIn = Boolean(session?.accessToken && !session.error);

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <Card className="p-6">
        {!inv ? (
          <>
            <h1 className="text-xl font-semibold">This invitation isn’t valid</h1>
            <p className="mt-2 text-muted">It may have been revoked or replaced. Ask whoever invited you for a new link.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{inv.inviterName} invited you to</p>
            <h1 className="mt-1 text-2xl font-semibold">{inv.orgName}</h1>
            <p className="mt-2 text-sm">
              as <strong>{ROLE_LABELS[inv.role]}</strong> · sent to <strong>{inv.email}</strong>
            </p>
            <div className="mt-6">
              {inv.status === 'accepted' ? (
                <p className="text-muted">This invitation has already been used.</p>
              ) : inv.status === 'expired' ? (
                <p className="text-muted">This invitation has expired. Ask {inv.inviterName} to send a new one.</p>
              ) : signedIn ? (
                <ApiProvider baseUrl={publicApiUrl()} token={session!.accessToken}>
                  <AcceptInvitation token={token} />
                </ApiProvider>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Sign in or create an account with <strong>{inv.email}</strong> to accept.
                  </p>
                  <SignInButton redirectTo={`/invitations/${token}`} label="Sign in to accept" />
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      <p className="mt-4 text-center text-sm">
        <Link href="/" className="text-muted hover:text-text">ScopeFlow</Link>
      </p>
    </main>
  );
}

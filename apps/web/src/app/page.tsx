import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SignInButton } from '@/components/shell/sign-in-button';

const notices: Record<string, string> = {
  required: 'Please sign in to continue.',
  expired: 'Your session expired. Please sign in again.',
};

export default async function Home({ searchParams }: PageProps<'/'>) {
  const session = await auth();
  const { signin, error } = await searchParams;
  if (session?.accessToken && !session.error && !signin) redirect('/orgs');
  const notice = typeof signin === 'string' ? notices[signin] : error ? 'Sign-in failed. Please try again.' : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo /> ScopeFlow
        </Link>
        <SignInButton />
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        {notice && (
          <p role="status" className="mb-6 w-fit rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            {notice}
          </p>
        )}
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">For agencies and their clients</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Agree on scope changes with your clients.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Track projects and milestones, then propose changes with their price and deadline impact. Clients approve a
          specific revision, and the project keeps a record of each edit and decision.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SignInButton label="Sign in to ScopeFlow" />
          <span className="text-sm text-muted">Demo accounts are listed in the README.</span>
        </div>

        <dl className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            [
              'Immutable revisions',
              'Each edit creates a new revision. Approvals record which revision the client accepted.',
            ],
            [
              'Live updates',
              'See comments and project activity as they happen. Missed events load when you reconnect.',
            ],
            ['Agency workspaces', 'Each agency has its own projects. Clients can access only their assigned projects.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-border bg-surface p-5">
              <dt className="font-medium">{title}</dt>
              <dd className="mt-1 text-sm text-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-accent" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
      <path
        d="M7 15.5c2.5 1.5 7.5 1.5 10-1M7 9.5c2.5-1.5 7.5-1.5 10 1"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

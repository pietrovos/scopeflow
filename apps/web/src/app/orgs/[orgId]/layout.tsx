import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import type { Me } from '@/lib/types';
import { Avatar } from '@/components/ui/avatar';
import { NavLinks } from '@/components/shell/nav-links';
import { OrgSwitcher } from '@/components/shell/org-switcher';
import { MobileNav } from '@/components/shell/mobile-nav';
import { SignOutButton } from '@/components/shell/sign-out-button';

export default async function OrgLayout({ children, params }: LayoutProps<'/orgs/[orgId]'>) {
  const { orgId } = await params;
  const me = await serverApi<Me>('/me');
  const org = me.organizations.find((o) => o.id === orgId);
  if (!org) notFound();

  const userBlock = (
    <div className="flex items-center gap-3 px-1">
      <Avatar name={me.user.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{me.user.name}</p>
        <p className="truncate text-xs text-muted">{me.user.email}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col lg:gap-6 lg:p-4">
        <Link href={`/orgs/${orgId}`} className="flex items-center gap-2 px-1 text-lg font-semibold">
          ScopeFlow
          {org.role === 'CLIENT' && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
              Client portal
            </span>
          )}
        </Link>
        <OrgSwitcher current={org} orgs={me.organizations} />
        <nav aria-label="Main" className="flex-1">
          <NavLinks orgId={orgId} role={org.role} />
        </nav>
        <div className="space-y-2 border-t border-border pt-4">
          {userBlock}
          <SignOutButton />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2 backdrop-blur lg:hidden">
        <Link href={`/orgs/${orgId}`} className="font-semibold">
          ScopeFlow <span className="font-normal text-muted">· {org.name}</span>
        </Link>
        <MobileNav title="Menu">
          <div className="space-y-5">
            <OrgSwitcher current={org} orgs={me.organizations} />
            <nav aria-label="Main">
              <NavLinks orgId={orgId} role={org.role} />
            </nav>
            <div className="space-y-2 border-t border-border pt-4">
              {userBlock}
              <SignOutButton />
            </div>
          </div>
        </MobileNav>
      </header>

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}

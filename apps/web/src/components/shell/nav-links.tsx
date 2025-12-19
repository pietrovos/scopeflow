'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@scopeflow/shared';
import { cn } from '@/lib/cn';
import { navFor } from './nav';
import { icons } from './icons';

export function NavLinks({ orgId, role }: { orgId: string; role: Role }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {navFor(role).map((item) => {
        const href = item.href(orgId);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = icons[item.icon];
        return (
          <li key={item.label}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              <Icon />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

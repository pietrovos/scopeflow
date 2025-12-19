'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ROLE_LABELS } from '@scopeflow/shared';
import type { OrgSummary } from '@/lib/types';
import { cn } from '@/lib/cn';
import { icons } from './icons';

/** Disclosure menu of org links. Escape or clicking elsewhere closes it. */
export function OrgSwitcher({ current, orgs }: { current: OrgSummary; orgs: OrgSummary[] }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="sr-only">Current organization: </span>
          <span className="block truncate text-sm font-semibold">{current.name}</span>
          <span className="block text-xs text-muted">{ROLE_LABELS[current.role]}</span>
        </span>
        {icons.chevron({})}
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute inset-x-0 top-full z-30 mt-1 rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">Switch organization</p>
          <ul>
            {orgs.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/orgs/${org.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={org.id === current.id ? 'true' : undefined}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded px-3 py-2 text-sm hover:bg-surface-2',
                    org.id === current.id && 'font-semibold',
                  )}
                >
                  <span className="truncate">{org.name}</span>
                  <span className="text-xs text-muted">{ROLE_LABELS[org.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-border pt-1">
            <Link href="/orgs/new" className="block rounded px-3 py-2 text-sm text-accent hover:bg-surface-2">
              + New organization
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

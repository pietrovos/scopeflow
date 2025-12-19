'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { icons } from './icons';

/** Below the lg breakpoint the sidebar moves into a modal menu, closed on navigation. */
export function MobileNav({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  // Open state is tied to the path it was opened on, so navigating closes it.
  const open = openOn === pathname;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpenOn(pathname)}
        className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text"
        aria-label="Open navigation"
      >
        {icons.menu({})}
      </button>
      <Dialog open={open} onClose={() => setOpenOn(null)} title={title} className="max-w-sm">
        {children}
      </Dialog>
    </>
  );
}

'use client';

import { useLive } from '@/lib/realtime';
import { cn } from '@/lib/cn';

const LABELS = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  revoked: 'Access removed',
} as const;

export function LiveStatusPill() {
  const { status } = useLive();
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'live' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', status === 'live' ? 'bg-success' : 'animate-pulse bg-warning')}
      />
      {LABELS[status]}
    </span>
  );
}

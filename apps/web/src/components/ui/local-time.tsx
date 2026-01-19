'use client';

import { useSyncExternalStore } from 'react';
import { formatDate, formatDateTime, relativeTime } from '@/lib/format';

// A store whose value is the current minute. The server snapshot is null, so the
// hydration render matches the server HTML; after that, times render in the viewer's
// timezone and relative labels ("5 minutes ago") stay fresh.
const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);
const serverMinute = () => null;

export function LocalTime({
  iso,
  mode = 'datetime',
  className,
}: {
  iso: string;
  mode?: 'datetime' | 'relative';
  className?: string;
}) {
  const minute = useSyncExternalStore(subscribe, currentMinute, serverMinute);
  const text =
    minute === null ? formatDate(iso) : mode === 'relative' ? relativeTime(iso, minute * 60_000) : formatDateTime(iso);
  return (
    <time dateTime={iso} title={minute === null ? undefined : formatDateTime(iso)} className={className}>
      {text}
    </time>
  );
}

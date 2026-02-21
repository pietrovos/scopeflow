'use client';

import { useLive } from '@/lib/realtime';
import { Card, CardHeader } from '@/components/ui/card';
import { ActivityItem } from '@/components/activity/activity-item';

export function ActivityFeed({ limit = 15 }: { limit?: number }) {
  const { events } = useLive();
  return (
    <Card>
      <CardHeader title="Activity" />
      {events.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">Nothing yet.</p>
      ) : (
        <ol aria-label="Recent activity" aria-live="polite" className="space-y-4 px-4 py-4 sm:px-5">
          {events.slice(0, limit).map((e) => (
            <li key={e.seq}>
              <ActivityItem event={e} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

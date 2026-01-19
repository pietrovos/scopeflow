import type { ActivityEventDto } from '@/lib/types';
import { describeActivity } from '@/lib/activity';
import { LocalTime } from '@/components/ui/local-time';
import { Avatar } from '@/components/ui/avatar';

export function ActivityItem({ event, showProject }: { event: ActivityEventDto; showProject?: string }) {
  const actor = event.actor?.name ?? 'System';
  return (
    <div className="flex gap-3">
      <Avatar name={actor} size="sm" className="mt-0.5" />
      <div className="min-w-0 text-sm">
        <p>
          <span className="font-medium">{actor}</span> {describeActivity(event)}
          {showProject && <span className="text-muted"> in {showProject}</span>}
        </p>
        <LocalTime iso={event.createdAt} mode="relative" className="text-xs text-muted" />
      </div>
    </div>
  );
}

import { formatCents, formatDayDelta } from '@scopeflow/shared';
import { Badge, type Tone } from '@/components/ui/badge';
import type { ScopeChangeStatus } from '@/lib/types';

const map: Record<ScopeChangeStatus, [string, Tone]> = {
  PENDING: ['Awaiting approval', 'warning'],
  APPROVED: ['Approved', 'success'],
  REJECTED: ['Rejected', 'danger'],
  WITHDRAWN: ['Withdrawn', 'neutral'],
};

export function ScopeStatusBadge({ status }: { status: ScopeChangeStatus }) {
  const [label, tone] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Delta({ cents, days }: { cents: number; days: number }) {
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1 text-sm">
      <span className={cents > 0 ? 'text-warning' : cents < 0 ? 'text-success' : 'text-muted'}>
        <PriceDelta cents={cents} />
      </span>
      <span className={days > 0 ? 'text-warning' : days < 0 ? 'text-success' : 'text-muted'}>
        <DayDelta days={days} />
      </span>
    </span>
  );
}

export const PriceDelta = ({ cents }: { cents: number }) => (
  <>{cents === 0 ? 'No cost change' : formatCents(cents, { signed: true })}</>
);
export const DayDelta = ({ days }: { days: number }) => <>{days === 0 ? 'No schedule change' : formatDayDelta(days)}</>;

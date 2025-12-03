export function formatCents(cents: number, opts: { signed?: boolean } = {}): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(Math.abs(cents) / 100);
  if (cents < 0) return `−${formatted}`;
  return opts.signed && cents > 0 ? `+${formatted}` : formatted;
}

export function formatDayDelta(days: number): string {
  if (days === 0) return 'No change';
  const unit = Math.abs(days) === 1 ? 'day' : 'days';
  return days > 0 ? `+${days} ${unit}` : `−${Math.abs(days)} ${unit}`;
}

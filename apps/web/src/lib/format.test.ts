import { formatDate, initials, relativeTime, toDateInput } from './format';

describe('format', () => {
  it('formats date-only values in UTC so they do not shift a day', () => {
    expect(formatDate('2026-12-15T00:00:00.000Z')).toBe('Dec 15, 2026');
    expect(toDateInput('2026-12-15T00:00:00.000Z')).toBe('2026-12-15');
    expect(formatDate(null)).toBe('—');
  });

  it('makes initials', () => {
    expect(initials('Olivia Hart')).toBe('OH');
    expect(initials('  dana  ')).toBe('D');
  });

  it('describes recent times relatively', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    expect(relativeTime('2026-10-05T11:59:50Z', now)).toBe('just now');
    expect(relativeTime('2026-10-05T11:30:00Z', now)).toBe('30 minutes ago');
    expect(relativeTime('2026-10-04T12:00:00Z', now)).toBe('yesterday');
    expect(relativeTime('2026-10-05T12:01:00Z', now)).toBe('just now');
  });
});

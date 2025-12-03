import { describe, expect, it } from 'vitest';
import { diffWords } from './diff.js';
import { formatCents, formatDayDelta } from './money.js';

describe('diffWords', () => {
  it('marks inserted and removed words', () => {
    expect(diffWords('add a login page', 'add a signup page')).toEqual([
      { kind: 'same', text: 'add a ' },
      { kind: 'removed', text: 'login' },
      { kind: 'added', text: 'signup' },
      { kind: 'same', text: ' page' },
    ]);
  });

  it('handles empty inputs', () => {
    expect(diffWords('', 'new')).toEqual([{ kind: 'added', text: 'new' }]);
    expect(diffWords('old', '')).toEqual([{ kind: 'removed', text: 'old' }]);
    expect(diffWords('', '')).toEqual([]);
  });
});

describe('money', () => {
  it('formats signed deltas', () => {
    expect(formatCents(250000, { signed: true })).toBe('+$2,500');
    expect(formatCents(-1050)).toBe('−$10.50');
    expect(formatDayDelta(-1)).toBe('−1 day');
    expect(formatDayDelta(0)).toBe('No change');
  });
});

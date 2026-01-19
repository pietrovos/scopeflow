import { describeActivity } from './activity';

describe('describeActivity', () => {
  it('describes an approval with the exact revision and impact', () => {
    expect(
      describeActivity({
        type: 'scope_change.approved',
        data: { number: 3, title: 'Reminders', revisionNumber: 2, priceDeltaCents: 450000, deadlineDeltaDays: 10 },
      }),
    ).toBe('approved revision 2 of SC-3 “Reminders” (+$4,500, +10 days)');
  });

  it('marks resubmissions after a rejection', () => {
    expect(
      describeActivity({
        type: 'scope_change.revised',
        data: { number: 1, title: 'X', revisionNumber: 3, reopened: true },
      }),
    ).toBe('revised and resubmitted SC-1 “X” → revision 3');
  });

  it('falls back to the raw type for unknown events', () => {
    expect(describeActivity({ type: 'something.new' as never, data: {} })).toBe('something.new');
  });
});

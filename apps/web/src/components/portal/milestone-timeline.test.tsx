import { render, screen } from '@testing-library/react';
import type { Milestone } from '@/lib/types';
import { MilestoneTimeline } from './milestone-timeline';

const m = (over: Partial<Milestone>): Milestone => ({
  id: crypto.randomUUID(),
  projectId: 'p',
  title: 'x',
  description: '',
  status: 'PLANNED',
  dueDate: null,
  amountCents: 0,
  position: 0,
  version: 1,
  updatedAt: '',
  ...over,
});

describe('MilestoneTimeline', () => {
  it('lists milestones in order with a text status for screen readers', () => {
    render(
      <MilestoneTimeline
        milestones={[
          m({ title: 'Discovery', status: 'DONE', amountCents: 800000 }),
          m({ title: 'Build', status: 'IN_PROGRESS', dueDate: '2026-11-20T00:00:00.000Z' }),
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Discovery');
    expect(items[0]).toHaveTextContent('Status: Done · $8,000');
    expect(items[1]).toHaveTextContent('Nov 20, 2026');
    expect(items[1]).toHaveTextContent('Status: In progress');
  });

  it('explains an empty timeline', () => {
    render(<MilestoneTimeline milestones={[]} />);
    expect(screen.getByText(/hasn’t published milestones/)).toBeInTheDocument();
  });
});

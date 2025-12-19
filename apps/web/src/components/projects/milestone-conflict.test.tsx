import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Milestone } from '@/lib/types';
import { MilestoneConflict } from './milestone-conflict';

const theirs: Milestone = {
  id: 'm1',
  projectId: 'p1',
  title: 'Design system',
  description: 'Tokens and components',
  status: 'IN_PROGRESS',
  dueDate: '2026-11-01T00:00:00.000Z',
  amountCents: 500000,
  position: 0,
  version: 3,
  updatedAt: '2026-10-05T00:00:00.000Z',
};

const mine = {
  title: 'Design system v2',
  description: 'Tokens and components',
  status: 'DONE' as const,
  dueDate: '2026-11-01',
  amountCents: 500000,
};

describe('MilestoneConflict', () => {
  it('shows only the fields that differ', () => {
    render(<MilestoneConflict mine={mine} theirs={theirs} onResolve={vi.fn()} onCancel={vi.fn()} />);
    const group = screen.getByRole('group');
    expect(within(group).getByText('Title')).toBeInTheDocument();
    expect(within(group).getByText('Status')).toBeInTheDocument();
    expect(within(group).queryByText('Description')).not.toBeInTheDocument();
    expect(within(group).queryByText('Due date')).not.toBeInTheDocument();
  });

  it('saves the merge of the choices, defaulting to my edit', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(<MilestoneConflict mine={mine} theirs={theirs} onResolve={onResolve} onCancel={vi.fn()} />);

    // Keep their status, keep my title.
    await userEvent.click(screen.getByLabelText(/Keep the saved value: In progress/));
    await userEvent.click(screen.getByRole('button', { name: 'Save merged version' }));

    expect(onResolve).toHaveBeenCalledWith({
      title: 'Design system v2',
      description: 'Tokens and components',
      status: 'IN_PROGRESS',
      dueDate: '2026-11-01',
      amountCents: 500000,
    });
  });

  it('lets the user discard their edit', async () => {
    const onCancel = vi.fn();
    render(<MilestoneConflict mine={mine} theirs={theirs} onResolve={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Discard my edit' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

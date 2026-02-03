import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Revision, ScopeChangeDetail } from '@/lib/types';
import { ApiError } from '@/lib/api-error';
import { RevisePanel } from './revise-panel';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const post = vi.fn();
vi.mock('@/lib/api-context', () => ({ useApi: () => ({ post }) }));

const rev = (n: number, over: Partial<Revision> = {}): Revision => ({
  id: `rev-${n}`,
  revisionNumber: n,
  title: 'Appointment reminders',
  description: 'SMS and email reminders',
  priceDeltaCents: 450000,
  deadlineDeltaDays: 10,
  createdAt: '2026-10-05T12:00:00.000Z',
  createdBy: { id: 'u1', name: 'Marcus Lee' },
  ...over,
});

const sc = (revisions: Revision[], version: number): ScopeChangeDetail => ({
  id: 'sc-1',
  projectId: 'p',
  number: 3,
  status: 'PENDING',
  currentRevisionId: revisions.at(-1)!.id,
  approvedRevisionId: null,
  version,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: 'u1', name: 'Marcus Lee' },
  currentRevision: revisions.at(-1)!,
  project: { id: 'p', name: 'Portal', clientName: 'Acme' },
  revisions,
  decisions: [],
});

describe('RevisePanel conflict handling', () => {
  beforeEach(() => {
    post.mockReset();
    refresh.mockReset();
  });

  it('shows the other revision and resubmits mine against the new version', async () => {
    const theirs = rev(2, { priceDeltaCents: 380000, createdBy: { id: 'u2', name: 'Priya Raman' } });
    post
      .mockRejectedValueOnce(new ApiError(409, { error: 'version_conflict', current: sc([rev(1), theirs], 2) }))
      .mockResolvedValueOnce(sc([rev(1), theirs, rev(3)], 3));

    render(<RevisePanel orgId="o" projectId="p" sc={sc([rev(1)], 1)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Revise proposal' }));
    const price = screen.getByLabelText('Price impact (USD)');
    await userEvent.clear(price);
    await userEvent.type(price, '5000');
    await userEvent.click(screen.getByRole('button', { name: 'Submit revision 2' }));

    // Nothing was overwritten: the conflict view explains who saved what.
    const dialog = await screen.findByRole('dialog', { name: 'Someone else revised this proposal' });
    expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    expect(within(dialog).getByText('+$3,800')).toBeInTheDocument();
    expect(within(dialog).getByText('+$5,000')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit mine as revision 3' }));
    expect(post).toHaveBeenLastCalledWith(
      '/orgs/o/projects/p/scope-changes/sc-1/revisions',
      expect.objectContaining({ priceDeltaCents: 500000, version: 2 }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('can discard my draft instead', async () => {
    post.mockRejectedValueOnce(new ApiError(409, { error: 'version_conflict', current: sc([rev(1), rev(2)], 2) }));
    render(<RevisePanel orgId="o" projectId="p" sc={sc([rev(1)], 1)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Revise proposal' }));
    await userEvent.type(screen.getByLabelText('Title'), ' v2');
    await userEvent.click(screen.getByRole('button', { name: 'Submit revision 2' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard my draft' }));
    expect(post).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });
});

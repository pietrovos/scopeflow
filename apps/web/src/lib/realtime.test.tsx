import { act, render, screen } from '@testing-library/react';
import type { ActivityEventDto } from '@scopeflow/shared';
import { ProjectLive, useLive } from './realtime';

// A fake socket the test can drive: fire 'connect', push events, etc.
const handlers = new Map<string, (...args: unknown[]) => unknown>();
const fakeSocket = {
  on: (event: string, fn: (...args: unknown[]) => unknown) => handlers.set(event, fn),
  emitWithAck: vi.fn().mockResolvedValue({ ok: true }),
  disconnect: vi.fn(),
  connect: vi.fn(),
};
vi.mock('socket.io-client', () => ({ io: () => fakeSocket }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const get = vi.fn();
vi.mock('./api-context', () => ({
  useApi: () => ({ get, token: () => 't' }),
  useApiConfig: () => ({ baseUrl: 'http://api' }),
}));

const commentEvent = (seq: number, body: string): ActivityEventDto => ({
  seq: String(seq),
  orgId: 'o',
  projectId: 'p',
  type: 'comment.created',
  entityType: 'comment',
  entityId: `c${seq}`,
  data: {
    comment: {
      id: `c${seq}`,
      body,
      projectId: 'p',
      scopeChangeId: null,
      createdAt: '',
      author: { id: 'u', name: 'U' },
    },
  },
  actor: { id: 'u', name: 'U' },
  createdAt: '2026-10-05T12:00:00Z',
});

function Comments() {
  const { comments, status } = useLive();
  return (
    <div>
      <p>status:{status}</p>
      <ul>
        {comments.map((c) => (
          <li key={c.id}>{c.body}</li>
        ))}
      </ul>
    </div>
  );
}

describe('ProjectLive', () => {
  beforeEach(() => {
    handlers.clear();
    get.mockReset();
  });

  it('joins on connect, resyncs after the last seen seq, and ignores duplicates', async () => {
    get.mockResolvedValueOnce({ items: [commentEvent(7, 'missed while away')], hasMore: false });
    render(
      <ProjectLive orgId="o" projectId="p" initialEvents={[commentEvent(5, 'first')]} initialComments={[]}>
        <Comments />
      </ProjectLive>,
    );

    await act(async () => {
      await handlers.get('connect')!();
    });
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith('project:join', { orgId: 'o', projectId: 'p' });
    expect(get).toHaveBeenCalledWith('/orgs/o/projects/p/activity?after=5&limit=200');
    expect(screen.getByText('status:live')).toBeInTheDocument();

    // The same event arriving live after the resync must not render twice;
    // an older seq is ignored outright.
    act(() => {
      handlers.get('activity')!(commentEvent(7, 'missed while away'));
      handlers.get('activity')!(commentEvent(4, 'stale'));
      handlers.get('activity')!(commentEvent(8, 'new live comment'));
    });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'missed while away',
      'new live comment',
    ]);
  });

  it('shows reconnecting after a drop and reconnects itself after a server-side close', async () => {
    vi.useFakeTimers();
    render(
      <ProjectLive orgId="o" projectId="p" initialEvents={[]} initialComments={[]}>
        <Comments />
      </ProjectLive>,
    );
    act(() => {
      handlers.get('disconnect')!('io server disconnect');
    });
    expect(screen.getByText('status:reconnecting')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(600));
    expect(fakeSocket.connect).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

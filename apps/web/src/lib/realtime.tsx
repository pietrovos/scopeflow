'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS, type ActivityEventDto, type CommentDto } from '@scopeflow/shared';
import { useApi, useApiConfig } from './api-context';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'revoked';

interface LiveState {
  status: LiveStatus;
  events: ActivityEventDto[];
  comments: CommentDto[];
  addComment: (c: CommentDto) => void;
}

const LiveContext = createContext<LiveState | null>(null);

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive() must be used inside <ProjectLive>');
  return ctx;
}

/** Events that change data rendered by server components; the page refetches them. */
const REFRESH_PREFIXES = ['milestone.', 'scope_change.', 'project.'];

const bySeq = (a: ActivityEventDto, b: ActivityEventDto) => (BigInt(a.seq) < BigInt(b.seq) ? 1 : -1);

interface Props {
  orgId: string;
  projectId: string;
  /** Limit the discussion to one proposal's thread. */
  scopeChangeId?: string;
  initialEvents: ActivityEventDto[];
  initialComments: CommentDto[];
  children: ReactNode;
}

/**
 * Fetches `activity?after=<last seq seen>` after connecting or reconnecting.
 * Missed events are applied in sequence order; events also received through the
 * socket are deduplicated by sequence number.
 */
export function ProjectLive({ orgId, projectId, scopeChangeId, initialEvents, initialComments, children }: Props) {
  const api = useApi();
  const { baseUrl } = useApiConfig();
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [events, setEvents] = useState(initialEvents);
  const [comments, setComments] = useState(initialComments);
  const lastSeq = useRef<bigint>(initialEvents.reduce((max, e) => (BigInt(e.seq) > max ? BigInt(e.seq) : max), 0n));
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const addComment = useCallback(
    (c: CommentDto) => {
      if (scopeChangeId && c.scopeChangeId !== scopeChangeId) return;
      setComments((cur) => (cur.some((x) => x.id === c.id) ? cur : [...cur, c]));
    },
    [scopeChangeId],
  );

  const apply = useCallback(
    (incoming: ActivityEventDto[]) => {
      const fresh = incoming.filter((e) => BigInt(e.seq) > lastSeq.current);
      if (fresh.length === 0) return;
      for (const e of fresh) if (BigInt(e.seq) > lastSeq.current) lastSeq.current = BigInt(e.seq);
      setEvents((cur) => [...fresh, ...cur].sort(bySeq).slice(0, 100));
      for (const e of fresh) {
        if (e.type === 'comment.created' && e.data.comment) addComment(e.data.comment as CommentDto);
      }
      if (fresh.some((e) => REFRESH_PREFIXES.some((p) => e.type.startsWith(p)))) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 250);
      }
    },
    [addComment, router],
  );

  const resync = useCallback(async () => {
    for (let page = 0; page < 20; page++) {
      const res = await api.get<{ items: ActivityEventDto[]; hasMore: boolean }>(
        `/orgs/${orgId}/projects/${projectId}/activity?after=${lastSeq.current}&limit=200`,
      );
      apply(res.items);
      if (!res.hasMore) return;
    }
  }, [api, apply, orgId, projectId]);

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;

    socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      // Called on every (re)connect, so an expired token is replaced by a refreshed one.
      auth: (cb) => {
        void fetch('/api/auth/session', { cache: 'no-store' })
          .then((r) => r.json() as Promise<{ accessToken?: string } | null>)
          .then((s) => cb({ token: s?.accessToken ?? '' }))
          .catch(() => cb({ token: api.token() }));
      },
    });

    socket.on('connect', async () => {
      const ack = (await socket!.emitWithAck(WS.joinProject, { orgId, projectId })) as { ok: boolean };
      if (cancelled) return;
      if (!ack.ok) {
        setStatus('revoked');
        return;
      }
      setStatus('live');
      await resync().catch(() => undefined);
    });
    socket.on('disconnect', (reason) => {
      if (cancelled) return;
      setStatus('reconnecting');
      // The server closes the socket when the token expires; socket.io won't retry
      // a server-initiated disconnect on its own.
      if (reason === 'io server disconnect') setTimeout(() => socket?.connect(), 500);
    });
    socket.on('connect_error', () => !cancelled && setStatus('reconnecting'));
    socket.on(WS.activity, (e: ActivityEventDto) => apply([e]));
    socket.on(WS.accessRevoked, () => {
      setStatus('revoked');
      router.refresh();
    });

    return () => {
      cancelled = true;
      clearTimeout(refreshTimer.current);
      socket?.disconnect();
    };
  }, [api, apply, baseUrl, orgId, projectId, resync, router]);

  const value = useMemo(() => ({ status, events, comments, addComment }), [status, events, comments, addComment]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

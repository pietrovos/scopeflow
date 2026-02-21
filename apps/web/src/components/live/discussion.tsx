'use client';

import { useEffect, useRef, useState } from 'react';
import type { CommentDto } from '@scopeflow/shared';
import { useApi } from '@/lib/api-context';
import { useLive } from '@/lib/realtime';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/field';
import { LocalTime } from '@/components/ui/local-time';
import { EmptyState } from '@/components/ui/states';
import { LiveStatusPill } from './live-status';

export function Discussion({
  orgId,
  projectId,
  scopeChangeId,
  title = 'Discussion',
}: {
  orgId: string;
  projectId: string;
  scopeChangeId?: string;
  title?: string;
}) {
  const api = useApi();
  const { comments, addComment } = useLive();
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  async function submit() {
    if (!body.trim()) return;
    setPending(true);
    setError(undefined);
    try {
      const c = await api.post<CommentDto>(`/orgs/${orgId}/projects/${projectId}/comments`, {
        body,
        scopeChangeId: scopeChangeId ?? null,
      });
      addComment({ ...c, createdAt: String(c.createdAt) });
      setBody('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comment not posted');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader title={title} action={<LiveStatusPill />} />
      {comments.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Questions and decisions posted here are visible to the whole project."
        />
      ) : (
        <ol ref={listRef} aria-label="Comments" className="max-h-[28rem] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author.name} size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{c.author.name}</span>{' '}
                  <LocalTime iso={c.createdAt} mode="relative" className="text-xs text-muted" />
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form
        className="space-y-2 border-t border-border p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={`comment-${scopeChangeId ?? projectId}`} className="sr-only">
          Write a comment
        </label>
        <Textarea
          id={`comment-${scopeChangeId ?? projectId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
          }}
          placeholder="Write a comment…"
          maxLength={5000}
          className="min-h-20"
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">Ctrl/⌘ + Enter to send</span>
          <Button type="submit" size="sm" loading={pending} disabled={!body.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </Card>
  );
}

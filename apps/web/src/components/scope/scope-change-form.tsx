'use client';

import { useState } from 'react';
import type { ScopeChangeContent } from '@scopeflow/shared';
import { ApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ErrorNotice } from '@/components/ui/states';

export interface ScopeDraft {
  title: string;
  description: string;
  price: string;
  days: string;
}

export const draftFrom = (c?: ScopeChangeContent): ScopeDraft => ({
  title: c?.title ?? '',
  description: c?.description ?? '',
  price: c ? String(c.priceDeltaCents / 100) : '',
  days: c ? String(c.deadlineDeltaDays) : '0',
});

export const contentFrom = (d: ScopeDraft): ScopeChangeContent => ({
  title: d.title.trim(),
  description: d.description.trim(),
  priceDeltaCents: Math.round(Number(d.price.replace(/[^0-9.-]/g, '') || 0) * 100),
  deadlineDeltaDays: Math.trunc(Number(d.days || 0)),
});

/** Shared by "propose" and "revise". Price and schedule deltas may be negative (descoping). */
export function ScopeChangeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  note,
}: {
  initial?: ScopeDraft;
  submitLabel: string;
  onSubmit: (content: ScopeChangeContent, draft: ScopeDraft) => Promise<void>;
  onCancel: () => void;
  note?: React.ReactNode;
}) {
  const [draft, setDraft] = useState<ScopeDraft>(initial ?? draftFrom());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const set = (k: keyof ScopeDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setErrors({});
        setFormError(undefined);
        try {
          await onSubmit(contentFrom(draft), draft);
        } catch (err) {
          if (err instanceof ApiError && err.body.issues) setErrors(err.fieldErrors());
          else setFormError(err instanceof Error ? err.message : 'Could not save');
        } finally {
          setPending(false);
        }
      }}
    >
      {note}
      {formError && <ErrorNotice title="Not saved">{formError}</ErrorNotice>}
      <Field label="Title" error={errors.title}>
        {(p) => <Input {...p} value={draft.title} onChange={set('title')} required maxLength={160} />}
      </Field>
      <Field label="What changes and why" error={errors.description}>
        {(p) => (
          <Textarea {...p} value={draft.description} onChange={set('description')} required className="min-h-32" />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price impact (USD)" error={errors.priceDeltaCents} hint="Negative if scope is removed.">
          {(p) => <Input {...p} value={draft.price} onChange={set('price')} inputMode="decimal" required />}
        </Field>
        <Field label="Schedule impact (days)" error={errors.deadlineDeltaDays} hint="Negative if it saves time.">
          {(p) => <Input {...p} value={draft.days} onChange={set('days')} type="number" min={-365} max={365} />}
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

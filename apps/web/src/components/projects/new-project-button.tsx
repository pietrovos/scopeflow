'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { ApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ErrorNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

export function NewProjectButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>New project</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New project">
        <NewProjectForm orgId={orgId} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function NewProjectForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(fd: FormData) {
    setPending(true);
    setErrors({});
    setFormError(undefined);
    const budget = String(fd.get('budget') || '').replace(/[^0-9.]/g, '');
    try {
      const project = await api.post<{ id: string }>(`/orgs/${orgId}/projects`, {
        name: fd.get('name'),
        clientName: fd.get('clientName'),
        description: fd.get('description') || '',
        budgetCents: budget ? Math.round(Number(budget) * 100) : 0,
        dueDate: fd.get('dueDate') || null,
      });
      toast('Project created');
      onDone();
      router.push(`/orgs/${orgId}/projects/${project.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.body.issues) setErrors(e.fieldErrors());
      else setFormError(e instanceof Error ? e.message : 'Could not create the project');
      setPending(false);
    }
  }

  return (
    <form action={submit} className="space-y-4">
      {formError && <ErrorNotice title="Couldn’t create project">{formError}</ErrorNotice>}
      <Field label="Project name" error={errors.name}>
        {(p) => <Input {...p} name="name" required maxLength={120} placeholder="Patient portal redesign" />}
      </Field>
      <Field label="Client" error={errors.clientName}>
        {(p) => <Input {...p} name="clientName" required maxLength={120} placeholder="Acme Health" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget (USD)" error={errors.budgetCents}>
          {(p) => <Input {...p} name="budget" inputMode="decimal" placeholder="25,000" />}
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          {(p) => <Input {...p} name="dueDate" type="date" />}
        </Field>
      </div>
      <Field label="Description" error={errors.description}>
        {(p) => <Textarea {...p} name="description" maxLength={5000} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Create project
        </Button>
      </div>
    </form>
  );
}

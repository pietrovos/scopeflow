'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROLE_LABELS, type Role } from '@scopeflow/shared';
import type { Invitation, Project } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { ApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ErrorNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { CopyLink } from './copy-link';

export function InviteForm({
  orgId,
  projects,
  canInviteAdmins,
}: {
  orgId: string;
  projects: Pick<Project, 'id' | 'name' | 'clientName'>[];
  canInviteAdmins: boolean;
}) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const [role, setRole] = useState<Exclude<Role, 'OWNER'>>('MEMBER');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [created, setCreated] = useState<Invitation | null>(null);
  const [pending, setPending] = useState(false);
  const roles: Exclude<Role, 'OWNER'>[] = canInviteAdmins ? ['ADMIN', 'MEMBER', 'CLIENT'] : ['MEMBER', 'CLIENT'];

  async function submit(fd: FormData) {
    setPending(true);
    setErrors({});
    setFormError(undefined);
    try {
      const inv = await api.post<Invitation>(`/orgs/${orgId}/invitations`, {
        email: fd.get('email'),
        role,
        projectIds: role === 'CLIENT' ? projectIds : [],
      });
      setCreated(inv);
      setProjectIds([]);
      toast(`Invitation sent to ${inv.email}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.body.issues) setErrors(e.fieldErrors());
      else setFormError(e instanceof Error ? e.message : 'Could not send the invitation');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form action={submit} className="space-y-4">
        {formError && <ErrorNotice title="Invitation not sent">{formError}</ErrorNotice>}
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Email" error={errors.email}>
            {(p) => (
              <Input {...p} name="email" type="email" required placeholder="name@company.com" autoComplete="off" />
            )}
          </Field>
          <Field label="Role" error={errors.role}>
            {(p) => (
              <Select {...p} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {role === 'CLIENT' && (
          <fieldset>
            <legend className="text-sm font-medium">Projects they can see</legend>
            <p className="text-sm text-muted">Clients only see the projects you choose. You can change this later.</p>
            {projects.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Create a project first.</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {projects.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-accent"
                  >
                    <input
                      type="checkbox"
                      checked={projectIds.includes(p.id)}
                      onChange={(e) =>
                        setProjectIds((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id)))
                      }
                    />
                    <span className="min-w-0 truncate">
                      {p.name} <span className="text-muted">· {p.clientName}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
        <Button type="submit" loading={pending}>
          Send invitation
        </Button>
      </form>
      {created?.url && (
        <div className="rounded-md border border-border bg-surface-2 p-3 text-sm">
          <p>
            Share this link with <strong>{created.email}</strong>. It works once and expires in 7 days.
          </p>
          <CopyLink url={created.url} className="mt-2" />
        </div>
      )}
    </div>
  );
}

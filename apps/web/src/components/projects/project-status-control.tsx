'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PROJECT_STATUSES, type ProjectStatus } from '@scopeflow/shared';
import { useApi } from '@/lib/api-context';
import { Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { PROJECT_STATUS_LABEL } from '@/components/status';

export function ProjectStatusControl({ orgId, projectId, status }: { orgId: string; projectId: string; status: ProjectStatus }) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(status);

  return (
    <>
      <label htmlFor="project-status" className="sr-only">
        Project status
      </label>
      <Select
        id="project-status"
        value={value}
        className="h-9 w-36"
        onChange={async (e) => {
          const next = e.target.value as ProjectStatus;
          setValue(next);
          try {
            await api.patch(`/orgs/${orgId}/projects/${projectId}`, { status: next });
            toast(`Project marked ${PROJECT_STATUS_LABEL[next].toLowerCase()}`);
            router.refresh();
          } catch (err) {
            setValue(status);
            toast(err instanceof Error ? err.message : 'Update failed', 'error');
          }
        }}
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
    </>
  );
}

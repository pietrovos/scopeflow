'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { ApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export function CreateOrgForm() {
  const api = useApi();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    try {
      const org = await api.post<{ id: string }>('/orgs', { name: formData.get('name') });
      router.push(`/orgs/${org.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? (e.fieldErrors().name ?? e.message) : 'Could not create the organization');
      setPending(false);
    }
  }

  return (
    <form action={submit} className="space-y-4">
      <Field label="Organization name" error={error}>
        {(p) => <Input {...p} name="name" required maxLength={80} placeholder="Northwind Studio" />}
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        Create organization
      </Button>
    </form>
  );
}

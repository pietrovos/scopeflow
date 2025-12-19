import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { CreateOrgForm } from './create-org-form';

export const metadata = { title: 'New organization' };

export default function NewOrgPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link href="/orgs" className="text-sm text-muted hover:text-text">
        ← Back
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Create an organization</h1>
      <p className="mt-1 text-muted">Usually your agency or studio. You can invite your team and clients next.</p>
      <Card className="mt-6 p-5">
        <CreateOrgForm />
      </Card>
    </main>
  );
}

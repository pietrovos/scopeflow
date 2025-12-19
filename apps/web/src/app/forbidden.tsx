import Link from 'next/link';

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-accent">403</p>
      <h1 className="mt-2 text-2xl font-semibold">You don’t have access to this page</h1>
      <p className="mt-2 text-muted">Ask an owner or admin of this organization if you think you should.</p>
      <Link href="/orgs" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
        Back to your organizations
      </Link>
    </div>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold">We couldn’t find that</h1>
      <p className="mt-2 text-muted">It may have been removed, or you may not have access to it.</p>
      <Link href="/orgs" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
        Back to your organizations
      </Link>
    </div>
  );
}

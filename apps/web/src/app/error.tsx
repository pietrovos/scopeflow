'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // reset() alone re-renders with the same failed server data; refresh refetches it.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-sm font-semibold text-danger">Error</p>
      <h1 className="mt-2 text-2xl font-semibold">We couldn’t load this page</h1>
      <p className="mt-2 text-muted">
        The server may be busy or unreachable. Nothing you saved was lost.{' '}
        {error.digest && <span className="font-mono text-xs">Reference: {error.digest}</span>}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={retry}>Try again</Button>
        <Link href="/" className="inline-flex h-10 items-center px-4 text-sm font-medium text-accent hover:underline">
          Go home
        </Link>
      </div>
    </main>
  );
}

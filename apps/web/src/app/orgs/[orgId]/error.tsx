'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/states';

export default function OrgError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // reset() alone re-renders with the same failed server data; refresh refetches it.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorNotice
        title="This page couldn’t load"
        action={
          <Button variant="secondary" size="sm" onClick={retry}>
            Try again
          </Button>
        }
      >
        The server didn’t respond or returned an error. Nothing you saved was lost.
        {error.digest && <span className="mt-1 block font-mono text-xs">Reference: {error.digest}</span>}
      </ErrorNotice>
    </div>
  );
}

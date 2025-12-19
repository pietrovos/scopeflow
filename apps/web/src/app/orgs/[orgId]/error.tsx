'use client';

import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/states';

export default function OrgError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorNotice
        title="This page couldn’t load"
        action={
          <Button variant="secondary" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      >
        {error.digest ? `Reference: ${error.digest}` : 'The server returned an error. Your data is safe.'}
      </ErrorNotice>
    </div>
  );
}

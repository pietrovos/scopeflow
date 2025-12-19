import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

export function EmptyState({ title, description, action, icon, className }: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 text-muted" aria-hidden="true">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ title = 'Something went wrong', children, action }: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
      <p className="font-medium text-danger">{title}</p>
      {children && <div className="mt-1 text-text">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted">
      <Spinner label={label} />
      <span aria-hidden="true" className="text-sm">{label}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-2', className)} />;
}

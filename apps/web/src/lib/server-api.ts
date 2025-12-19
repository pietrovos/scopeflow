import 'server-only';
import { forbidden, notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ApiError, type ApiErrorBody } from './api-error';

const baseUrl = () => process.env.API_INTERNAL_URL ?? 'http://localhost:4100';

export async function getAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken || session.error) redirect('/?signin=required');
  return session.accessToken;
}

/**
 * Fetches from the API inside a server component. 401 sends the user to sign in,
 * 404 and 403 render the nearest not-found / forbidden page; anything else throws to
 * the error boundary.
 */
export async function serverApi<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/?signin=expired');
  if (res.status === 404) notFound();
  if (res.status === 403) forbidden();
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))) as ApiErrorBody);
  return (await res.json()) as T;
}

/** URL the browser should use for the API; read at runtime so images need no rebuild. */
export const publicApiUrl = () => process.env.PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

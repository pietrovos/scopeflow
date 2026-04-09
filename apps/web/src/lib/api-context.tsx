'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { ApiError, type ApiErrorBody } from './api-error';

interface ApiConfig {
  baseUrl: string;
  /** Mutable so a refreshed token is shared by every caller without re-rendering. */
  token: RefObject<string>;
}

const ApiContext = createContext<ApiConfig | null>(null);

export function ApiProvider({ baseUrl, token, children }: { baseUrl: string; token: string; children: ReactNode }) {
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  const value = useMemo(() => ({ baseUrl, token: tokenRef }), [baseUrl]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApiConfig() {
  const config = useContext(ApiContext);
  if (!config) throw new Error('useApi() must be used inside <ApiProvider>');
  return config;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Fetches a fresh access token through Auth.js (which refreshes it with Keycloak). */
async function refreshedToken(): Promise<string | null> {
  const res = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!res.ok) return null;
  const session = (await res.json()) as { accessToken?: string; error?: string } | null;
  return session?.accessToken && !session.error ? session.accessToken : null;
}

/**
 * Browser-side API client. Sends the bearer token straight to the NestJS API; on a 401
 * it refreshes the token once and retries, then gives up and asks the user to sign in.
 */
export function useApi() {
  const { baseUrl, token: tokenRef } = useApiConfig();
  const router = useRouter();

  return useMemo(() => {
    const request = async <T,>(method: Method, path: string, body?: unknown, retried = false): Promise<T> => {
      const res = await fetch(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(15_000),
        method,
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401 && !retried) {
        const fresh = await refreshedToken();
        if (fresh) {
          tokenRef.current = fresh;
          return request<T>(method, path, body, true);
        }
        router.push('/?signin=expired');
      }
      if (!res.ok) {
        throw new ApiError(res.status, (await res.json().catch(() => ({}))) as ApiErrorBody);
      }
      return (res.status === 204 ? undefined : await res.json()) as T;
    };
    return {
      get: <T,>(path: string) => request<T>('GET', path),
      post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
      patch: <T,>(path: string, body: unknown) => request<T>('PATCH', path, body),
      del: <T = void,>(path: string) => request<T>('DELETE', path),
      token: () => tokenRef.current,
    };
  }, [baseUrl, tokenRef, router]);
}

export type Api = ReturnType<typeof useApi>;

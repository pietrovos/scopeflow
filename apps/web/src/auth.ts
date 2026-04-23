import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Keycloak from 'next-auth/providers/keycloak';

/**
 * Auth.js is only the OIDC client here. Keycloak authenticates the user; the NestJS
 * API verifies the access token on every request and decides what the user may do.
 *
 * Browsers reach Keycloak at OIDC_ISSUER, but inside Docker this server reaches it at
 * OIDC_INTERNAL_URL. Giving explicit endpoints (instead of discovery) lets the two
 * differ while tokens still carry the public issuer.
 */
// Read at request time, not import time: Docker images are built without these set.
const issuer = () => process.env.OIDC_ISSUER!;
const internal = () => (process.env.OIDC_INTERNAL_URL || issuer()).replace(/\/$/, '');
const oidc = (base: string, path: string) => `${base}/protocol/openid-connect/${path}`;

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    error?: 'RefreshTokenError';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt: number;
    error?: 'RefreshTokenError';
  }
}

async function refresh(token: JWT): Promise<JWT> {
  if (!token.refreshToken) return { ...token, error: 'RefreshTokenError' };
  try {
    const res = await fetch(oidc(internal(), 'token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: process.env.AUTH_KEYCLOAK_ID!,
        client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
      }),
    });
    const body = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      id_token?: string;
    };
    if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
    return {
      ...token,
      accessToken: body.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + body.expires_in,
      refreshToken: body.refresh_token ?? token.refreshToken,
      idToken: body.id_token ?? token.idToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshTokenError' };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: [
    Keycloak({
      issuer: issuer(),
      authorization: { url: oidc(issuer(), 'auth'), params: { scope: 'openid email profile' } },
      token: oidc(internal(), 'token'),
      userinfo: oidc(internal(), 'userinfo'),
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/', error: '/' },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token!,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          expiresAt: account.expires_at ?? Math.floor(Date.now() / 1000) + 300,
        };
      }
      // Refresh a minute before expiry to leave time for the API request.
      if (Date.now() / 1000 < token.expiresAt - 60) return token;
      return refresh(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
}));

export const keycloakEndSessionUrl = () => oidc(issuer(), 'logout');

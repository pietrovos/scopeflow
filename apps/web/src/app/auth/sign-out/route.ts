import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { keycloakEndSessionUrl, signOut } from '@/auth';

/**
 * Ends both sessions: the Auth.js cookie here and the Keycloak SSO session, so the
 * next sign-in asks for credentials again (important when switching demo accounts).
 */
export async function POST(req: NextRequest) {
  const secureCookie = req.nextUrl.protocol === 'https:';
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie });
  await signOut({ redirect: false });

  const url = new URL(keycloakEndSessionUrl());
  url.searchParams.set('post_logout_redirect_uri', `${process.env.AUTH_URL ?? req.nextUrl.origin}/`);
  url.searchParams.set('client_id', process.env.AUTH_KEYCLOAK_ID!);
  if (token?.idToken) url.searchParams.set('id_token_hint', token.idToken);
  return NextResponse.redirect(url, 303);
}

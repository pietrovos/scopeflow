import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ENV, type Env } from '../config/env.js';

export const JWKS = Symbol('JWKS');

export interface TokenClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  /** Token expiry, ms since epoch. */
  expiresAt: number;
}

export function remoteJwks(env: Env): JWTVerifyGetKey {
  // Servers may reach the issuer at a different address than browsers do (Docker).
  const base = (env.OIDC_INTERNAL_URL ?? env.OIDC_ISSUER).replace(/\/$/, '');
  return createRemoteJWKSet(new URL(`${base}/protocol/openid-connect/certs`), {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
  });
}

/** Verifies Keycloak access tokens: signature (JWKS), issuer, audience, expiry. */
@Injectable()
export class JwtVerifier {
  constructor(
    @Inject(JWKS) private readonly jwks: JWTVerifyGetKey,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async verify(token: string): Promise<TokenClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.env.OIDC_ISSUER,
      audience: this.env.OIDC_AUDIENCE,
      algorithms: ['RS256', 'ES256'],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new Error('token is missing sub or email');
    }
    const name =
      (typeof payload.name === 'string' && payload.name.trim()) ||
      (typeof payload.preferred_username === 'string' && payload.preferred_username) ||
      payload.email;
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name,
      expiresAt: (payload.exp ?? Math.floor(Date.now() / 1000) + 300) * 1000,
    };
  }
}

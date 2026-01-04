import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';

/**
 * Stands in for Keycloak: a local RSA key whose public half is served as the JWKS,
 * so tests go through the real verifier (signature, issuer, audience, expiry).
 */
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
export const testJwks: JWTVerifyGetKey = createLocalJWKSet({ keys: [jwk] });

export interface TestIdentity {
  sub: string;
  email: string;
  name: string;
}

export function identity(
  name: string,
  email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
): TestIdentity {
  return { sub: randomUUID(), email, name };
}

export async function tokenFor(
  who: TestIdentity,
  overrides: { issuer?: string; audience?: string; expiresIn?: string; emailVerified?: boolean; key?: CryptoKey } = {},
) {
  return new SignJWT({ email: who.email, name: who.name, email_verified: overrides.emailVerified ?? true })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(who.sub)
    .setIssuer(overrides.issuer ?? process.env.OIDC_ISSUER!)
    .setAudience(overrides.audience ?? process.env.OIDC_AUDIENCE!)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '5m')
    .sign(overrides.key ?? privateKey);
}

import { Injectable } from '@nestjs/common';
import { SystemPrismaService } from '../db/prisma.service.js';
import type { TokenClaims } from './jwt-verifier.service.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Maps a token subject to a ScopeFlow user. System path (see db/README.md): a user
 * seeded or invited by email is linked to their Keycloak account on first sign-in,
 * but only when Keycloak says the email is verified.
 */
@Injectable()
export class UsersService {
  constructor(private readonly db: SystemPrismaService) {}

  async resolve(claims: TokenClaims): Promise<AuthUser> {
    const select = { id: true, email: true, name: true } as const;
    const linked = await this.db.user.findUnique({ where: { externalId: claims.sub }, select });
    if (linked) return linked;

    if (claims.emailVerified) {
      const byEmail = await this.db.user.findUnique({ where: { email: claims.email } });
      if (byEmail && !byEmail.externalId) {
        return this.db.user.update({ where: { id: byEmail.id }, data: { externalId: claims.sub }, select });
      }
    }

    return this.db.user.upsert({
      where: { externalId: claims.sub },
      update: {},
      create: { externalId: claims.sub, email: claims.email, name: claims.name },
      select,
    });
  }
}

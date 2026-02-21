import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@scopeflow/shared';
import { SystemPrismaService } from '../db/prisma.service.js';
import { ROLES_KEY } from './roles.decorator.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Global guard for every route with an :orgId parameter. Looks up the caller's
 * membership (system path: no tenant context exists yet) and attaches the tenant
 * context that TenantDb hands to Postgres. Non-members get 404, not 403, so org IDs
 * cannot be probed.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: SystemPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket handlers authenticate in the gateway's handshake middleware instead.
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    const orgId = req.params?.orgId;
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (typeof orgId !== 'string') {
      if (required) throw new Error('@Roles() requires an :orgId route parameter');
      return true;
    }
    if (!req.user) return false;
    if (!UUID.test(orgId)) throw new NotFoundException('Organization not found');

    const membership = await this.db.membership.findUnique({
      where: { orgId_userId: { orgId, userId: req.user.id } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('Organization not found');

    req.tenant = { orgId, userId: req.user.id, role: membership.role };

    if (required && !required.includes(membership.role)) {
      throw new ForbiddenException('Your role does not allow this action');
    }
    return true;
  }
}

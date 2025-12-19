import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  createInvitationSchema,
  createOrganizationSchema,
  updateMembershipSchema,
  type CreateOrganizationInput,
} from '@scopeflow/shared';
import type { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import type { AuthUser } from '../auth/users.service.js';
import { UuidPipe } from '../common/uuid.pipe.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ManagersOnly, StaffOnly } from '../tenancy/roles.decorator.js';
import { Tenant } from '../tenancy/tenant.decorator.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { InvitationsService } from './invitations.service.js';
import { MembersService } from './members.service.js';
import { OrganizationsService } from './organizations.service.js';

@Controller()
export class OrganizationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly members: MembersService,
    private readonly invitations: InvitationsService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { user, organizations: await this.orgs.listForUser(user) };
  }

  @Post('orgs')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createOrganizationSchema)) body: CreateOrganizationInput) {
    return this.orgs.create(user, body);
  }

  @Get('orgs/:orgId')
  get(@Tenant() t: TenantContext) {
    return this.orgs.get(t);
  }

  @ManagersOnly()
  @Patch('orgs/:orgId')
  rename(@Tenant() t: TenantContext, @Body(new ZodPipe(createOrganizationSchema)) body: CreateOrganizationInput) {
    return this.orgs.rename(t, body.name);
  }

  @StaffOnly()
  @Get('orgs/:orgId/members')
  listMembers(@Tenant() t: TenantContext) {
    return this.members.list(t);
  }

  @ManagersOnly()
  @Patch('orgs/:orgId/members/:membershipId')
  changeRole(
    @Tenant() t: TenantContext,
    @Param('membershipId', UuidPipe) membershipId: string,
    @Body(new ZodPipe(updateMembershipSchema)) body: z.output<typeof updateMembershipSchema>,
  ) {
    return this.members.changeRole(t, membershipId, body.role);
  }

  @ManagersOnly()
  @Delete('orgs/:orgId/members/:membershipId')
  @HttpCode(204)
  async removeMember(@Tenant() t: TenantContext, @Param('membershipId', UuidPipe) membershipId: string) {
    await this.members.remove(t, membershipId);
  }

  @ManagersOnly()
  @Get('orgs/:orgId/invitations')
  listInvitations(@Tenant() t: TenantContext) {
    return this.invitations.listPending(t);
  }

  @ManagersOnly()
  @Post('orgs/:orgId/invitations')
  invite(
    @Tenant() t: TenantContext,
    @Body(new ZodPipe(createInvitationSchema)) body: z.output<typeof createInvitationSchema>,
  ) {
    return this.invitations.create(t, body);
  }

  @ManagersOnly()
  @Delete('orgs/:orgId/invitations/:invitationId')
  @HttpCode(204)
  async revoke(@Tenant() t: TenantContext, @Param('invitationId', UuidPipe) invitationId: string) {
    await this.invitations.revoke(t, invitationId);
  }

  @Public()
  @Get('invitations/:token')
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post('invitations/:token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.invitations.accept(token, user);
  }
}

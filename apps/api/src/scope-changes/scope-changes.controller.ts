import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  createScopeChangeSchema,
  decideScopeChangeSchema,
  reviseScopeChangeSchema,
  withdrawScopeChangeSchema,
  type ReviseScopeChangeInput,
  type ScopeChangeContent,
} from '@scopeflow/shared';
import { z } from 'zod';
import { UuidPipe } from '../common/uuid.pipe.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { Roles, StaffOnly } from '../tenancy/roles.decorator.js';
import { Tenant } from '../tenancy/tenant.decorator.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { ScopeChangesService } from './scope-changes.service.js';

const inboxQuery = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN']).optional() });

@Controller('orgs/:orgId')
export class ScopeChangesController {
  constructor(private readonly scopeChanges: ScopeChangesService) {}

  @Get('scope-changes')
  inbox(@Tenant() t: TenantContext, @Query(new ZodPipe(inboxQuery)) q: z.infer<typeof inboxQuery>) {
    return this.scopeChanges.inbox(t, q.status);
  }

  @Get('projects/:projectId/scope-changes')
  list(@Tenant() t: TenantContext, @Param('projectId', UuidPipe) projectId: string) {
    return this.scopeChanges.listForProject(t, projectId);
  }

  @StaffOnly()
  @Post('projects/:projectId/scope-changes')
  create(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Body(new ZodPipe(createScopeChangeSchema)) body: ScopeChangeContent,
  ) {
    return this.scopeChanges.create(t, projectId, body);
  }

  @Get('projects/:projectId/scope-changes/:scopeChangeId')
  get(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Param('scopeChangeId', UuidPipe) scopeChangeId: string,
  ) {
    return this.scopeChanges.get(t, projectId, scopeChangeId);
  }

  @StaffOnly()
  @Post('projects/:projectId/scope-changes/:scopeChangeId/revisions')
  revise(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Param('scopeChangeId', UuidPipe) scopeChangeId: string,
    @Body(new ZodPipe(reviseScopeChangeSchema)) body: ReviseScopeChangeInput,
  ) {
    return this.scopeChanges.revise(t, projectId, scopeChangeId, body);
  }

  /** Only the client signs off. Staff cannot approve on a client's behalf. */
  @Roles('CLIENT')
  @Post('projects/:projectId/scope-changes/:scopeChangeId/decision')
  decide(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Param('scopeChangeId', UuidPipe) scopeChangeId: string,
    @Body(new ZodPipe(decideScopeChangeSchema)) body: z.output<typeof decideScopeChangeSchema>,
  ) {
    return this.scopeChanges.decide(t, projectId, scopeChangeId, body);
  }

  @StaffOnly()
  @Post('projects/:projectId/scope-changes/:scopeChangeId/withdraw')
  withdraw(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Param('scopeChangeId', UuidPipe) scopeChangeId: string,
    @Body(new ZodPipe(withdrawScopeChangeSchema)) body: z.infer<typeof withdrawScopeChangeSchema>,
  ) {
    return this.scopeChanges.withdraw(t, projectId, scopeChangeId, body.version);
  }
}

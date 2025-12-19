import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { createMilestoneSchema, updateMilestoneSchema } from '@scopeflow/shared';
import type { z } from 'zod';
import { UuidPipe } from '../common/uuid.pipe.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { StaffOnly } from '../tenancy/roles.decorator.js';
import { Tenant } from '../tenancy/tenant.decorator.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { MilestonesService } from './milestones.service.js';

@Controller('orgs/:orgId/projects/:projectId/milestones')
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get()
  list(@Tenant() t: TenantContext, @Param('projectId', UuidPipe) projectId: string) {
    return this.milestones.list(t, projectId);
  }

  @StaffOnly()
  @Post()
  create(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Body(new ZodPipe(createMilestoneSchema)) body: z.output<typeof createMilestoneSchema>,
  ) {
    return this.milestones.create(t, projectId, body);
  }

  @StaffOnly()
  @Patch(':milestoneId')
  update(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Param('milestoneId', UuidPipe) milestoneId: string,
    @Body(new ZodPipe(updateMilestoneSchema)) body: z.output<typeof updateMilestoneSchema>,
  ) {
    return this.milestones.update(t, projectId, milestoneId, body);
  }

  @StaffOnly()
  @Delete(':milestoneId')
  @HttpCode(204)
  async remove(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Param('milestoneId', UuidPipe) milestoneId: string,
  ) {
    await this.milestones.remove(t, projectId, milestoneId);
  }
}

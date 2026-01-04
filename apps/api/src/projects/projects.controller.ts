import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { assignProjectSchema, createProjectSchema, updateProjectSchema } from '@scopeflow/shared';
import type { z } from 'zod';
import { UuidPipe } from '../common/uuid.pipe.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ManagersOnly, StaffOnly } from '../tenancy/roles.decorator.js';
import { Tenant } from '../tenancy/tenant.decorator.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { ProjectsService } from './projects.service.js';

@Controller('orgs/:orgId/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Tenant() t: TenantContext) {
    return this.projects.list(t);
  }

  @StaffOnly()
  @Post()
  create(
    @Tenant() t: TenantContext,
    @Body(new ZodPipe(createProjectSchema)) body: z.output<typeof createProjectSchema>,
  ) {
    return this.projects.create(t, body);
  }

  @Get(':projectId')
  get(@Tenant() t: TenantContext, @Param('projectId', UuidPipe) projectId: string) {
    return this.projects.get(t, projectId);
  }

  @StaffOnly()
  @Patch(':projectId')
  update(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Body(new ZodPipe(updateProjectSchema)) body: z.output<typeof updateProjectSchema>,
  ) {
    return this.projects.update(t, projectId, body);
  }

  @StaffOnly()
  @Get(':projectId/clients')
  clients(@Tenant() t: TenantContext, @Param('projectId', UuidPipe) projectId: string) {
    return this.projects.listClients(t, projectId);
  }

  @ManagersOnly()
  @Post(':projectId/clients')
  @HttpCode(204)
  async assign(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Body(new ZodPipe(assignProjectSchema)) body: z.output<typeof assignProjectSchema>,
  ) {
    await this.projects.assignClient(t, projectId, body.userId);
  }

  @ManagersOnly()
  @Delete(':projectId/clients/:userId')
  @HttpCode(204)
  async unassign(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Param('userId', UuidPipe) userId: string,
  ) {
    await this.projects.unassignClient(t, projectId, userId);
  }
}

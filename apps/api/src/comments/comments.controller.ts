import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { createCommentSchema } from '@scopeflow/shared';
import { z } from 'zod';
import { UuidPipe } from '../common/uuid.pipe.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { Tenant } from '../tenancy/tenant.decorator.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { CommentsService } from './comments.service.js';

const listQuery = z.object({ scopeChangeId: z.uuid().optional() });

@Controller('orgs/:orgId/projects/:projectId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>,
  ) {
    return this.comments.list(t, projectId, q.scopeChangeId);
  }

  @Post()
  create(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Body(new ZodPipe(createCommentSchema)) body: z.output<typeof createCommentSchema>,
  ) {
    return this.comments.create(t, projectId, body);
  }
}

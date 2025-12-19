import { Injectable } from '@nestjs/common';
import type { ActivityEventDto, ActivityType } from '@scopeflow/shared';
import { TenantDb, type DbContext, type Tx } from '../db/tenant-db.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ActivityBus } from './activity.bus.js';

export interface RecordActivity {
  type: ActivityType;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  data?: Record<string, unknown>;
}

const include = { actor: { select: { id: true, name: true } } } as const;
type Row = Prisma.ActivityEventGetPayload<{ include: typeof include }>;

export function toActivityDto(row: Row): ActivityEventDto {
  return {
    seq: row.seq.toString(),
    orgId: row.orgId,
    projectId: row.projectId,
    type: row.type as ActivityType,
    entityType: row.entityType,
    entityId: row.entityId,
    data: (row.data ?? {}) as Record<string, unknown>,
    actor: row.actor,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Writes the audit log / activity feed and publishes each event after commit. */
@Injectable()
export class ActivityService {
  constructor(private readonly bus: ActivityBus) {}

  async record(tx: Tx, ctx: DbContext & { orgId: string }, input: RecordActivity): Promise<ActivityEventDto> {
    const row = await tx.activityEvent.create({
      data: {
        orgId: ctx.orgId,
        actorId: ctx.userId,
        projectId: input.projectId ?? null,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      },
      include,
    });
    const dto = toActivityDto(row);
    TenantDb.afterCommit(() => this.bus.publish(dto));
    return dto;
  }

  /** For system paths that write outside TenantDb (invitation acceptance, webhooks). */
  publishCommitted(rows: Row[]) {
    for (const row of rows) this.bus.publish(toActivityDto(row));
  }

  static readonly include = include;
}

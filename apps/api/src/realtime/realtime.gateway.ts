import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { WS, type ActivityEventDto } from '@scopeflow/shared';
import { z } from 'zod';
import { JwtVerifier } from '../auth/jwt-verifier.service.js';
import { UsersService, type AuthUser } from '../auth/users.service.js';
import { SystemPrismaService } from '../db/prisma.service.js';
import { TenantDb } from '../db/tenant-db.service.js';
import { ActivityBus } from '../activity/activity.bus.js';

const joinSchema = z.object({ orgId: z.uuid(), projectId: z.uuid() });

const projectRoom = (orgId: string, projectId: string) => `org:${orgId}:project:${projectId}`;
const orgRoom = (orgId: string) => `org:${orgId}`;

/** Events after which someone may have lost access to a project they are watching. */
const ACCESS_EVENTS = new Set(['member.removed', 'member.role_changed', 'project.client_unassigned']);

interface SocketData {
  user: AuthUser;
  expiresAt: number;
}
type AppSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

/**
 * Real-time push. Writes still go through REST; this gateway only fans out committed
 * activity events to sockets in `org:<id>:project:<id>` rooms.
 *
 * - Handshake: same JWT verification as REST (`auth.token`).
 * - Join: the same membership + RLS visibility check as GET /projects/:id.
 * - Expiry: the socket is closed when its token expires; the client reconnects with a
 *   fresh token and resyncs from the REST cursor.
 * - Revocation: after membership/assignment changes, every socket in that org is
 *   re-checked and removed from rooms it may no longer see.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) =>
      cb(null, !origin || origin === (process.env.WEB_URL ?? 'http://localhost:3100')),
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);
  private unsubscribe?: () => void;

  @WebSocketServer() private ns!: Namespace;

  constructor(
    private readonly verifier: JwtVerifier,
    private readonly users: UsersService,
    private readonly system: SystemPrismaService,
    private readonly db: TenantDb,
    private readonly bus: ActivityBus,
  ) {}

  afterInit(ns: Namespace) {
    ns.use((socket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string') return next(new Error('unauthorized'));
      this.verifier
        .verify(token)
        .then(async (claims) => {
          (socket as AppSocket).data.user = await this.users.resolve(claims);
          (socket as AppSocket).data.expiresAt = claims.expiresAt;
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    });
    this.unsubscribe = this.bus.subscribe((event) => void this.fanOut(event));
  }

  handleConnection(socket: AppSocket) {
    const timer = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expiresAt - Date.now()));
    socket.on('disconnect', () => clearTimeout(timer));
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  @SubscribeMessage(WS.joinProject)
  async join(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown) {
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    const { orgId, projectId } = parsed.data;
    if (!(await this.canSee(socket.data.user.id, orgId, projectId))) return { ok: false, error: 'not_found' };
    await socket.join([orgRoom(orgId), projectRoom(orgId, projectId)]);
    return { ok: true };
  }

  @SubscribeMessage(WS.leaveProject)
  async leave(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown) {
    const parsed = joinSchema.safeParse(body);
    if (parsed.success) await socket.leave(projectRoom(parsed.data.orgId, parsed.data.projectId));
    return { ok: true };
  }

  private async fanOut(event: ActivityEventDto) {
    if (event.projectId) this.ns.to(projectRoom(event.orgId, event.projectId)).emit(WS.activity, event);
    if (ACCESS_EVENTS.has(event.type)) await this.revalidate(event.orgId);
  }

  /** Drop sockets from project rooms their user can no longer see. */
  private async revalidate(orgId: string) {
    const sockets = await this.ns.in(orgRoom(orgId)).fetchSockets();
    const prefix = `${orgRoom(orgId)}:project:`;
    for (const socket of sockets) {
      for (const room of socket.rooms) {
        if (!room.startsWith(prefix)) continue;
        const projectId = room.slice(prefix.length);
        const userId = (socket.data as SocketData).user.id;
        if (!(await this.canSee(userId, orgId, projectId))) {
          socket.leave(room);
          socket.emit(WS.accessRevoked, { orgId, projectId });
          this.logger.log(`revoked ${userId} from ${room}`);
        }
      }
    }
  }

  /** Membership lookup (system path), then project visibility under RLS. */
  private async canSee(userId: string, orgId: string, projectId: string): Promise<boolean> {
    const membership = await this.system.membership.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { role: true },
    });
    if (!membership) return false;
    const project = await this.db.run({ orgId, userId, role: membership.role }, (tx) =>
      tx.project.findUnique({ where: { id: projectId }, select: { id: true } }),
    );
    return project !== null;
  }
}

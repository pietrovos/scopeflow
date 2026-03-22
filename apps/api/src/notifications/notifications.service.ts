import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { formatCents, formatDayDelta, ROLE_LABELS, type Role } from '@scopeflow/shared';
import { ENV, type Env } from '../config/env.js';
import { SystemPrismaService } from '../db/prisma.service.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import type { InvitationCreatedEvent } from '../organizations/invitations.service.js';
import { ScopeChangeEvents } from '../scope-changes/scope-change.events.js';
import type { ScopeChangeDetail } from '../scope-changes/scope-changes.service.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { render } from './templates.js';

/**
 * Turns domain events into email. Runs after the transaction commits, and a delivery
 * failure is logged rather than failing the user's request.
 *
 * Recipient lookups use the system client (db/README.md, path 6): a client approving
 * a change must be able to notify agency staff they cannot see under RLS. Every query
 * is filtered by the event's org explicitly.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
    private readonly system: SystemPrismaService,
    private readonly scopeEvents: ScopeChangeEvents,
  ) {}

  onModuleInit() {
    this.scopeEvents.onSubmitted((t, sc, projectName, n) => this.scopeChangeSubmitted(t, sc, projectName, n));
    this.scopeEvents.onDecided((t, sc) => this.scopeChangeDecided(t, sc));
  }

  async invitationCreated(e: InvitationCreatedEvent) {
    await this.send(
      render({
        to: e.email,
        subject: `${e.inviterName} invited you to ${e.orgName} on ScopeFlow`,
        heading: `Join ${e.orgName}`,
        lines: [
          `${e.inviterName} invited you to ${e.orgName} as ${ROLE_LABELS[e.role as Role].toLowerCase()}.`,
          'The link works once and expires in 7 days.',
        ],
        action: { label: 'Accept invitation', url: e.url },
        footer: 'If you were not expecting this, you can ignore this email.',
      }),
    );
  }

  /** New proposal or new revision: tell the clients assigned to the project. */
  private async scopeChangeSubmitted(
    t: TenantContext,
    sc: ScopeChangeDetail,
    projectName: string,
    revisionNumber: number,
  ) {
    const rev = sc.revisions.find((r) => r.revisionNumber === revisionNumber)!;
    const clients = await this.system.projectAssignment.findMany({
      where: {
        orgId: t.orgId,
        projectId: sc.projectId,
        user: { memberships: { some: { orgId: t.orgId, role: 'CLIENT' } } },
      },
      select: { user: { select: { email: true, name: true } } },
    });
    const url = `${this.env.WEB_URL}/orgs/${t.orgId}/projects/${sc.projectId}/scope-changes/${sc.id}`;
    await Promise.all(
      clients.map(({ user }) =>
        this.send(
          render({
            to: user.email,
            subject:
              revisionNumber === 1
                ? `Approval needed: SC-${sc.number} ${rev.title}`
                : `Updated proposal: SC-${sc.number} revision ${revisionNumber}`,
            heading:
              revisionNumber === 1 ? 'A scope change needs your approval' : `Revision ${revisionNumber} is ready`,
            lines: [
              `${projectName}: ${rev.title}`,
              `Price impact: ${formatCents(rev.priceDeltaCents, { signed: true })}. Schedule impact: ${formatDayDelta(rev.deadlineDeltaDays)}.`,
              `Proposed by ${rev.createdBy.name}.`,
            ],
            action: { label: `Review revision ${revisionNumber}`, url },
          }),
        ),
      ),
    );
  }

  /** Client decided: tell the owner, admins and whoever proposed it. */
  private async scopeChangeDecided(t: TenantContext, sc: ScopeChangeDetail) {
    const decision = sc.decisions.at(-1);
    if (!decision) return;
    const rev = sc.revisions.find((r) => r.id === decision.revisionId)!;
    const staff = await this.system.membership.findMany({
      where: { orgId: t.orgId, OR: [{ role: { in: ['OWNER', 'ADMIN'] } }, { userId: sc.createdBy.id }] },
      select: { user: { select: { email: true } } },
    });
    const verb = decision.decision === 'APPROVED' ? 'approved' : 'rejected';
    const url = `${this.env.WEB_URL}/orgs/${t.orgId}/projects/${sc.projectId}/scope-changes/${sc.id}`;
    await Promise.all(
      staff.map(({ user }) =>
        this.send(
          render({
            to: user.email,
            subject: `${decision.decidedBy.name} ${verb} SC-${sc.number} (revision ${rev.revisionNumber})`,
            heading: `Scope change ${verb}`,
            lines: [
              `${decision.decidedBy.name} ${verb} revision ${rev.revisionNumber} of “${rev.title}” on ${sc.project.name}.`,
              `Price impact: ${formatCents(rev.priceDeltaCents, { signed: true })}. Schedule impact: ${formatDayDelta(rev.deadlineDeltaDays)}.`,
              ...(decision.note ? [`Note: “${decision.note}”`] : []),
            ],
            action: { label: 'Open scope change', url },
          }),
        ),
      ),
    );
  }

  private async send(message: Parameters<Mailer['send']>[0]) {
    try {
      await this.mailer.send(message);
    } catch (err) {
      // Email is best effort; the action itself already succeeded.
      this.logger.error(`could not send "${message.subject}" to ${message.to}`, err as Error);
    }
  }
}

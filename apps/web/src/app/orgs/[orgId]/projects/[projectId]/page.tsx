import Link from 'next/link';
import { formatCents, isManager } from '@scopeflow/shared';
import { serverApi } from '@/lib/server-api';
import type { ActivityEventDto, Member, ProjectDetail, ScopeChangeSummary } from '@/lib/types';
import type { CommentDto } from '@scopeflow/shared';
import { ProjectLive } from '@/lib/realtime';
import { Discussion } from '@/components/live/discussion';
import { ActivityFeed } from '@/components/live/activity-feed';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ProjectStatusBadge } from '@/components/status';
import { MilestoneList } from '@/components/projects/milestone-list';
import { ClientsPanel } from '@/components/projects/clients-panel';
import { ProjectStatusControl } from '@/components/projects/project-status-control';
import { MilestoneTimeline } from '@/components/portal/milestone-timeline';
import { ProjectSummary } from '@/components/portal/project-summary';
import { CardHeader } from '@/components/ui/card';
import { ScopeChangeList } from '@/components/scope/scope-change-list';
import { formatDayDelta } from '@scopeflow/shared';

export async function generateMetadata({ params }: PageProps<'/orgs/[orgId]/projects/[projectId]'>) {
  const { orgId, projectId } = await params;
  const project = await serverApi<ProjectDetail>(`/orgs/${orgId}/projects/${projectId}`);
  return { title: project.name };
}

export default async function ProjectPage({ params }: PageProps<'/orgs/[orgId]/projects/[projectId]'>) {
  const { orgId, projectId } = await params;
  const [project, scopeChanges, activity, comments] = await Promise.all([
    serverApi<ProjectDetail>(`/orgs/${orgId}/projects/${projectId}`),
    serverApi<ScopeChangeSummary[]>(`/orgs/${orgId}/projects/${projectId}/scope-changes`),
    serverApi<{ items: ActivityEventDto[] }>(`/orgs/${orgId}/projects/${projectId}/activity?limit=30`),
    serverApi<CommentDto[]>(`/orgs/${orgId}/projects/${projectId}/comments`),
  ]);
  const discussion = <Discussion orgId={orgId} projectId={projectId} />;
  const manager = isManager(project.viewerRole);
  const members = project.canEdit ? await serverApi<Member[]>(`/orgs/${orgId}/members`) : [];
  const totalMilestones = project.milestones.reduce((sum, m) => sum + m.amountCents, 0);

  return (
    <ProjectLive orgId={orgId} projectId={projectId} initialEvents={activity.items} initialComments={comments}>
      <PageHeader
        eyebrow={
          <Link href={`/orgs/${orgId}/projects`} className="hover:text-text">
            ← Projects
          </Link>
        }
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {project.clientName}
            {!project.canEdit && <ProjectStatusBadge status={project.status} />}
          </span>
        }
        actions={
          project.canEdit ? (
            <ProjectStatusControl orgId={orgId} projectId={projectId} status={project.status} />
          ) : undefined
        }
      />

      {!project.canEdit ? (
        <div className="space-y-6">
          <ProjectSummary project={project} />

          <div className={project.description ? 'grid gap-6 xl:grid-cols-[1fr_20rem]' : undefined}>
            <Card>
              <CardHeader title="Timeline" description="Where the project stands, milestone by milestone." />
              <MilestoneTimeline milestones={project.milestones} />
            </Card>
            {project.description && (
              <Card className="h-fit p-5">
                <h2 className="text-base font-semibold">About this project</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-muted">{project.description}</p>
              </Card>
            )}
          </div>
          <ScopeChangeList orgId={orgId} projectId={projectId} items={scopeChanges} canPropose={false} />
          <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
            {discussion}
            <ActivityFeed />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-6">
            <MilestoneList
              orgId={orgId}
              projectId={projectId}
              milestones={project.milestones}
              canEdit={project.canEdit}
            />
            <ScopeChangeList orgId={orgId} projectId={projectId} items={scopeChanges} canPropose />
            {discussion}
          </div>

          <aside className="space-y-6">
            <Card className="p-4 sm:p-5">
              <h2 className="text-base font-semibold">Details</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted">Budget</dt>
                <dd className="text-right font-medium">{formatCents(project.budgetCents)}</dd>
                <dt className="text-muted">Approved changes</dt>
                <dd className="text-right font-medium">
                  {formatCents(project.scope.approvedPriceDeltaCents, { signed: true })}
                </dd>
                <dt className="text-muted">Current total</dt>
                <dd className="text-right font-semibold">
                  {formatCents(project.budgetCents + project.scope.approvedPriceDeltaCents)}
                </dd>
                <dt className="text-muted">Schedule change</dt>
                <dd className="text-right font-medium">{formatDayDelta(project.scope.approvedDeadlineDeltaDays)}</dd>
                <dt className="text-muted">Milestones total</dt>
                <dd className="text-right font-medium">{formatCents(totalMilestones)}</dd>
                <dt className="text-muted">Due</dt>
                <dd className="text-right font-medium">{formatDate(project.dueDate)}</dd>
              </dl>
              {project.description && (
                <p className="mt-4 whitespace-pre-line text-sm text-muted">{project.description}</p>
              )}
            </Card>
            {project.canEdit && (
              <ClientsPanel
                orgId={orgId}
                projectId={projectId}
                clients={project.clients}
                clientMembers={members.filter((m) => m.role === 'CLIENT')}
                canManage={manager}
              />
            )}
            <ActivityFeed />
          </aside>
        </div>
      )}
    </ProjectLive>
  );
}

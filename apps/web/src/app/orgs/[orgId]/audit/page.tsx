import { forbidden } from 'next/navigation';
import { isStaff } from '@scopeflow/shared';
import { serverApi } from '@/lib/server-api';
import type { ActivityEventDto, OrgSummary, ProjectListItem } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { AuditLog } from '@/components/activity/audit-log';

export const metadata = { title: 'Audit log' };

export default async function AuditPage({ params }: PageProps<'/orgs/[orgId]/audit'>) {
  const { orgId } = await params;
  const org = await serverApi<OrgSummary>(`/orgs/${orgId}`);
  if (!isStaff(org.role)) forbidden();
  const [log, projects] = await Promise.all([
    serverApi<{ items: ActivityEventDto[]; nextBefore: string | null }>(`/orgs/${orgId}/activity?limit=50`),
    serverApi<ProjectListItem[]>(`/orgs/${orgId}/projects`),
  ]);
  const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change in this organization, in order. Entries are append-only and cannot be edited."
      />
      <Card>
        {log.items.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <AuditLog orgId={orgId} initial={log} projectNames={projectNames} />
        )}
      </Card>
    </>
  );
}

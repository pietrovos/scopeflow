import { isManager, isStaff } from '@scopeflow/shared';
import { forbidden } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import type { Invitation, Me, Member, OrgSummary, ProjectListItem } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { MembersTable } from '@/components/members/members-table';
import { InviteForm } from '@/components/members/invite-form';
import { PendingInvitations } from '@/components/members/pending-invitations';

export const metadata = { title: 'Team & clients' };

export default async function MembersPage({ params }: PageProps<'/orgs/[orgId]/members'>) {
  const { orgId } = await params;
  const [me, org] = await Promise.all([serverApi<Me>('/me'), serverApi<OrgSummary>(`/orgs/${orgId}`)]);
  if (!isStaff(org.role)) forbidden();
  const manager = isManager(org.role);
  const [members, invitations, projects] = await Promise.all([
    serverApi<Member[]>(`/orgs/${orgId}/members`),
    manager ? serverApi<Invitation[]>(`/orgs/${orgId}/invitations`) : Promise.resolve([]),
    manager ? serverApi<ProjectListItem[]>(`/orgs/${orgId}/projects`) : Promise.resolve([]),
  ]);
  const staff = members.filter((m) => m.role !== 'CLIENT');
  const clients = members.filter((m) => m.role === 'CLIENT');
  const viewer = { userId: me.user.id, role: org.role };

  return (
    <>
      <PageHeader title="Team & clients" description="Who can access this organization, and what they can do." />
      <div className="space-y-6">
        {manager && (
          <Card>
            <CardHeader title="Invite someone" description="Team members see every project. Clients only see projects you share with them." />
            <div className="p-4 sm:p-5">
              <InviteForm orgId={orgId} projects={projects} canInviteAdmins={org.role === 'OWNER'} />
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title={`Team (${staff.length})`} />
          <MembersTable orgId={orgId} members={staff} viewer={viewer} />
        </Card>
        <Card>
          <CardHeader title={`Clients (${clients.length})`} description="Assign clients to projects from each project’s page." />
          {clients.length > 0 ? (
            <MembersTable orgId={orgId} members={clients} viewer={viewer} />
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No client users yet. Invite one above.</p>
          )}
        </Card>
        {manager && (
          <Card>
            <CardHeader title="Pending invitations" />
            <PendingInvitations orgId={orgId} invitations={invitations} />
          </Card>
        )}
      </div>
    </>
  );
}

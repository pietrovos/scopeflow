import { isStaff } from '@scopeflow/shared';
import { serverApi } from '@/lib/server-api';
import type { OrgSummary, ProjectListItem } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { ProjectCard } from '@/components/projects/project-card';
import { NewProjectButton } from '@/components/projects/new-project-button';
import { icons } from '@/components/shell/icons';

export const metadata = { title: 'Projects' };

export default async function ProjectsPage({ params }: PageProps<'/orgs/[orgId]/projects'>) {
  const { orgId } = await params;
  const [org, projects] = await Promise.all([
    serverApi<OrgSummary>(`/orgs/${orgId}`),
    serverApi<ProjectListItem[]>(`/orgs/${orgId}/projects`),
  ]);
  const staff = isStaff(org.role);

  return (
    <>
      <PageHeader
        title={staff ? 'Projects' : 'Your projects'}
        description={staff ? `Everything ${org.name} is working on.` : `Projects ${org.name} is delivering for you.`}
        actions={staff ? <NewProjectButton orgId={orgId} /> : undefined}
      />
      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={icons.projects({ className: 'size-8' })}
            title={staff ? 'No projects yet' : 'No projects shared with you yet'}
            description={
              staff
                ? 'Create your first project, then invite the client so they can follow along and approve changes.'
                : 'When the agency adds you to a project, it will show up here.'
            }
            action={staff ? <NewProjectButton orgId={orgId} /> : undefined}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id} className="flex [&>a]:flex-1">
              <ProjectCard orgId={orgId} project={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

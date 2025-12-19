import { redirect } from 'next/navigation';

export default async function OrgHome({ params }: PageProps<'/orgs/[orgId]'>) {
  const { orgId } = await params;
  redirect(`/orgs/${orgId}/projects`);
}

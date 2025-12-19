import { ApiProvider } from '@/lib/api-context';
import { getAccessToken, publicApiUrl } from '@/lib/server-api';
import { ToastProvider } from '@/components/ui/toast';

export default async function OrgsLayout({ children }: LayoutProps<'/orgs'>) {
  const token = await getAccessToken();
  return (
    <ApiProvider baseUrl={publicApiUrl()} token={token}>
      <ToastProvider>{children}</ToastProvider>
    </ApiProvider>
  );
}

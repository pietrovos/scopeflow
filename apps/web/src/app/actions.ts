'use server';

import { signIn } from '@/auth';

export async function signInAction(formData: FormData) {
  const redirectTo = String(formData.get('redirectTo') || '/orgs');
  // Only allow same-site paths, never an absolute URL from the form.
  await signIn('keycloak', { redirectTo: redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/orgs' });
}

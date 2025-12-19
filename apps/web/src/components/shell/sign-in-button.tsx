import { signInAction } from '@/app/actions';
import { Button } from '@/components/ui/button';

export function SignInButton({ redirectTo = '/orgs', label = 'Sign in' }: { redirectTo?: string; label?: string }) {
  return (
    <form action={signInAction}>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button type="submit">{label}</Button>
    </form>
  );
}

import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('signing out ends the Keycloak session too', async ({ browser }) => {
  const page = await signIn(browser, 'leo@brightpath.test');
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page).toHaveURL('/');

  // Without the Keycloak logout this would silently sign Leo back in.
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  await page.context().close();
});

test('protected pages send anonymous visitors to sign in', async ({ page }) => {
  await page.goto('/orgs');
  await expect(page).toHaveURL(/\/\?signin=required$/);
  await expect(page.getByText('Please sign in to continue.')).toBeVisible();
});

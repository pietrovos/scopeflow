import { expect, type Browser, type Page } from '@playwright/test';

export const PASSWORD = 'scopeflow-demo';

/** Signs in through the real Keycloak login form in a fresh browser context. */
export async function signIn(
  browser: Browser,
  email: string,
  /** Runs before the first navigation, e.g. to install a WebSocket route. */
  setup?: (page: Page) => Promise<void>,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await setup?.(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/orgs\/[0-9a-f-]+\/projects$/);
  return page;
}

export async function openProject(page: Page, name: string) {
  await page
    .getByRole('link', { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Live' }).first()).toBeVisible();
}

export async function postComment(page: Page, text: string) {
  await page.getByLabel('Write a comment').fill(text);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Comments' }).getByText(text)).toBeVisible();
}

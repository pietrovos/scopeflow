import { expect, test } from '@playwright/test';
import { openProject, postComment, signIn } from './helpers';

/**
 * The demo flow, with the agency and the client in separate browser contexts:
 * propose a scope change, discuss it live, hit an edit conflict between two of the
 * agency's tabs, approve the final revision, and check the audit history.
 */
test('agency and client agree on a scope change', async ({ browser }) => {
  const agency = await signIn(browser, 'olivia@northwind.test');
  const client = await signIn(browser, 'dana@acmehealth.test');

  // 1. The agency proposes a change.
  await openProject(agency, 'Patient portal redesign');
  await agency.getByRole('button', { name: 'Propose change' }).click();
  const dialog = agency.getByRole('dialog', { name: 'Propose a scope change' });
  await dialog.getByLabel('Title').fill('Offline mode for the mobile app');
  await dialog
    .getByLabel('What changes and why')
    .fill('Cache appointments and messages so the app works without signal.');
  await dialog.getByLabel('Price impact (USD)').fill('6000');
  await dialog.getByLabel('Schedule impact (days)').fill('12');
  await dialog.getByRole('button', { name: 'Send for approval' }).click();
  const heading = agency.getByRole('heading', { level: 1 });
  await expect(heading).toContainText('Offline mode for the mobile app');
  const sc = (await heading.innerText()).match(/SC-\d+/)![0];
  const scopeChangeUrl = agency.url();

  // 2. The client finds it in their approval inbox.
  await client.getByRole('link', { name: 'Approvals' }).first().click();
  await client.getByRole('link', { name: new RegExp(`${sc} Offline mode`) }).click();
  await expect(client.getByText('Your approval is needed')).toBeVisible();
  await expect(client.getByRole('button', { name: 'Approve revision 1' })).toBeVisible();
  await expect(client.getByRole('status').filter({ hasText: 'Live' }).first()).toBeVisible();

  // 3. They discuss it; each side sees the other's comment without reloading.
  await postComment(client, 'Does this cover Android as well as iOS?');
  await expect(agency.getByRole('list', { name: 'Comments' }).getByText('Does this cover Android')).toBeVisible();
  await postComment(agency, 'Yes, both. We will also drop the price slightly.');
  await expect(client.getByRole('list', { name: 'Comments' }).getByText('We will also drop the price')).toBeVisible();

  // 4. Edit conflict: two agency tabs revise the same revision.
  const secondTab = await agency.context().newPage();
  await secondTab.goto(scopeChangeUrl);
  await agency.getByRole('button', { name: 'Revise proposal' }).click();
  await secondTab.getByRole('button', { name: 'Revise proposal' }).click();

  const tab2 = secondTab.getByRole('dialog', { name: `Revise ${sc}` });
  await tab2.getByLabel('Price impact (USD)').fill('5200');
  await tab2.getByRole('button', { name: 'Submit revision 2' }).click();
  await expect(secondTab.getByText('Revision 2 sent for approval')).toBeVisible();

  const tab1 = agency.getByRole('dialog', { name: `Revise ${sc}` });
  await tab1.getByLabel('Schedule impact (days)').fill('9');
  await tab1.getByRole('button', { name: 'Submit revision 2' }).click();
  const conflict = agency.getByRole('dialog', { name: 'Someone else revised this proposal' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText('Olivia Hart')).toBeVisible();
  // The diff shows tab 2's saved price against this tab's draft.
  await expect(conflict.getByText('+$5,200')).toBeVisible();
  await expect(conflict.getByText('+$6,000')).toBeVisible();
  // Nothing was overwritten: the agency keeps both and submits this draft as revision 3.
  await conflict.getByRole('button', { name: 'Submit mine as revision 3' }).click();
  await expect(agency.getByText('Revision 3 sent for approval')).toBeVisible();
  await secondTab.close();

  // 5. The client's page updated live; they approve the final revision.
  const approve = client.getByRole('button', { name: 'Approve revision 3' });
  await expect(approve).toBeVisible();
  await client.getByLabel('Note to the agency (optional)').fill('Approved, thanks for the quick turnaround.');
  await approve.click();
  await expect(client.getByText('Revision 3 approved')).toBeVisible();
  const history = client.getByRole('list').filter({ hasText: 'Revision 3' }).first();
  await expect(history.getByText('Approved by Dana Whitfield')).toBeVisible();

  // The agency sees the approval without reloading.
  await expect(agency.getByText('Approved', { exact: true }).first()).toBeVisible();

  // 6. The audit log has the whole story, in order.
  await agency.getByRole('link', { name: 'Audit log' }).first().click();
  const entries = agency.getByRole('listitem').filter({ hasText: `${sc} “Offline` });
  await expect(entries).toHaveCount(4);
  await expect(entries.nth(0)).toContainText(
    `Dana Whitfield approved revision 3 of ${sc} “Offline mode for the mobile app”`,
  );
  await expect(entries.nth(1)).toContainText(
    `Olivia Hart revised ${sc} “Offline mode for the mobile app” → revision 3`,
  );
  await expect(entries.nth(2)).toContainText(
    `Olivia Hart revised ${sc} “Offline mode for the mobile app” → revision 2`,
  );
  await expect(entries.nth(3)).toContainText(`Olivia Hart proposed ${sc} “Offline mode for the mobile app” (+$6,000)`);

  await agency.context().close();
  await client.context().close();
});

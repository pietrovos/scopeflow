import { expect, test, type WebSocketRoute } from '@playwright/test';
import { openProject, postComment, signIn } from './helpers';

/**
 * Failure scenario from the README: the client's WebSocket drops, events are emitted
 * while they are offline, and on reconnect the page catches up from the REST cursor
 * with each missed comment shown exactly once.
 */
test('client catches up on missed comments after the socket drops', async ({ browser }) => {
  const agency = await signIn(browser, 'olivia@northwind.test');
  // Route the client's socket through the test so we can cut it. This has to be in
  // place before the page loads; routes only apply to documents loaded afterwards.
  const open: WebSocketRoute[] = [];
  let offline = false;
  const client = await signIn(browser, 'dana@acmehealth.test', (page) =>
    page.routeWebSocket(/\/socket\.io\//, (ws: WebSocketRoute) => {
      if (offline) return ws.close({ code: 1006 });
      ws.connectToServer();
      open.push(ws);
    }),
  );

  const run = Date.now().toString(36);
  await openProject(agency, 'Patient portal redesign');
  await openProject(client, 'Patient portal redesign');

  offline = true;
  for (const ws of open.splice(0)) await ws.close({ code: 1006 });
  await expect(client.getByRole('status').filter({ hasText: 'Reconnecting' })).toBeVisible();

  await postComment(agency, `Sent while you were offline (1) ${run}`);
  await postComment(agency, `Sent while you were offline (2) ${run}`);
  await expect(client.getByText(`Sent while you were offline (1) ${run}`)).toHaveCount(0);

  offline = false;
  await expect(client.getByRole('status').filter({ hasText: 'Live' }).first()).toBeVisible({ timeout: 20_000 });
  const comments = client.getByRole('list', { name: 'Comments' });
  await expect(comments.getByText(`Sent while you were offline (1) ${run}`)).toHaveCount(1);
  await expect(comments.getByText(`Sent while you were offline (2) ${run}`)).toHaveCount(1);

  await agency.context().close();
  await client.context().close();
});

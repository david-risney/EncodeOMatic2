import { expect, test } from '@playwright/test';

test('about dialog opens and page loads without JS errors', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') jsErrors.push(msg.text());
  });

  await page.goto('/');

  // The session name is set during app initialisation; wait for it as a
  // readiness signal rather than waiting on hidden dialog contents.
  await page.waitForFunction(
    () => document.getElementById('session-name')?.value !== '',
    { timeout: 15000 },
  );

  // Open the About dialog via the header button
  await page.click('#btn-about');
  await expect(page.locator('#about-dialog')).toBeVisible();

  // The dialog should show a version string
  const version = page.locator('#about-version');
  await expect(version).not.toBeEmpty();

  expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('\n')}`).toEqual([]);
});

test('updates URL session state while editing an Input Buffer', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => document.getElementById('session-name')?.value !== '',
    { timeout: 15000 },
  );

  await page.click('.add-pipe-control');
  await page.getByRole('button', { name: /Input Buffer/i }).click();

  const input = page.locator('.pipe-node textarea');
  await expect(input).toBeVisible();
  await input.fill('hello');

  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return params.get('gc') ?? params.get('g');
  }).toBeTruthy();

  const firstState = (new URL(page.url()).searchParams.get('gc')
    ?? new URL(page.url()).searchParams.get('g'));

  await input.fill('hello world');

  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return params.get('gc') ?? params.get('g');
  }).not.toBe(firstState);
});

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

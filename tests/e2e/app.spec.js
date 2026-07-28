import { expect, test } from '@playwright/test';

async function waitForAppReady(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => document.getElementById('session-name')?.value !== '',
    { timeout: 15000 },
  );
}

async function addPipeFromDialog(page, pipeName) {
  await page.click('.add-pipe-control');
  await page.getByRole('button', { name: new RegExp(`^${pipeName}$`, 'i') }).click();
}

async function dragConnect(page, fromPipeName, toPipeName) {
  const fromPort = page
    .locator('.pipe-node', { hasText: fromPipeName })
    .locator('.output-port')
    .first();
  const toPort = page
    .locator('.pipe-node', { hasText: toPipeName })
    .locator('.input-port')
    .first();
  const fromBox = await fromPort.boundingBox();
  const toBox = await toPort.boundingBox();
  expect(fromBox).not.toBeNull();
  expect(toBox).not.toBeNull();
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2);
  await page.mouse.up();
}

test('about dialog opens and page loads without JS errors', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') jsErrors.push(msg.text());
  });

  await waitForAppReady(page);

  // Open the About dialog via the header button
  await page.click('#btn-about');
  await expect(page.locator('#about-dialog')).toBeVisible();

  // The dialog should show a version string
  const version = page.locator('#about-version');
  await expect(version).not.toBeEmpty();

  expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('\n')}`).toEqual([]);
});

test('updates URL session state while editing an Input Buffer', async ({ page }) => {
  await waitForAppReady(page);

  await addPipeFromDialog(page, 'Input Buffer');

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

test('mouse config click still works after touch-pointer activity', async ({ page }) => {
  await waitForAppReady(page);
  await addPipeFromDialog(page, 'Input Buffer');

  await page.locator('.graph-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 11,
      pointerType: 'touch',
      clientX: 64,
      clientY: 64,
      button: 0,
    }));
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      pointerId: 11,
      pointerType: 'touch',
      clientX: 64,
      clientY: 64,
      button: 0,
    }));
  });

  await page
    .locator('.pipe-node', { hasText: 'Input Buffer' })
    .locator('.pipe-node-config-btn')
    .click();
  await expect(page.locator('.config-view .data-panel-title')).toHaveText('Configure: Input Buffer');
});

test('deleting a middle pipe immediately keeps downstream output current', async ({ page }) => {
  await waitForAppReady(page);
  await addPipeFromDialog(page, 'Input Buffer');
  await addPipeFromDialog(page, 'Base64 Encode');
  await addPipeFromDialog(page, 'Base64 Decode');

  await dragConnect(page, 'Input Buffer', 'Base64 Encode');
  await dragConnect(page, 'Base64 Encode', 'Base64 Decode');

  const inputNode = page.locator('.pipe-node', { hasText: 'Input Buffer' });
  await inputNode.locator('textarea').fill('hello');

  await page
    .locator('.pipe-node', { hasText: 'Base64 Decode' })
    .locator('.output-port')
    .first()
    .click();
  await expect(page.locator('#data-view-stack')).toContainText('hello');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.delete-pipe-control').click();
  await page.locator('.pipe-node', { hasText: 'Base64 Encode' }).click();
  await expect(page.locator('.pipe-node', { hasText: 'Base64 Encode' })).toHaveCount(0);

  await page
    .locator('.pipe-node', { hasText: 'Base64 Decode' })
    .locator('.output-port')
    .first()
    .click();
  await expect(page.locator('#data-view-stack')).toContainText('hello');
});

test('add-pipe dialog shows Recommended category from last-pipe output context', async ({ page }) => {
  await waitForAppReady(page);
  await addPipeFromDialog(page, 'Input Buffer');

  await page
    .locator('.pipe-node', { hasText: 'Input Buffer' })
    .locator('textarea')
    .fill('aGVsbG8=');

  await page.click('.add-pipe-control');
  const categoryHeaders = page.locator('#pipe-list .pipe-list-category');
  await expect(categoryHeaders.first()).toHaveText('Recommended');
  await expect(page.locator('#pipe-list .pipe-list-item-name', { hasText: 'Base64 Decode' }).first())
    .toBeVisible();
});

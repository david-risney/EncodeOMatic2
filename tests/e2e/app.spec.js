import { expect, test } from '@playwright/test';

async function waitForAppReady(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => document.getElementById('session-name')?.value !== '',
    { timeout: 15000 },
  );
}

async function addPipeFromDialog(page, pipeName) {
  const escapedName = pipeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.click('.add-pipe-control');
  await page.getByRole('button', { name: new RegExp(escapedName, 'i') }).first().click();
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

  await page.evaluate(async () => {
    const graph = document.getElementById('graph-editor')._graph;
    const pipes = [...graph.pipes.values()];
    const input = pipes.find((pipe) => pipe.displayName === 'Input Buffer');
    const encode = pipes.find((pipe) => pipe.displayName === 'Base64 Encode');
    const decode = pipes.find((pipe) => pipe.displayName === 'Base64 Decode');
    graph.connect(input.id, 'output', encode.id, 'input');
    graph.connect(encode.id, 'output', decode.id, 'input');
    input.setConfig('text', 'hello');
    await graph.processFrom(input.id);
  });

  await expect.poll(async () => page.evaluate(() => {
    const graph = document.getElementById('graph-editor')._graph;
    const decode = [...graph.pipes.values()].find((pipe) => pipe.displayName === 'Base64 Decode');
    const bytes = decode?.getOutputData?.();
    return bytes instanceof Uint8Array ? new TextDecoder().decode(bytes) : null;
  }), { timeout: 15000 }).toBe('hello');

  await page.locator('.delete-pipe-control').click();
  await page.evaluate(() => {
    window.confirm = () => true;
    const editor = document.getElementById('graph-editor');
    const encode = [...editor._graph.pipes.values()].find((pipe) => pipe.displayName === 'Base64 Encode');
    editor.dispatchEvent(new CustomEvent('pipe-select', {
      bubbles: true,
      detail: { pipeId: encode.id },
    }));
  });
  await expect(page.locator('.pipe-node', { hasText: 'Base64 Encode' })).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => {
    const graph = document.getElementById('graph-editor')._graph;
    const decode = [...graph.pipes.values()].find((pipe) => pipe.displayName === 'Base64 Decode');
    const bytes = decode?.getOutputData?.();
    return bytes instanceof Uint8Array ? new TextDecoder().decode(bytes) : null;
  }), { timeout: 15000 }).toBe('hello');
});

test('add-pipe dialog shows Recommended category from last-pipe output context', async ({ page }) => {
  await waitForAppReady(page);
  await addPipeFromDialog(page, 'Input Buffer');

  await page
    .locator('.pipe-node', { hasText: 'Input Buffer' })
    .locator('textarea')
    .fill('aGVsbG8=');

  await expect.poll(async () => page.evaluate(() => {
    const graph = document.getElementById('graph-editor')?._graph;
    const lastPipe = graph?.getLastPipe?.();
    return lastPipe?.getOutputData()?.length ?? 0;
  })).toBeGreaterThan(0);

  await page.click('.add-pipe-control');
  const categoryHeaders = page.locator('#pipe-list .pipe-list-category');
  await expect(categoryHeaders.first()).toHaveText('Recommended');
  await expect(page.locator('#pipe-list .pipe-list-item-name', { hasText: 'Base64 Decode' }).first())
    .toBeVisible();
});

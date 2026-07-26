import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('PWA assets', () => {
  it('references existing manifest assets', async () => {
    const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
    const assets = [
      'index.html',
      ...manifest.icons.map(({ src }) => src),
      ...manifest.screenshots.map(({ src }) => src),
    ];

    expect(manifest.start_url).toBe('./');
    await expect(Promise.all(
      assets.map((asset) => readFile(resolve(root, asset)))
    )).resolves.toHaveLength(assets.length);
  });

  it('keeps app and cache commits synchronized', async () => {
    const [versionSource, workerSource] = await Promise.all([
      readFile(resolve(root, 'src/version.js'), 'utf8'),
      readFile(resolve(root, 'sw.js'), 'utf8'),
    ]);
    const appCommit = versionSource.match(/APP_COMMIT\s*=\s*['"]([^'"]+)['"]/)?.[1];
    const cacheCommit = workerSource
      .match(/CACHE_NAME\s*=\s*['"]encodeomatic2-([^'"]+)['"]/)?.[1];

    expect(appCommit).toBeTruthy();
    expect(cacheCommit).toBe(appCommit);
  });

  it('only precaches assets that exist', async () => {
    const workerSource = await readFile(resolve(root, 'sw.js'), 'utf8');
    const precacheSource = workerSource.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/)?.[1];
    const precacheUrls = [...precacheSource.matchAll(/^\s*['"](\.\/[\w./-]*)['"],?\s*$/gm)]
      .map(([, url]) => url)
      .map((url) => url === './' ? './index.html' : url);

    expect(precacheUrls.length).toBeGreaterThan(0);
    expect(precacheUrls).toHaveLength(
      precacheSource.split(',').filter((entry) => entry.trim()).length
    );
    await expect(Promise.all(
      precacheUrls.map((url) => readFile(resolve(root, url)))
    )).resolves.toHaveLength(precacheUrls.length);
  });

  it('precaches every local module imported by the application', async () => {
    const [workerSource, modules] = await Promise.all([
      readFile(resolve(root, 'sw.js'), 'utf8'),
      readdir(resolve(root, 'src'), { recursive: true }),
    ]);

    for (const modulePath of modules.filter((path) => path.endsWith('.js'))) {
      expect(workerSource).toContain(`'./src/${modulePath}'`);
    }
  });

  it('keeps committed vendor modules browser-safe', async () => {
    const vendorDir = resolve(root, 'vendor');
    const vendorFiles = (await readdir(vendorDir))
      .filter((file) => file.endsWith('.js'));
    const browserBlockingImports = /\bfrom ['"](?:node:)?(?:fs|path|stream|util)['"]/;

    expect(vendorFiles.length).toBeGreaterThan(0);

    const sources = await Promise.all(
      vendorFiles.map(async (file) => [file, await readFile(resolve(vendorDir, file), 'utf8')])
    );

    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(browserBlockingImports);
    }
  });
});

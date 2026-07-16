import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

class SilentWorker {
  static errors = [];

  constructor() {
    this.postMessage = vi.fn(({ id }) => {
      queueMicrotask(() => this.onmessage({
        data: { type: 'result', id, outputs: { output: [] }, errors: SilentWorker.errors },
      }));
    });
    this.terminate = vi.fn();
  }
}

function appMarkup() {
  return `
    <button id="btn-share">Share</button>
    <button id="btn-about">About</button>
    <div class="session-controls">
      <div class="session-menu">
        <button id="btn-session-menu">Session</button>
        <div id="session-menu" hidden>
          <button id="btn-session-save">Save session</button>
          <div class="session-load-item">
            <button id="btn-session-load">Load session</button>
            <div id="session-load-menu" hidden></div>
          </div>
          <button id="btn-guess">Guess</button>
          <button id="btn-clear">Clear</button>
        </div>
      </div>
      <input id="session-name">
    </div>
    <button id="btn-zoom-fit">Fit</button>
    <input id="zoom-range" type="range" min="20" max="300" value="100">
    <output id="zoom-value">100%</output>
    <graph-editor id="graph-editor"></graph-editor>
    <aside id="data-panel" style="width: 380px" hidden>
      <div id="data-panel-resizer"></div>
      <div id="data-view-stack"></div>
    </aside>
    <dialog id="add-pipe-dialog">
      <input id="pipe-search-input">
      <div id="pipe-list"></div>
    </dialog>
    <dialog id="config-dialog">
      <span id="config-dialog-title"></span>
      <div id="config-fields"></div>
      <button id="config-delete-btn">Delete</button>
    </dialog>
    <dialog id="guess-dialog">
      <form id="guess-form">
        <textarea id="guess-input"></textarea>
        <button id="guess-cancel" type="button">Cancel</button>
        <button type="submit">Guess</button>
      </form>
    </dialog>
    <dialog id="about-dialog">
      <span id="about-version"></span>
      <span id="update-status"></span>
      <button id="btn-update" hidden></button>
      <div id="install-status" hidden></div>
    </dialog>
  `;
}

describe('application integration', () => {
  beforeAll(async () => {
    vi.stubGlobal('Worker', SilentWorker);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "export const APP_VERSION = '1.0.0';",
    }));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue() },
    });
    document.body.innerHTML = appMarkup();
    await import('../src/app.js');
    await vi.waitFor(() => {
      expect(document.getElementById('pipe-list').children.length).toBeGreaterThan(0);
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('initializes and supports the primary user interactions', async () => {
    expect(document.getElementById('pipe-list').textContent).toContain('Base64 Encode');
    expect(document.getElementById('toast-container')).not.toBeNull();
    expect(document.getElementById('session-name').value).toMatch(/^[a-z]+-[a-z]+$/);

    document.getElementById('btn-about').click();
    expect(document.getElementById('about-dialog').open).toBe(true);
    expect(document.getElementById('about-version').textContent).toBe('1.0.0');
    await vi.waitFor(() => {
      expect(document.getElementById('update-status').textContent)
        .toBe('Encode-O-Matic 2 is up to date.');
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.stringContaining('cache=off') }),
      { cache: 'no-store' }
    );

    document.getElementById('about-dialog').close();
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "export const APP_VERSION = '1.1.0';",
    });
    document.getElementById('btn-about').click();
    await vi.waitFor(() => {
      expect(document.getElementById('update-status').textContent)
        .toBe('Version 1.1.0 is available.');
    });
    expect(document.getElementById('btn-update').hidden).toBe(false);
    expect(document.getElementById('btn-update').textContent)
      .toBe('Update to version 1.1.0');
    document.getElementById('about-dialog').close();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetch.mockRejectedValueOnce(new Error('offline'));
    document.getElementById('btn-about').click();
    await vi.waitFor(() => {
      expect(document.getElementById('update-status').textContent)
        .toBe('Could not check for updates.');
    });
    expect(document.getElementById('btn-update').textContent).toBe('Try again');
    expect(document.getElementById('btn-update').hidden).toBe(false);
    expect(warn).toHaveBeenCalledWith('Update check failed:', expect.any(Error));
    warn.mockRestore();
    document.getElementById('about-dialog').close();

    const input = document.getElementById('pipe-search-input');
    input.value = 'regex';
    input.dispatchEvent(new Event('input'));
    expect(document.getElementById('pipe-list').textContent).toContain('Regex Match');
    expect(document.getElementById('pipe-list').textContent).not.toContain('Base64 Encode');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(document.getElementById('pipe-list').textContent).toContain('Base64 Encode');

    expect(document.querySelector('.add-pipe-control').hidden).toBe(false);
    document.querySelector('.add-pipe-control').click();
    const dialog = document.getElementById('add-pipe-dialog');
    expect(dialog.open).toBe(true);
    [...document.querySelectorAll('.pipe-list-item')]
      .find((item) => item.textContent.includes('Input Buffer'))
      .click();

    const node = [...document.querySelectorAll('.pipe-node')]
      .find((element) => element.textContent.includes('Input Buffer'));
    expect(node).not.toBeNull();
    const textarea = node.querySelector('textarea');
    SilentWorker.errors = [{
      message: 'Example processing error',
      selections: [{ index: 1, length: 2 }],
    }];
    textarea.value = 'hello';
    textarea.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(node.querySelector('.pipe-node-error-indicator').hidden).toBe(false);
    });
    await vi.waitFor(() => expect(window.location.search).toContain('g='));
    node.click();
    const dataView = document.querySelector('.data-view');
    expect(dataView.querySelector('.data-panel-title').textContent)
      .toContain('Input Buffer · output');
    expect(dataView.querySelector('.data-panel-title').textContent)
      .not.toContain('output: output');
    expect(dataView.querySelector('.data-view-errors').textContent)
      .toContain('Example processing error');
    expect(dataView.querySelector('.data-view-errors').textContent)
      .toContain('Trigger: bytes 1-2');
    const modeButton = dataView.querySelector('[title="Switch to hex view"]');
    expect(modeButton.textContent).toBe('Aa');
    modeButton.click();
    expect(dataView.querySelector('data-viewer')._mode).toBe('hex');
    expect(modeButton.textContent).toBe('0xFF');
    expect(dataView.querySelector('[title="Keep this view open"]').textContent).toBe('📍');

    expect(node.querySelector('.pipe-node-error')).toBeNull();
    expect(node.querySelector('.pipe-node-error-indicator').textContent).toBe('⚠️');

    document.querySelector('.graph-canvas').click();
    expect(dataView.isConnected).toBe(false);
    expect(document.getElementById('data-panel').hidden).toBe(true);

    node.click();
    const reopenedDataView = document.querySelector('.data-view');
    expect(reopenedDataView).not.toBeNull();

    const resizer = document.getElementById('data-panel-resizer');
    expect(document.getElementById('data-panel').style.width).toBe('380px');
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.getElementById('data-panel').style.width).toBe('400px');
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.getElementById('data-panel').style.width).toBe('380px');
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(document.getElementById('data-panel').style.width).toBe('280px');
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(document.getElementById('data-panel').style.width).toBe('512px');

    node.querySelector('.pipe-node-config-btn').click();
    const configDialog = document.getElementById('config-dialog');
    expect(configDialog.open).toBe(true);
    expect(document.getElementById('config-dialog-title').textContent)
      .toBe('Configure: Input Buffer');
    document.getElementById('config-delete-btn').click();
    expect(node.isConnected).toBe(false);
    expect(reopenedDataView.isConnected).toBe(false);

    document.getElementById('btn-share').click();
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('?g=')
      );
    });
    expect(document.querySelector('.toast.success')?.textContent)
      .toBe('URL copied to clipboard!');

    vi.stubGlobal('confirm', vi.fn(() => true));
    document.getElementById('btn-clear').click();
    await vi.waitFor(() => expect(window.location.search).toContain('g='));
    expect(document.querySelector('.pipe-node')).toBeNull();
    expect(document.getElementById('data-panel').hidden).toBe(true);
    expect(document.getElementById('session-name').value).toMatch(/^[a-z]+-[a-z]+$/);

    const prompt = vi.spyOn(window, 'prompt');
    const sessionName = document.getElementById('session-name');
    sessionName.value = 'favorite-session';
    document.getElementById('btn-session-save').click();
    await vi.waitFor(() => {
      expect([...document.querySelectorAll('.toast.success')].at(-1)?.textContent)
        .toBe('Saved session "favorite-session"');
    });
    sessionName.value = 'another-session';
    document.getElementById('btn-session-menu').click();
    document.getElementById('btn-session-load').click();
    const savedSession = await vi.waitFor(() => {
      const item = document.querySelector('[data-session-name="favorite-session"]');
      expect(item).not.toBeNull();
      return item;
    });
    savedSession.click();
    await vi.waitFor(() => expect(sessionName.value).toBe('favorite-session'));
    expect(prompt).not.toHaveBeenCalled();

    document.getElementById('btn-guess').click();
    expect(document.getElementById('guess-dialog').open).toBe(true);
    document.getElementById('guess-cancel').click();
    expect(document.getElementById('guess-dialog').open).toBe(false);

    const zoom = document.getElementById('zoom-range');
    zoom.value = '150';
    zoom.dispatchEvent(new Event('input'));
    expect(document.getElementById('zoom-value').textContent).toBe('150%');
  });
});

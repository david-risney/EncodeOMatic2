import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

class SilentWorker {
  constructor() {
    this.postMessage = vi.fn(({ id }) => {
      queueMicrotask(() => this.onmessage({
        data: { type: 'result', id, outputs: { output: [] }, errors: [] },
      }));
    });
    this.terminate = vi.fn();
  }
}

function appMarkup() {
  return `
    <button id="btn-add-pipe">Add</button>
    <button id="btn-save">Save</button>
    <button id="btn-load">Load</button>
    <button id="btn-clear">Clear</button>
    <button id="btn-zoom-fit">Fit</button>
    <graph-editor id="graph-editor"></graph-editor>
    <aside id="data-panel" hidden>
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
  `;
}

describe('application integration', () => {
  beforeAll(async () => {
    vi.stubGlobal('Worker', SilentWorker);
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

    const input = document.getElementById('pipe-search-input');
    input.value = 'regex';
    input.dispatchEvent(new Event('input'));
    expect(document.getElementById('pipe-list').textContent).toContain('Regex Match');
    expect(document.getElementById('pipe-list').textContent).not.toContain('Base64 Encode');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(document.getElementById('pipe-list').textContent).toContain('Base64 Encode');

    document.getElementById('btn-add-pipe').click();
    const dialog = document.getElementById('add-pipe-dialog');
    expect(dialog.open).toBe(true);
    [...document.querySelectorAll('.pipe-list-item')]
      .find((item) => item.textContent.includes('Input Buffer'))
      .click();

    const node = [...document.querySelectorAll('.pipe-node')]
      .find((element) => element.textContent.includes('Input Buffer'));
    expect(node).not.toBeNull();
    const textarea = node.querySelector('textarea');
    textarea.value = 'hello';
    textarea.dispatchEvent(new Event('input'));
    node.click();
    const dataView = document.querySelector('.data-view');
    expect(dataView.querySelector('.data-panel-title').textContent)
      .toContain('Input Buffer · output');
    expect(dataView.querySelector('.data-panel-title').textContent)
      .not.toContain('output: output');
    const modeButton = dataView.querySelector('[title="Switch to hex view"]');
    expect(modeButton.textContent).toBe('Aa');
    modeButton.click();
    expect(dataView.querySelector('data-viewer')._mode).toBe('hex');
    expect(modeButton.textContent).toBe('0xFF');
    expect(dataView.querySelector('[title="Keep this view open"]').textContent).toBe('📍');

    node.querySelector('.pipe-node-config-btn').click();
    const configDialog = document.getElementById('config-dialog');
    expect(configDialog.open).toBe(true);
    expect(document.getElementById('config-dialog-title').textContent)
      .toBe('Configure: Input Buffer');
    document.getElementById('config-delete-btn').click();
    expect(node.isConnected).toBe(false);
    expect(dataView.isConnected).toBe(false);

    document.getElementById('btn-save').click();
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('?g=')
      );
    });
    expect(document.querySelector('.toast.success')?.textContent)
      .toBe('URL copied to clipboard!');

    vi.stubGlobal('confirm', vi.fn(() => true));
    document.getElementById('btn-clear').click();
    expect(window.location.search).toBe('');
    expect(document.querySelector('.pipe-node')).toBeNull();
    expect(document.getElementById('data-panel').hidden).toBe(true);
  });
});

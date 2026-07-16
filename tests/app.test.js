import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

class SilentWorker {
  constructor() {
    this.postMessage = vi.fn(({ id, pipeType }) => {
      queueMicrotask(() => this.onmessage({
        data: {
          type: 'result',
          id,
          outputs: { output: [] },
          errors: pipeType === 'Base64Decode'
            ? [{ message: 'Invalid Base64 input' }]
            : [],
        },
      }));
    });
    this.terminate = vi.fn();
  }
}

function appMarkup() {
  return `
    <button id="btn-share">Share</button>
    <button id="btn-session-menu">Session</button>
    <div id="session-menu" hidden>
      <button id="btn-session-save">Save session</button>
      <button id="btn-session-load">Load session</button>
      <button id="btn-guess">Guess</button>
      <button id="btn-clear">Clear</button>
    </div>
    <button id="btn-zoom-fit">Fit</button>
    <input id="zoom-range" type="range" min="20" max="300" value="100">
    <output id="zoom-value">100%</output>
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
    textarea.value = 'hello';
    textarea.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(window.location.search).toContain('g='));
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

    document.querySelector('.add-pipe-control').click();
    [...document.querySelectorAll('.pipe-list-item')]
      .find((item) => item.textContent.includes('Base64 Decode'))
      .click();
    const decoderNode = [...document.querySelectorAll('.pipe-node')]
      .find((element) => element.textContent.includes('Base64 Decode'));
    node.querySelector('.port[data-port-type="output"]')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    decoderNode.querySelector('.port[data-port-type="input"]')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    decoderNode.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.data-panel-error').textContent)
        .toBe('Invalid Base64 input');
    });
    expect(decoderNode.querySelector('.pipe-node-error')).toBeNull();
    expect(decoderNode.querySelector('.pipe-node-error-indicator').textContent).toBe('⚠️');

    node.querySelector('.pipe-node-config-btn').click();
    const configDialog = document.getElementById('config-dialog');
    expect(configDialog.open).toBe(true);
    expect(document.getElementById('config-dialog-title').textContent)
      .toBe('Configure: Input Buffer');
    document.getElementById('config-delete-btn').click();
    expect(node.isConnected).toBe(false);
    expect(dataView.isConnected).toBe(false);

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

    const zoom = document.getElementById('zoom-range');
    zoom.value = '150';
    zoom.dispatchEvent(new Event('input'));
    expect(document.getElementById('zoom-value').textContent).toBe('150%');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataViewer } from '../src/ui/data-viewer.js';
import { GraphEditor } from '../src/ui/graph-editor.js';
import { PipeGraph } from '../src/pipes/graph.js';
import { InputPipe } from '../src/pipes/builtin/input-pipe.js';
import { HexEncodePipe } from '../src/pipes/builtin/encoding/hex.js';
import { encode } from './helpers.js';

describe('DataViewer', () => {
  let viewer;

  beforeEach(() => {
    viewer = document.createElement('data-viewer');
    document.body.appendChild(viewer);
  });

  it('is registered and shows absent and empty states', () => {
    expect(viewer).toBeInstanceOf(DataViewer);
    expect(viewer.textContent).toBe('No data');
    viewer.setData(new Uint8Array());
    expect(viewer.textContent).toBe('(empty)');
  });

  it('renders text safely with byte and character counts', () => {
    viewer.setData(encode('<b>é</b>'));
    expect(viewer.querySelector('span').textContent).toBe('<b>é</b>');
    expect(viewer.querySelector('b')).toBeNull();
    expect(viewer.textContent).toContain('9 bytes · 8 chars');
  });

  it('renders colorized hex bytes and singular counts', () => {
    viewer.setData(Uint8Array.of(0, 10, 32, 65, 127, 255));
    viewer.setMode('hex');
    const bytes = [...viewer.querySelectorAll('.hex-byte')];
    expect(bytes.map((node) => node.textContent)).toEqual(['00', '0A', '20', '41', '7F', 'FF']);
    expect(bytes[0].style.color).toBe('rgb(102, 102, 102)');
    expect(bytes[1].title).toContain('(ctrl)');
    expect(viewer._inner.classList.contains('hex-view')).toBe(true);
    viewer.setData(Uint8Array.of(65));
    expect(viewer.textContent).toContain('1 byte');
  });

  it('highlights selected byte ranges in text and hex views', () => {
    viewer.setData(encode('abcde'));
    viewer.setSelections([{ index: 1, length: 2 }]);
    expect(viewer.querySelector('.data-viewer-selection').textContent).toBe('bc');

    viewer.setMode('hex');
    expect([...viewer.querySelectorAll('.hex-byte.data-viewer-selection')]
      .map((node) => node.textContent)).toEqual(['62', '63']);
  });

  it('emits byte ranges selected in editable text and hex views', () => {
    const selected = vi.fn();
    viewer.addEventListener('selection-change', selected);
    viewer.setData(encode('aéz'));
    viewer.setEditable(true);

    let editor = viewer.querySelector('textarea');
    editor.setSelectionRange(1, 2);
    editor.dispatchEvent(new Event('select'));
    expect(selected.mock.lastCall[0].detail.selections).toEqual([{ index: 1, length: 2 }]);

    viewer.setMode('hex');
    editor = viewer.querySelector('textarea');
    editor.setSelectionRange(3, 8);
    editor.dispatchEvent(new Event('select'));
    expect(selected.mock.lastCall[0].detail.selections).toEqual([{ index: 1, length: 2 }]);
  });

  it('emits byte ranges selected in rendered hex views', () => {
    const selected = vi.fn();
    viewer.addEventListener('selection-change', selected);
    viewer.setData(encode('abcd'));
    viewer.setMode('hex');
    const bytes = viewer.querySelectorAll('.hex-byte');
    const range = document.createRange();
    range.setStart(bytes[1].firstChild, 0);
    range.setEnd(bytes[2].firstChild, 2);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    viewer._inner.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(selected.mock.lastCall[0].detail.selections).toEqual([{ index: 1, length: 2 }]);
  });

  it('allows text and validated hex editing when enabled', () => {
    const changed = vi.fn();
    viewer.setData(new Uint8Array());
    viewer.setEditable(true, changed);
    const textEditor = viewer.querySelector('textarea');
    textEditor.value = 'é';
    textEditor.dispatchEvent(new Event('input'));
    expect([...changed.mock.lastCall[0]]).toEqual([0xC3, 0xA9]);
    expect(changed.mock.lastCall[1]).toBe('text');

    viewer.setMode('hex');
    const hexEditor = viewer.querySelector('textarea');
    hexEditor.value = '00 FF 41';
    hexEditor.dispatchEvent(new Event('input'));
    expect([...changed.mock.lastCall[0]]).toEqual([0, 255, 65]);
    expect(changed.mock.lastCall[1]).toBe('hex');
    hexEditor.value = 'C3 A9';
    hexEditor.dispatchEvent(new Event('input'));
    viewer.setMode('text');
    expect(viewer.querySelector('textarea').value).toBe('é');
    viewer.setMode('hex');
    const invalidEditor = viewer.querySelector('textarea');
    invalidEditor.value = '0G';
    invalidEditor.dispatchEvent(new Event('input'));
    expect(invalidEditor.getAttribute('aria-invalid')).toBe('true');
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it('does not replace a focused editor when unchanged selections refresh', () => {
    viewer.setData(encode('abc'));
    viewer.setEditable(true);
    const editor = viewer.querySelector('textarea');
    editor.focus();
    viewer.setSelections([]);
    expect(viewer.querySelector('textarea')).toBe(editor);
  });
});

describe('GraphEditor', () => {
  let editor;
  let graph;
  let source;
  let target;

  beforeEach(() => {
    editor = document.createElement('graph-editor');
    document.body.appendChild(editor);
    graph = new PipeGraph();
    source = new InputPipe();
    target = new HexEncodePipe();
    source.position = { x: 10, y: 20 };
    target.position = { x: 210, y: 120 };
    graph.addPipe(source);
    graph.addPipe(target);
    editor.setGraph(graph);
    editor.addPipeElement(source);
    editor.addPipeElement(target);
  });

  it('is registered and creates pipe nodes and ports', () => {
    expect(editor).toBeInstanceOf(GraphEditor);
    expect(editor.querySelectorAll('.pipe-node')).toHaveLength(2);
    expect(editor.querySelector('textarea').placeholder).toContain('Enter input');
    expect(editor._portElements.has(`${source.id}:output:output`)).toBe(true);
    expect(editor._portElements.has(`${target.id}:input:input`)).toBe(true);
  });

  it('dispatches configuration, selection, and port events', () => {
    const config = vi.fn();
    const select = vi.fn();
    const port = vi.fn();
    editor.addEventListener('pipe-config-click', config);
    editor.addEventListener('pipe-select', select);
    editor.addEventListener('pipe-port-click', port);
    editor._pipeElements.get(target.id).querySelector('button').click();
    editor._pipeElements.get(target.id).click();
    editor._portElements.get(`${target.id}:output:output`).click();
    expect(config.mock.calls[0][0].detail).toEqual({ pipeId: target.id });
    expect(select.mock.calls[0][0].detail).toEqual({ pipeId: target.id });
    expect(port.mock.calls[0][0].detail).toEqual({
      pipeId: target.id, portName: 'output', portType: 'output',
    });
  });

  it('updates input configuration and processes downstream data', async () => {
    graph.connect(source.id, 'output', target.id, 'input');
    const process = vi.spyOn(graph, 'processFrom').mockResolvedValue();
    const textarea = editor._pipeElements.get(source.id).querySelector('textarea');
    textarea.value = 'new input';
    textarea.dispatchEvent(new Event('input'));
    expect(source.getConfig('text').value).toBe('new input');
    expect(source.getConfig('rawBytes').value).toBeNull();
    expect(process).toHaveBeenCalledWith(source.id);
  });

  it('creates, updates, emits, and removes connection paths', () => {
    const connection = graph.connect(source.id, 'output', target.id, 'input');
    const from = editor._portElements.get(`${source.id}:output:output`);
    const to = editor._portElements.get(`${target.id}:input:input`);
    vi.spyOn(from, 'getBoundingClientRect').mockReturnValue({
      left: 10, top: 20, width: 10, height: 10,
    });
    vi.spyOn(to, 'getBoundingClientRect').mockReturnValue({
      left: 110, top: 220, width: 10, height: 10,
    });
    vi.spyOn(editor._inner, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 });
    const click = vi.fn();
    editor.addEventListener('connection-click', click);
    editor.updateConnections();
    const paths = editor._connPathGroups.get(connection.id);
    expect(paths.vis.getAttribute('d')).toContain('M 15 25 C');
    paths.hit.dispatchEvent(new MouseEvent('click', { clientX: 4, clientY: 5 }));
    expect(click.mock.calls[0][0].detail.connection).toBe(connection);
    graph.disconnectById(connection.id);
    editor.updateConnections();
    expect(editor._connPathGroups.size).toBe(0);
  });

  it('starts, completes, and cancels draft connections', () => {
    const process = vi.spyOn(graph, 'processFrom').mockResolvedValue();
    editor._onPortMouseDown({}, source.id, 'output', 'output');
    expect(editor._draftPath).not.toBeNull();
    editor._completeConnection(target.id, 'input');
    expect(graph.connections).toHaveLength(1);
    expect(process).toHaveBeenCalledWith(source.id);
    expect(editor._draftPath).toBeNull();

    editor._onPortMouseDown({}, source.id, 'output', 'output');
    editor._cancelDraft();
    expect(editor._draftFrom).toBeNull();
    expect(editor._canvas.classList.contains('connecting')).toBe(false);
  });

  it('requests a connected pipe when a connection is dropped on empty space', () => {
    const request = vi.fn();
    editor.addEventListener('add-pipe-request', request);
    vi.spyOn(editor._inner, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 });
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(editor._canvas);

    editor._onPortMouseDown({}, source.id, 'output', 'output');
    editor._onCanvasMouseMove({ clientX: 310, clientY: 220 });
    expect(editor._addPipeControl.hidden).toBe(false);
    expect(editor._addPipeControl.classList.contains('draft')).toBe(true);
    editor._onCanvasMouseUp({ clientX: 310, clientY: 220 });

    expect(request.mock.calls[0][0].detail).toEqual({
      input: { pipeId: source.id, portName: 'output' },
      position: { x: 240, y: 190 },
    });
    expect(editor._draftFrom).toBeNull();
    expect(editor._addPipeControl.hidden).toBe(true);
  });

  it('shows an add-pipe control for an empty graph', () => {
    const emptyEditor = document.createElement('graph-editor');
    document.body.appendChild(emptyEditor);
    emptyEditor.setGraph(new PipeGraph());
    const request = vi.fn();
    emptyEditor.addEventListener('add-pipe-request', request);

    expect(emptyEditor._addPipeControl.hidden).toBe(false);
    emptyEditor._addPipeControl.click();
    expect(request.mock.calls[0][0].detail).toEqual({
      input: null,
      position: { x: 60, y: 80 },
    });
  });

  it('pans, zooms, drags nodes, and fits the graph', () => {
    Object.defineProperties(editor._canvas, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
    });
    vi.spyOn(editor._canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 });
    editor._onCanvasMouseDown({ button: 0, clientX: 5, clientY: 6 });
    editor._onCanvasMouseMove({ clientX: 25, clientY: 36 });
    editor._onCanvasMouseUp({ clientX: 25, clientY: 36 });
    expect(editor._panX).toBe(20);
    expect(editor._panY).toBe(30);

    editor._onWheel({
      preventDefault: vi.fn(), deltaY: -1, clientX: 100, clientY: 100,
    });
    expect(editor._scale).toBeCloseTo(1.1);

    const element = editor._pipeElements.get(source.id);
    editor._dragging = {
      pipeId: source.id, el: element, startMouseX: 0, startMouseY: 0,
      startElemX: source.position.x, startElemY: source.position.y,
    };
    editor._onCanvasMouseMove({ clientX: 11, clientY: 22 });
    expect(source.position.x).toBeCloseTo(20);
    editor._onCanvasMouseUp({ clientX: 11, clientY: 22 });
    expect(editor._dragging).toBeNull();

    editor.fitView();
    expect(editor._inner.style.transform).toContain('scale(');
  });

  it('displays processing errors and removes pipe elements', () => {
    source._errors = [{ message: 'failed' }];
    editor.updatePipeElement(source);
    const element = editor._pipeElements.get(source.id);
    const indicator = element.querySelector('.pipe-node-error-indicator');
    expect(indicator.hidden).toBe(false);
    expect(indicator.textContent).toBe('⚠️');
    expect(indicator.title).toBe('failed');
    expect(indicator.getAttribute('aria-hidden')).toBe('false');
    expect(indicator.getAttribute('aria-label')).toBe('Error: failed');
    expect(element.querySelector('.pipe-node-error')).toBeNull();

    source._errors = [];
    editor.updatePipeElement(source);
    expect(indicator.hidden).toBe(true);
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    expect(indicator.hasAttribute('aria-label')).toBe(false);

    editor.removePipeElement(source.id);
    expect(editor._pipeElements.has(source.id)).toBe(false);
  });
});

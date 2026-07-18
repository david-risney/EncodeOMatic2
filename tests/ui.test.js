import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataViewer } from '../src/ui/data-viewer.js';
import { GraphEditor } from '../src/ui/graph-editor.js';
import { PipeGraph } from '../src/pipes/graph.js';
import { InputPipe } from '../src/pipes/builtin/input-pipe.js';
import { HexEncodePipe } from '../src/pipes/builtin/encoding/hex.js';
import { encode } from './helpers.js';

const OUTPUT_PORT_RECT = { left: 30, top: 80, width: 18, height: 16 };
const INPUT_PORT_RECT = { left: 220, top: 120, width: 18, height: 10 };
const INPUT_DROP_TARGET_PADDING_X = 18;
const INPUT_DROP_TARGET_PADDING_Y = 16;

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
    expect(bytes[0].style.getPropertyValue('--byte-color')).toBe('hsl(0, 0%, 40%)');
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
  const setCanvasSize = (element, width = 800, height = 600) => {
    Object.defineProperties(element._canvas, {
      clientWidth: { configurable: true, value: width },
      clientHeight: { configurable: true, value: height },
    });
  };
  const mockPortRect = (port, rect) => vi.spyOn(port, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  });

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
    editor._pipeElements.get(target.id).querySelector('.pipe-node-config-btn').click();
    editor._pipeElements.get(target.id).click();
    editor._portElements.get(`${target.id}:output:output`).click();
    expect(config.mock.calls[0][0].detail).toEqual({ pipeId: target.id });
    expect(select.mock.calls[0][0].detail).toEqual({ pipeId: target.id });
    expect(port.mock.calls[0][0].detail).toEqual({
      pipeId: target.id, portName: 'output', portType: 'output',
    });
  });

  it('exposes graph controls to keyboard and assistive technology', () => {
    const select = vi.fn();
    editor.addEventListener('pipe-select', select);
    const node = editor._pipeElements.get(target.id);
    const config = node.querySelector('.pipe-node-config-btn');
    const port = editor._portElements.get(`${target.id}:input:input`);

    expect(node.tabIndex).toBe(0);
    expect(node.getAttribute('role')).toBe('button');
    expect(node.getAttribute('aria-label')).toBe('Select Hex Encode pipe');
    expect(config.getAttribute('aria-label')).toBe('Configure Hex Encode');
    expect(port.tagName).toBe('BUTTON');
    expect(port.getAttribute('aria-label')).toContain('input port input');

    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(select).toHaveBeenCalledOnce();
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

  it('snaps draft connections to nearby inputs with a larger drop target', () => {
    const process = vi.spyOn(graph, 'processFrom').mockResolvedValue();
    const from = editor._portElements.get(`${source.id}:output:output`);
    const to = editor._portElements.get(`${target.id}:input:input`);
    vi.spyOn(editor._inner, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 });
    mockPortRect(from, OUTPUT_PORT_RECT);
    mockPortRect(to, INPUT_PORT_RECT);

    editor._onPortMouseDown({}, source.id, 'output', 'output');
    editor._onCanvasPointerMove({ clientX: 236, clientY: 112 });
    const inputCenterX = INPUT_PORT_RECT.left + INPUT_PORT_RECT.width / 2;
    const inputCenterY = INPUT_PORT_RECT.top + INPUT_PORT_RECT.height / 2;

    expect(editor._draftTargetPort).toBe(to);
    expect(to.classList.contains('highlighted')).toBe(true);
    expect(editor._addPipeControl.hidden).toBe(true);
    expect(editor._draftPath.getAttribute('d')).toContain(`${inputCenterX} ${inputCenterY}`);

    editor._onCanvasPointerUp({ clientX: 236, clientY: 112 });

    expect(graph.connections).toHaveLength(1);
    expect(graph.connections[0].toPipeId).toBe(target.id);
    expect(process).toHaveBeenCalledWith(source.id);
    expect(editor._draftTargetPort).toBeNull();
    expect(to.classList.contains('highlighted')).toBe(false);
  });

  it('expands the input drop target to the configured drag padding', () => {
    const to = editor._portElements.get(`${target.id}:input:input`);
    mockPortRect(to, INPUT_PORT_RECT);
    editor._draftFrom = { pipeId: source.id, portName: 'output', portType: 'output' };
    editor._draftValidTargetPipeIds = new Set([target.id]);
    editor._draftInputTargets = editor._collectDraftInputTargets();
    const right = INPUT_PORT_RECT.left + INPUT_PORT_RECT.width;
    const bottom = INPUT_PORT_RECT.top + INPUT_PORT_RECT.height;

    expect(
      editor._findInputDropTarget(
        INPUT_PORT_RECT.left - INPUT_DROP_TARGET_PADDING_X,
        INPUT_PORT_RECT.top - INPUT_DROP_TARGET_PADDING_Y
      )
    ).toBe(to);
    expect(
      editor._findInputDropTarget(
        right + INPUT_DROP_TARGET_PADDING_X,
        bottom + INPUT_DROP_TARGET_PADDING_Y
      )
    ).toBe(to);
    expect(
      editor._findInputDropTarget(
        INPUT_PORT_RECT.left - INPUT_DROP_TARGET_PADDING_X - 1,
        INPUT_PORT_RECT.top - INPUT_DROP_TARGET_PADDING_Y
      )
    ).toBeNull();

    editor._cancelDraft();
  });

  it('requests a connected pipe when a connection is dropped on empty space', () => {
    const request = vi.fn();
    editor.addEventListener('add-pipe-request', request);
    setCanvasSize(editor);
    vi.spyOn(editor._inner, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 });
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(editor._canvas);

    editor._onPortMouseDown({}, source.id, 'output', 'output');
    editor._onCanvasPointerMove({ clientX: 310, clientY: 220 });
    expect(editor._addPipeControl.hidden).toBe(false);
    expect(editor._addPipeControl.classList.contains('draft')).toBe(true);
    editor._onCanvasPointerUp({ clientX: 310, clientY: 220 });

    expect(request.mock.calls[0][0].detail).toEqual({
      input: { pipeId: source.id, portName: 'output' },
      position: { x: 240, y: 190 },
    });
    expect(editor._draftFrom).toBeNull();
    expect(editor._addPipeControl.hidden).toBe(false);
    expect(editor._addPipeControl.style.getPropertyValue('--graph-item-x')).toBe('330px');
    expect(editor._addPipeControl.style.getPropertyValue('--graph-item-y')).toBe('270px');
  });

  it('shows a centered add-pipe control even when the graph has pipes', () => {
    setCanvasSize(editor);
    editor._syncAddPipeControl();

    expect(editor._addPipeControl.hidden).toBe(false);
    expect(editor._addPipeControl.style.getPropertyValue('--graph-item-x')).toBe('330px');
    expect(editor._addPipeControl.style.getPropertyValue('--graph-item-y')).toBe('270px');
  });

  it('shows a centered add-pipe control for an empty graph', () => {
    const emptyEditor = document.createElement('graph-editor');
    document.body.appendChild(emptyEditor);
    setCanvasSize(emptyEditor);
    emptyEditor.setGraph(new PipeGraph());
    const request = vi.fn();
    emptyEditor.addEventListener('add-pipe-request', request);
    emptyEditor._syncAddPipeControl();

    expect(emptyEditor._addPipeControl.hidden).toBe(false);
    emptyEditor._addPipeControl.click();
    expect(request.mock.calls[0][0].detail).toEqual({
      input: null,
      position: { x: 330, y: 270 },
    });
  });

  it('pans, zooms, drags nodes, and fits the graph', () => {
    setCanvasSize(editor);
    vi.spyOn(editor._canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 });
    editor._onCanvasPointerDown({ button: 0, clientX: 5, clientY: 6, target: editor._canvas });
    expect(editor._canvas.classList.contains('grabbing')).toBe(true);
    editor._onCanvasPointerMove({ clientX: 25, clientY: 36 });
    editor._onCanvasPointerUp({ clientX: 25, clientY: 36 });
    expect(editor._canvas.classList.contains('grabbing')).toBe(false);
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
    editor._onCanvasPointerMove({ clientX: 11, clientY: 22 });
    expect(source.position.x).toBeCloseTo(20);
    editor._onCanvasPointerUp({ clientX: 11, clientY: 22 });
    expect(editor._dragging).toBeNull();

    editor.fitView();
    expect(Number(editor._inner.style.getPropertyValue('--graph-scale'))).toBeGreaterThan(0);
  });

  it('pans with one touch and pinches around the moving touch center', () => {
    vi.spyOn(editor._canvas, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20 });
    const pointer = (pointerId, clientX, clientY) => ({
      pointerId, pointerType: 'touch', button: 0, clientX, clientY,
      preventDefault: vi.fn(), target: editor._canvas,
    });

    editor._onCanvasPointerDown(pointer(1, 60, 70));
    editor._onCanvasPointerMove(pointer(1, 80, 100));
    expect(editor._panX).toBe(20);
    expect(editor._panY).toBe(30);

    editor._onCanvasPointerDown(pointer(2, 180, 100));
    editor._onCanvasPointerMove(pointer(2, 280, 100));
    expect(editor._scale).toBe(2);
    expect(editor._panX).toBe(-30);
    expect(editor._panY).toBe(-20);

    editor._onCanvasPointerMove(pointer(1, 100, 120));
    editor._onCanvasPointerMove(pointer(2, 300, 120));
    expect(editor._panX).toBe(-10);
    expect(editor._panY).toBe(0);

    editor._onCanvasPointerUp(pointer(2, 300, 120));
    editor._onCanvasPointerMove(pointer(1, 110, 130));
    expect(editor._panX).toBe(0);
    expect(editor._panY).toBe(10);
    editor._onCanvasPointerUp(pointer(1, 110, 130));
    expect(editor._isPanning).toBe(false);
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

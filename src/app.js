/**
 * app.js — Entry point for Encode-O-Matic 2.
 *
 * Initializes the graph, UI, and wires everything together.
 */

import { PipeGraph } from './pipes/graph.js';
import { registry, createPipe, getPipesByCategory } from './pipes/registry.js';
import { WorkerPool } from './worker/worker-pool.js';
import { saveToUrl, loadFromUrl } from './state.js';
import { FileInputPipe } from './pipes/builtin/file-input-pipe.js';
import './ui/graph-editor.js';
import './ui/data-viewer.js';

// ── App state ────────────────────────────────────────────────────

const graph = new PipeGraph();

// Worker pool URL: relative to index.html, points at pipe-worker.js
const WORKER_URL = new URL('./src/worker/pipe-worker.js', window.location.href).href;
const workerPool = new WorkerPool(WORKER_URL);
graph.setWorkerPool(workerPool);

/** @type {import('./ui/graph-editor.js').GraphEditor} */
const editor = document.getElementById('graph-editor');

/** @type {import('./ui/data-viewer.js').DataViewer} */
const dataViewer = document.getElementById('data-viewer');

const dataPanelTitle = document.getElementById('data-panel-title');
const btnViewText = document.getElementById('btn-view-text');
const btnViewHex  = document.getElementById('btn-view-hex');

let viewMode = 'text'; // 'text' | 'hex'
let selectedPort = null; // {pipeId, portName, portType}

/** The connection action popover element. @type {HTMLElement|null} */
let _connActionPopover = null;
/** The connection whose popover is currently shown. @type {import('./pipes/graph.js').Connection|null} */
let _connActionTarget = null;
/**
 * The default connections for the pipe being added.
 * @type {{
 *   input: {pipeId: string, portName: string}|null,
 *   output: {pipeId: string, portName: string}|null,
 *   replacedConnection: import('./pipes/graph.js').Connection|null,
 *   inputData?: Uint8Array|null
 * }|null}
 */
let _addPipeContext = null;

// ── Initialize ───────────────────────────────────────────────────

async function init() {
  editor.setGraph(graph);

  graph.addListener(onGraphEvent);

  // Load from URL if available
  const loaded = await loadFromUrl();
  if (loaded) {
    graph.fromJSON(loaded, registry);
    for (const pipe of graph.pipes.values()) {
      editor.addPipeElement(pipe);
    }
    editor.updateConnections();
    await graph.processAll();
    editor.fitView();
  }

  if (graph.pipes.size === 0) {
    const inputPipe = createPipe('InputPipe');
    if (inputPipe) {
      inputPipe.position.x = 60;
      inputPipe.position.y = 80;
      graph.addPipe(inputPipe);
      editor.addPipeElement(inputPipe);
      editor.updateConnections();
      await graph.processFrom(inputPipe.id);
      editor.fitView();
    }
  }

  // Wire toolbar buttons
  document.getElementById('btn-add-pipe').addEventListener('click', () => openAddPipeDialog());
  document.getElementById('btn-save').addEventListener('click', onSave);
  document.getElementById('btn-load').addEventListener('click', onLoad);
  document.getElementById('btn-clear').addEventListener('click', onClear);
  document.getElementById('btn-zoom-fit').addEventListener('click', () => editor.fitView());

  // Data view toggle
  btnViewText.addEventListener('click', () => setViewMode('text'));
  btnViewHex.addEventListener('click',  () => setViewMode('hex'));

  // Graph editor events
  editor.addEventListener('pipe-port-click',   onPortClick);
  editor.addEventListener('pipe-config-click', onConfigClick);
  editor.addEventListener('pipe-select',        onPipeSelect);
  editor.addEventListener('connection-click',   onConnectionClick);

  // Add Pipe dialog setup
  initAddPipeDialog();
  initConfigDialog();
  initConnActionPopover();

  // Toast container
  const toast = document.createElement('div');
  toast.className = 'toast-container';
  toast.id = 'toast-container';
  document.body.appendChild(toast);
}

// ── Graph events ─────────────────────────────────────────────────

function onGraphEvent(event) {
  if (event.type === 'pipe-processed' || event.type === 'processed') {
    refreshDataViewer();
  }
}

function refreshDataViewer() {
  if (!selectedPort) return;
  const pipe = graph.pipes.get(selectedPort.pipeId);
  if (!pipe) return;

  let data;
  if (selectedPort.portType === 'output') {
    data = pipe.getOutputData(selectedPort.portName);
  } else {
    data = pipe.getInputData(selectedPort.portName);
  }

  dataViewer.setData(data, selectedPort.portName);
  dataPanelTitle.textContent =
    `${pipe.displayName} · ${selectedPort.portType}: ${selectedPort.portName}` +
    (data ? ` (${data.length} bytes)` : ' (no data)');
}

// ── Port click ───────────────────────────────────────────────────

function onPortClick(e) {
  const { pipeId, portName, portType } = e.detail;
  selectedPort = { pipeId, portName, portType };
  refreshDataViewer();
}

// ── Pipe select ──────────────────────────────────────────────────

function onPipeSelect(e) {
  const { pipeId } = e.detail;
  // Auto-show output data when selecting a pipe
  const pipe = graph.pipes.get(pipeId);
  if (!pipe) return;
  const outName = pipe.defaultOutputName;
  if (outName) {
    selectedPort = { pipeId, portName: outName, portType: 'output' };
    refreshDataViewer();
  }
}

// ── Connection action popover ────────────────────────────────────

/**
 * Creates and attaches the floating connection-action popover to the document.
 * The popover shows Delete and Add Pipe actions for the clicked connection.
 */
function initConnActionPopover() {
  const popover = document.createElement('div');
  popover.className = 'conn-action-popover';
  popover.style.display = 'none';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm btn-danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_connActionTarget) {
      graph.disconnectById(_connActionTarget.id);
      editor.updateConnections();
      _connActionTarget = null;
    }
    hideConnActionPopover();
  });

  const addPipeBtn = document.createElement('button');
  addPipeBtn.className = 'btn btn-sm btn-primary';
  addPipeBtn.textContent = 'Add Pipe';
  addPipeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const conn = _connActionTarget;
    _connActionTarget = null;
    hideConnActionPopover();
    openAddPipeDialog({
      input: conn ? { pipeId: conn.fromPipeId, portName: conn.fromOutput } : null,
      output: conn ? { pipeId: conn.toPipeId, portName: conn.toInput } : null,
      replacedConnection: conn,
    });
  });

  popover.appendChild(deleteBtn);
  popover.appendChild(addPipeBtn);
  document.body.appendChild(popover);
  _connActionPopover = popover;

  // Close popover when clicking outside of it
  document.addEventListener('click', (e) => {
    if (_connActionPopover && _connActionPopover.style.display !== 'none' &&
        !_connActionPopover.contains(e.target)) {
      hideConnActionPopover();
    }
  }, true);
}

/**
 * Shows the connection action popover near the given viewport coordinates.
 * @param {number} clientX
 * @param {number} clientY
 * @param {import('./pipes/graph.js').Connection} conn
 */
function showConnActionPopover(clientX, clientY, conn) {
  if (!_connActionPopover) return;
  _connActionTarget = conn;

  // Show at the click offset first, then measure and clamp within the viewport
  _connActionPopover.style.left = `${clientX + 6}px`;
  _connActionPopover.style.top  = `${clientY + 6}px`;
  _connActionPopover.style.display = '';

  const pw = _connActionPopover.offsetWidth;
  const ph = _connActionPopover.offsetHeight;
  _connActionPopover.style.left = `${Math.min(clientX + 6, window.innerWidth  - pw - 8)}px`;
  _connActionPopover.style.top  = `${Math.min(clientY + 6, window.innerHeight - ph - 8)}px`;
}

/** Hides the connection action popover. */
function hideConnActionPopover() {
  if (_connActionPopover) _connActionPopover.style.display = 'none';
  _connActionTarget = null;
}

// ── Connection click (delete) ────────────────────────────────────

function onConnectionClick(e) {
  const { connection, clientX, clientY } = e.detail;
  showConnActionPopover(clientX, clientY, connection);
}

// ── Config dialog ─────────────────────────────────────────────────

let _configPipeId = null;

function initConfigDialog() {
  const dialog = document.getElementById('config-dialog');
  const deleteBtn = document.getElementById('config-delete-btn');
  deleteBtn.addEventListener('click', () => {
    if (_configPipeId) {
      graph.removePipe(_configPipeId);
      editor.removePipeElement(_configPipeId);
      _configPipeId = null;
      dialog.close();
    }
  });
}

function onConfigClick(e) {
  const { pipeId } = e.detail;
  const pipe = graph.pipes.get(pipeId);
  if (!pipe) return;

  _configPipeId = pipeId;
  const dialog = document.getElementById('config-dialog');
  const title = document.getElementById('config-dialog-title');
  const fields = document.getElementById('config-fields');

  title.textContent = `Configure: ${pipe.displayName}`;
  fields.innerHTML = '';

  const configEntries = [...pipe.configs.values()];
  if (configEntries.length === 0) {
    const p = document.createElement('p');
    p.style.color = 'var(--color-text-dim)';
    p.textContent = 'This pipe has no configuration.';
    fields.appendChild(p);
  }

  // Keep references to inputs for saving
  const inputs = new Map();

  for (const cfg of configEntries) {
    const field = document.createElement('div');
    field.className = 'config-field';

    const label = document.createElement('label');
    label.textContent = cfg.name;
    label.title = cfg.description;

    const desc = document.createElement('div');
    desc.className = 'field-desc';
    desc.textContent = cfg.description;

    let input;
    if (cfg.type === 'bytes') {
      // Show a file picker for binary data configs
      const wrapper = document.createElement('div');
      wrapper.className = 'config-file-picker';
      const fileNameDisplay = document.createElement('span');
      fileNameDisplay.className = 'config-file-name';
      const currentName = pipe.getConfig('fileName')?.value;
      fileNameDisplay.textContent = currentName || 'No file selected';
      const fileBtn = document.createElement('button');
      fileBtn.type = 'button';
      fileBtn.className = 'btn btn-sm';
      fileBtn.textContent = '📁 Choose File';
      // state tracks file data changes made within this dialog session
      const state = { base64: cfg.value || '', fileName: currentName || '' };
      fileBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.onchange = async () => {
          const file = fileInput.files[0];
          if (!file) return;
          const buffer = await file.arrayBuffer();
          state.base64 = FileInputPipe.bytesToBase64(new Uint8Array(buffer));
          state.fileName = file.name;
          fileNameDisplay.textContent = file.name;
        };
        fileInput.click();
      });
      wrapper.appendChild(fileNameDisplay);
      wrapper.appendChild(fileBtn);
      input = wrapper;
      inputs.set(cfg.name, { input, type: cfg.type, state });
      field.appendChild(label);
      field.appendChild(input);
      field.appendChild(desc);
      fields.appendChild(field);
      continue;
    } else if (cfg.type === 'select' && cfg.options) {
      input = document.createElement('select');
      for (const opt of cfg.options) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === cfg.value) o.selected = true;
        input.appendChild(o);
      }
    } else if (cfg.type === 'boolean') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(cfg.value);
    } else if (cfg.type === 'text') {
      input = document.createElement('textarea');
      input.value = String(cfg.value);
      input.rows = 4;
    } else {
      input = document.createElement('input');
      input.type = cfg.type === 'number' ? 'number' : 'text';
      input.value = String(cfg.value);
    }

    inputs.set(cfg.name, { input, type: cfg.type, state: null });
    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(desc);
    fields.appendChild(field);
  }

  dialog.showModal();

  // On OK
  dialog.addEventListener('close', function handler() {
    dialog.removeEventListener('close', handler);
    if (dialog.returnValue === 'ok') {
      for (const [name, { input, type, state }] of inputs) {
        let value;
        if (type === 'boolean') value = input.checked;
        else if (type === 'number') value = Number(input.value);
        else if (type === 'bytes') {
          pipe.setConfig(name, state.base64);
          // FileInputPipe convention: the 'fileData' bytes config is paired with
          // a 'fileName' string config that tracks the human-readable file name.
          if (name === 'fileData' && pipe.getConfig('fileName') !== undefined) {
            pipe.setConfig('fileName', state.fileName);
          }
          continue;
        } else value = input.value;
        pipe.setConfig(name, value);
      }
      // Re-run from this pipe
      graph.processFrom(pipeId).catch(console.error);
      editor.updatePipeElement(pipe);
    }
    _configPipeId = null;
  }, { once: true });
}

// ── View mode ────────────────────────────────────────────────────

function setViewMode(mode) {
  viewMode = mode;
  btnViewText.classList.toggle('active', mode === 'text');
  btnViewHex.classList.toggle('active', mode === 'hex');
  dataViewer.setMode(mode);
}

// ── Add Pipe dialog ───────────────────────────────────────────────

function initAddPipeDialog() {
  const searchInput = document.getElementById('pipe-search-input');
  searchInput.addEventListener('input', filterPipeList);
  renderPipeList('');

  const dialog = document.getElementById('add-pipe-dialog');
  dialog.addEventListener('close', () => { _addPipeContext = null; });
}

function renderPipeList(query) {
  const list = document.getElementById('pipe-list');
  list.innerHTML = '';
  const q = query.toLowerCase();
  const inputData = _addPipeContext?.inputData ?? null;
  const pipes = [...getPipesByCategory().values()]
    .flat()
    .filter(pipe =>
      !q ||
      pipe.typeDescription.toLowerCase().includes(q) ||
      pipe.typeName.toLowerCase().includes(q) ||
      pipe.categoryDescription.toLowerCase().includes(q))
    .map((pipe, index) => ({
      ...pipe,
      index,
      appropriateness: Math.max(
        -10,
        Math.min(10, pipe.cls.getInputAppropriateness(inputData))
      ),
    }))
    .sort((a, b) => b.appropriateness - a.appropriateness || a.index - b.index);

  for (const pipe of pipes) {
    const item = document.createElement('div');
    item.className = 'pipe-list-item';

    const name = document.createElement('div');
    name.className = 'pipe-list-item-name';
    name.textContent = pipe.typeDescription;

    const desc = document.createElement('div');
    desc.className = 'pipe-list-item-desc';
    desc.textContent = pipe.categoryDescription;

    item.appendChild(name);
    item.appendChild(desc);
    item.addEventListener('click', () => addPipe(pipe.typeName));
    list.appendChild(item);
  }
}

function filterPipeList(e) {
  renderPipeList(e.target.value);
}

function openAddPipeDialog(context = null) {
  const dialog = document.getElementById('add-pipe-dialog');
  const searchInput = document.getElementById('pipe-search-input');
  if (context == null) {
    const lastPipe = graph.getLastPipe();
    context = {
      input: lastPipe ? { pipeId: lastPipe.id, portName: lastPipe.defaultOutputName } : null,
      output: null,
      replacedConnection: null,
    };
  }
  context.inputData = context.input
    ? graph.pipes.get(context.input.pipeId)?.getOutputData(context.input.portName) ?? null
    : null;
  _addPipeContext = context;
  searchInput.value = '';
  renderPipeList('');
  dialog.showModal();
  searchInput.focus();
}

function addPipe(typeName) {
  const dialog = document.getElementById('add-pipe-dialog');

  // Capture and clear the context before close synchronously fires its handler.
  const context = _addPipeContext;
  _addPipeContext = null;
  dialog.close();

  const pipe = createPipe(typeName);
  if (!pipe) return;

  const insertBetween = context?.replacedConnection;
  if (insertBetween) {
    // Insert new pipe between the two endpoints of the stored connection
    const conn = insertBetween;

    const fromPipe = graph.pipes.get(conn.fromPipeId);
    const toPipe   = graph.pipes.get(conn.toPipeId);

    // Position new pipe midway between the two connected pipes
    if (fromPipe && toPipe) {
      pipe.position.x = (fromPipe.position.x + toPipe.position.x) / 2;
      pipe.position.y = (fromPipe.position.y + toPipe.position.y) / 2;
    } else if (fromPipe) {
      pipe.position.x = fromPipe.position.x + 200;
      pipe.position.y = fromPipe.position.y;
    } else {
      pipe.position.x = 60;
      pipe.position.y = 80;
    }

    graph.addPipe(pipe);
    editor.addPipeElement(pipe);

    // Remove the original direct connection
    graph.disconnectById(conn.id);

    // Connect: upstream output → new pipe input
    if (fromPipe && pipe.defineInputs().length > 0) {
      graph.connect(conn.fromPipeId, conn.fromOutput, pipe.id, pipe.defaultInputName);
    }

    // Connect: new pipe output → downstream input
    if (toPipe && pipe.defineOutputs().length > 0) {
      graph.connect(pipe.id, pipe.defaultOutputName, conn.toPipeId, conn.toInput);
    }

    editor.updateConnections();
    if (fromPipe) {
      graph.processFrom(conn.fromPipeId).catch(console.error);
    }
    return;
  }

  // Normal case: position to the right of the last pipe
  const inputPipe = context?.input ? graph.pipes.get(context.input.pipeId) : null;
  if (inputPipe) {
    pipe.position.x = inputPipe.position.x + 200;
    pipe.position.y = inputPipe.position.y;
  } else {
    pipe.position.x = 60;
    pipe.position.y = 80;
  }

  graph.addPipe(pipe);
  editor.addPipeElement(pipe);

  // Auto-connect to the input captured when the dialog was opened.
  if (inputPipe && context?.input && pipe.defineInputs().length > 0) {
    const conn = graph.connect(
      inputPipe.id, context.input.portName,
      pipe.id, pipe.defaultInputName
    );
    if (conn) {
      editor.updateConnections();
      graph.processFrom(inputPipe.id).catch(console.error);
    }
  } else if (typeName === 'InputPipe') {
    // Process immediately for input pipes
    graph.processFrom(pipe.id).catch(console.error);
  }

  editor.updateConnections();
}

// ── Save/Load ────────────────────────────────────────────────────

async function onSave() {
  try {
    const url = await saveToUrl(graph.toJSON());
    await navigator.clipboard.writeText(url);
    showToast('URL copied to clipboard!', 'success');
  } catch (e) {
    console.error('Save failed:', e);
    showToast('Save failed: ' + e.message, 'error');
  }
}

async function onLoad() {
  const url = prompt('Paste a saved URL to load:');
  if (!url) return;
  try {
    new URL(url); // validate
    window.location.href = url;
  } catch {
    showToast('Invalid URL', 'error');
  }
}

function onClear() {
  if (!confirm('Clear the entire graph?')) return;
  const ids = [...graph.pipes.keys()];
  for (const id of ids) {
    graph.removePipe(id);
    editor.removePipeElement(id);
  }
  editor.updateConnections();
  selectedPort = null;
  dataViewer.setData(null, '');
  dataPanelTitle.textContent = 'Select a pipe port to view data';

  // Clear URL state
  const url = new URL(window.location.href);
  url.searchParams.delete('g');
  url.searchParams.delete('gid');
  window.history.replaceState({}, '', url.toString());
}

// ── Toast ────────────────────────────────────────────────────────

function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Bootstrap ────────────────────────────────────────────────────

init().catch(console.error);

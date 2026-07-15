/**
 * app.js — Entry point for Encode-O-Matic 2.
 *
 * Initializes the graph, UI, and wires everything together.
 */

import { PipeGraph } from './pipes/graph.js';
import { registry, createPipe, getPipesByCategory } from './pipes/registry.js';
import { WorkerPool } from './worker/worker-pool.js';
import { saveToUrl, loadFromUrl } from './state.js';
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

  // Wire toolbar buttons
  document.getElementById('btn-add-pipe').addEventListener('click', openAddPipeDialog);
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

// ── Connection click (delete) ────────────────────────────────────

function onConnectionClick(e) {
  const { connection } = e.detail;
  if (confirm(`Remove connection from ${connection.fromOutput} → ${connection.toInput}?`)) {
    graph.disconnectById(connection.id);
    editor.updateConnections();
  }
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
    if (cfg.type === 'select' && cfg.options) {
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

    inputs.set(cfg.name, { input, type: cfg.type });
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
      for (const [name, { input, type }] of inputs) {
        let value;
        if (type === 'boolean') value = input.checked;
        else if (type === 'number') value = Number(input.value);
        else value = input.value;
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
}

function renderPipeList(query) {
  const list = document.getElementById('pipe-list');
  list.innerHTML = '';
  const groups = getPipesByCategory();
  const q = query.toLowerCase();

  for (const [category, pipes] of groups) {
    const filtered = q
      ? pipes.filter(p =>
          p.typeDescription.toLowerCase().includes(q) ||
          p.typeName.toLowerCase().includes(q) ||
          p.categoryDescription.toLowerCase().includes(q))
      : pipes;

    if (filtered.length === 0) continue;

    const catEl = document.createElement('div');
    catEl.className = 'pipe-category';
    catEl.textContent = category;
    list.appendChild(catEl);

    for (const pipe of filtered) {
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
}

function filterPipeList(e) {
  renderPipeList(e.target.value);
}

function openAddPipeDialog() {
  const dialog = document.getElementById('add-pipe-dialog');
  const searchInput = document.getElementById('pipe-search-input');
  searchInput.value = '';
  renderPipeList('');
  dialog.showModal();
  searchInput.focus();
}

function addPipe(typeName) {
  const dialog = document.getElementById('add-pipe-dialog');
  dialog.close();

  const pipe = createPipe(typeName);
  if (!pipe) return;

  // Position: auto-place to the right of the last pipe
  const lastPipe = graph.getLastPipe();
  if (lastPipe) {
    pipe.position.x = lastPipe.position.x + 200;
    pipe.position.y = lastPipe.position.y;
  } else {
    pipe.position.x = 60;
    pipe.position.y = 80;
  }

  graph.addPipe(pipe);
  editor.addPipeElement(pipe);

  // Auto-connect to last pipe's default output
  if (lastPipe && pipe.defineInputs().length > 0) {
    const conn = graph.connect(
      lastPipe.id, lastPipe.defaultOutputName,
      pipe.id, pipe.defaultInputName
    );
    if (conn) {
      editor.updateConnections();
      graph.processFrom(lastPipe.id).catch(console.error);
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

/**
 * app.js — Entry point for Encode-O-Matic 2.
 *
 * Initializes the graph, UI, and wires everything together.
 */

import { PipeGraph } from './pipes/graph.js';
import {
  MIN_INPUT_APPROPRIATENESS,
  MAX_INPUT_APPROPRIATENESS,
} from './pipes/pipe.js';
import { registry, createPipe, getPipesByCategory } from './pipes/registry.js';
import { WorkerPool } from './worker/worker-pool.js';
import {
  saveToUrl,
  loadFromUrl,
  saveToIdb,
  loadFromIdb,
  listIdbSessions,
} from './state.js';
import { guessPipeChain } from './guess.js';
import { randomSessionName } from './session-name.js';
import { FileInputPipe } from './pipes/builtin/file-input-pipe.js';
import { APP_VERSION } from './version.js';
import './ui/graph-editor.js';
import './ui/data-viewer.js';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    const versionUrl = new URL('./version.js', import.meta.url);
    versionUrl.searchParams.set('cache', 'off');
    versionUrl.searchParams.set('v', Date.now());
    const { APP_VERSION: latestVersion } = await import(versionUrl.href);

    if (latestVersion !== APP_VERSION) {
      let refreshing = false;
      const reloadForUpdate = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', reloadForUpdate, { once: true });
      try {
        await registration.update();
        if (!registration.installing && !registration.waiting) {
          navigator.serviceWorker.removeEventListener('controllerchange', reloadForUpdate);
        }
      } catch (error) {
        navigator.serviceWorker.removeEventListener('controllerchange', reloadForUpdate);
        throw error;
      }
    }
  } catch (error) {
    console.warn('Service worker registration failed:', error);
  }
}

registerServiceWorker();

// ── App state ────────────────────────────────────────────────────

const graph = new PipeGraph();

// Worker pool URL: relative to index.html, points at pipe-worker.js
const WORKER_URL = new URL('./src/worker/pipe-worker.js', window.location.href).href;
const workerPool = new WorkerPool(WORKER_URL);
graph.setWorkerPool(workerPool);

/** @type {import('./ui/graph-editor.js').GraphEditor} */
const editor = document.getElementById('graph-editor');

const dataPanel = document.getElementById('data-panel');
const dataPanelResizer = document.getElementById('data-panel-resizer');
const dataViewStack = document.getElementById('data-view-stack');

/** @type {Map<string, {
 *   pipeId: string,
 *   portName: string,
 *   portType: string,
 *   pinned: boolean,
 *   minimized: boolean,
 *   mode: 'text'|'hex',
 *   element: HTMLElement,
 *   title: HTMLElement,
 *   errors: HTMLElement,
 *   viewer: import('./ui/data-viewer.js').DataViewer,
 *   pinButton: HTMLButtonElement,
 *   minimizeButton: HTMLButtonElement,
 *   modeButton: HTMLButtonElement
 * }>} */
const dataViews = new Map();
let activeSelections = new Map();
let selectionRefreshFrame = null;
let selectedPipeId = null;

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
 *   sourceData?: Uint8Array|null
 * }|null}
 */
let _addPipeContext = null;
let _urlUpdateTimer = null;
let _suspendUrlUpdates = false;

// ── Initialize ───────────────────────────────────────────────────

async function init() {
  editor.setGraph(graph);
  initZoomControl();
  document.getElementById('session-name').value = randomSessionName();
  initDataPanelResizer();

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

  // Wire toolbar controls
  document.getElementById('btn-share').addEventListener('click', onShare);
  document.getElementById('btn-clear').addEventListener('click', onClear);
  document.getElementById('btn-session-save').addEventListener('click', onSaveSession);
  document.getElementById('btn-guess').addEventListener('click', openGuessDialog);
  document.getElementById('btn-zoom-fit').addEventListener('click', () => editor.fitView());
  initSessionMenu();

  // Graph editor events
  editor.addEventListener('pipe-port-click',   onPortClick);
  editor.addEventListener('pipe-config-click', onConfigClick);
  editor.addEventListener('pipe-select',        onPipeSelect);
  editor.addEventListener('graph-background-click', onGraphBackgroundClick);
  editor.addEventListener('connection-click',   onConnectionClick);
  editor.addEventListener('graph-change', scheduleUrlUpdate);
  editor.addEventListener('add-pipe-request',   onAddPipeRequest);

  // Add Pipe dialog setup
  initAddPipeDialog();
  initConfigDialog();
  initConnActionPopover();
  initGuessDialog();

  // Toast container
  const toast = document.createElement('div');
  toast.className = 'toast-container';
  toast.id = 'toast-container';
  document.body.appendChild(toast);
  scheduleUrlUpdate();
}

function initDataPanelResizer() {
  const resizeStep = 20;
  let startX = 0;
  let startWidth = 0;

  function widthBounds() {
    const mobile = window.matchMedia?.('(max-width: 640px)').matches ?? false;
    return {
      min: mobile ? 240 : 280,
      max: window.innerWidth * (mobile ? 0.75 : 0.5),
    };
  }

  function currentWidth() {
    // Hidden panels have no layout width, so fall back to their computed width
    // and finally the stylesheet's default custom property.
    return dataPanel.getBoundingClientRect().width
      || Number.parseFloat(getComputedStyle(dataPanel).width)
      || Number.parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--data-panel-width'));
  }

  function setWidth(width) {
    const bounds = widthBounds();
    const nextWidth = Math.round(Math.min(bounds.max, Math.max(bounds.min, width)));
    dataPanel.style.width = `${nextWidth}px`;
    dataPanelResizer.setAttribute('aria-valuemin', String(bounds.min));
    dataPanelResizer.setAttribute('aria-valuemax', String(Math.round(bounds.max)));
    dataPanelResizer.setAttribute('aria-valuenow', String(nextWidth));
  }

  dataPanelResizer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    startX = event.clientX;
    startWidth = currentWidth();
    dataPanelResizer.setPointerCapture(event.pointerId);
    dataPanelResizer.classList.add('dragging');
    event.preventDefault();
  });

  dataPanelResizer.addEventListener('pointermove', (event) => {
    if (!dataPanelResizer.hasPointerCapture(event.pointerId)) return;
    setWidth(startWidth + startX - event.clientX);
  });

  dataPanelResizer.addEventListener('lostpointercapture', () => {
    dataPanelResizer.classList.remove('dragging');
  });

  dataPanelResizer.addEventListener('keydown', (event) => {
    let width = currentWidth();
    if (event.key === 'ArrowLeft') width += resizeStep;
    else if (event.key === 'ArrowRight') width -= resizeStep;
    else if (event.key === 'Home') width = widthBounds().min;
    else if (event.key === 'End') width = widthBounds().max;
    else return;
    setWidth(width);
    event.preventDefault();
  });

  setWidth(currentWidth());
}

// ── Graph events ─────────────────────────────────────────────────

function onGraphEvent(event) {
  scheduleUrlUpdate();
  if (event.type === 'pipe-removed') {
    removeDataView(event.pipeId);
    return;
  }
  if (event.type === 'pipe-processed' || event.type === 'processed') {
    refreshDataViews();
  }
}

function scheduleUrlUpdate() {
  if (_suspendUrlUpdates) return;
  clearTimeout(_urlUpdateTimer);
  _urlUpdateTimer = setTimeout(() => {
    saveToUrl(graph.toJSON()).catch(error => {
      console.error('URL update failed:', error);
      showToast('Could not update the URL', 'error');
    });
  }, 100);
}

function initSessionMenu() {
  const button = document.getElementById('btn-session-menu');
  const menu = document.getElementById('session-menu');
  const loadButton = document.getElementById('btn-session-load');
  const loadMenu = document.getElementById('session-load-menu');
  const close = () => {
    menu.hidden = true;
    loadMenu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    loadButton.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', event => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
  });

  loadButton.addEventListener('click', async event => {
    event.stopPropagation();
    loadMenu.hidden = !loadMenu.hidden;
    loadButton.setAttribute('aria-expanded', String(!loadMenu.hidden));
    if (!loadMenu.hidden) await refreshSessionLoadMenu();
  });

  for (const id of ['btn-session-save', 'btn-guess', 'btn-clear']) {
    document.getElementById(id).addEventListener('click', close);
  }

  loadMenu.addEventListener('click', async event => {
    const item = event.target.closest('[data-session-name]');
    if (!item) return;
    await onLoadSession(item.dataset.sessionName);
    close();
  });

  document.addEventListener('click', event => {
    if (!menu.hidden && !menu.contains(event.target)) close();
  });
}

async function refreshSessionLoadMenu() {
  const loadMenu = document.getElementById('session-load-menu');
  const sessions = await listIdbSessions();
  loadMenu.replaceChildren();

  if (sessions.length === 0) {
    const empty = document.createElement('button');
    empty.type = 'button';
    empty.disabled = true;
    empty.textContent = 'No saved sessions';
    loadMenu.appendChild(empty);
    return;
  }

  for (const session of sessions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.role = 'menuitem';
    item.dataset.sessionName = session.name;
    item.textContent = session.name;
    loadMenu.appendChild(item);
  }
}

function initZoomControl() {
  const range = document.getElementById('zoom-range');
  const value = document.getElementById('zoom-value');
  range.addEventListener('input', () => editor.setZoom(range.value));
  editor.addEventListener('zoom-change', event => {
    range.value = String(event.detail.percent);
    value.value = `${event.detail.percent}%`;
    value.textContent = value.value;
  });
}

function refreshDataViews() {
  for (const view of dataViews.values()) {
    refreshDataView(view);
  }
}

function refreshDataView(view) {
  const pipe = graph.pipes.get(view.pipeId);
  if (!pipe) {
    removeDataView(view.pipeId);
    return;
  }
  let data;
  if (view.portType === 'output') {
    data = pipe.getOutputData(view.portName);
  } else {
    data = pipe.getInputData(view.portName);
  }

  view.viewer.setData(data, view.portName);
  const selectionKey = `${view.pipeId}:${view.portType}:${view.portName}`;
  const errorSelections = pipe.errors.flatMap(error => error.selections ?? []);
  view.viewer.setSelections(activeSelections.get(selectionKey) ??
    (view.portType === 'input' ? errorSelections : []));
  refreshDataViewErrors(view, pipe.errors);
  const portLabel = view.portName === view.portType
    ? view.portName
    : `${view.portType}: ${view.portName}`;
  view.title.textContent =
    `${pipe.displayName} · ${portLabel}` +
    (data ? ` (${data.length} bytes)` : ' (no data)');
  const editable = pipe.constructor.typeName === 'InputPipe' && view.portType === 'output';
  view.viewer.setEditable(editable, editable ? (bytes, mode) => {
    if (mode === 'text') {
      pipe.setConfig('text', new TextDecoder().decode(bytes));
      pipe.setConfig('rawBytes', null);
    } else {
      pipe.setConfig('rawBytes', [...bytes]);
      pipe.setConfig('text', new TextDecoder().decode(bytes));
    }
    editor.setInputText(pipe.id, pipe.getConfig('text').value);
    graph.processFrom(pipe.id).catch(console.error);
  } : null);
}

function refreshDataViewErrors(view, errors) {
  view.errors.replaceChildren();
  view.errors.hidden = errors.length === 0;
  for (const error of errors) {
    const item = document.createElement('div');
    item.className = 'data-view-error';
    const message = document.createElement('div');
    message.className = 'data-view-error-message';
    message.textContent = error.message;
    item.appendChild(message);

    const ranges = (error.selections ?? [])
      .filter(({ index, length }) => Number.isFinite(index) && Number.isFinite(length) && length > 0)
      .map(({ index, length }) => length === 1
        ? `byte ${index}`
        : `bytes ${index}-${index + length - 1}`);
    if (ranges.length > 0) {
      const locations = document.createElement('div');
      locations.className = 'data-view-error-locations';
      locations.textContent = `Trigger: ${ranges.join(', ')}`;
      item.appendChild(locations);
    }
    view.errors.appendChild(item);
  }
}

function createDataView(pipeId, portName, portType) {
  const element = document.createElement('section');
  element.className = 'data-view';

  const header = document.createElement('div');
  header.className = 'data-panel-header';
  const title = document.createElement('span');
  title.className = 'data-panel-title';
  const controls = document.createElement('div');
  controls.className = 'data-panel-controls';

  const modeButton = document.createElement('button');
  modeButton.className = 'btn btn-sm active';
  modeButton.textContent = 'Aa';
  modeButton.title = 'Switch to hex view';
  modeButton.setAttribute('aria-label', 'Text view; switch to hex');
  const pinButton = document.createElement('button');
  pinButton.className = 'btn btn-sm';
  pinButton.textContent = '📍';
  pinButton.title = 'Keep this view open';
  pinButton.setAttribute('aria-pressed', 'false');
  const minimizeButton = document.createElement('button');
  minimizeButton.className = 'btn btn-sm';
  minimizeButton.textContent = '_';
  minimizeButton.title = 'Minimize this view';
  minimizeButton.setAttribute('aria-pressed', 'false');
  minimizeButton.hidden = true;

  controls.append(modeButton, pinButton, minimizeButton);
  header.append(title, controls);
  const errors = document.createElement('div');
  errors.className = 'data-view-errors';
  errors.setAttribute('role', 'alert');
  errors.hidden = true;
  const viewer = document.createElement('data-viewer');
  element.append(header, errors, viewer);
  dataViewStack.appendChild(element);

  const view = {
    pipeId, portName, portType,
    pinned: false,
    minimized: false,
    mode: 'text',
    element, title, errors, viewer,
    pinButton, minimizeButton, modeButton,
  };
  viewer.addEventListener('selection-change', event => {
    activeSelections = graph.translateSelections(
      pipeId,
      view.portType,
      view.portName,
      event.detail.selections
    );
    if (selectionRefreshFrame === null) {
      selectionRefreshFrame = requestAnimationFrame(() => {
        selectionRefreshFrame = null;
        refreshDataViews();
      });
    }
  });
  modeButton.addEventListener('click', () =>
    setViewMode(view, view.mode === 'text' ? 'hex' : 'text'));
  pinButton.addEventListener('click', () => togglePinned(view));
  minimizeButton.addEventListener('click', () => toggleMinimized(view));
  dataViews.set(pipeId, view);
  updateDataPanelVisibility();
  return view;
}

function showDataView(pipeId, portName, portType) {
  if (selectedPipeId && selectedPipeId !== pipeId) {
    const previous = dataViews.get(selectedPipeId);
    if (previous && !previous.pinned) removeDataView(selectedPipeId);
  }

  selectedPipeId = pipeId;
  let view = dataViews.get(pipeId);
  if (!view) {
    view = createDataView(pipeId, portName, portType);
  } else {
    view.portName = portName;
    view.portType = portType;
    if (view.minimized) toggleMinimized(view);
  }
  refreshDataView(view);
}

function removeDataView(pipeId) {
  const view = dataViews.get(pipeId);
  if (!view) return;
  view.element.remove();
  dataViews.delete(pipeId);
  if (selectedPipeId === pipeId) selectedPipeId = null;
  updateDataPanelVisibility();
}

function updateDataPanelVisibility() {
  dataPanel.hidden = dataViews.size === 0;
}

function togglePinned(view) {
  const wasPinned = view.pinned;
  if (wasPinned && view.pipeId !== selectedPipeId) {
    removeDataView(view.pipeId);
    return;
  }
  if (wasPinned && view.minimized) toggleMinimized(view);
  view.pinned = !wasPinned;
  view.pinButton.classList.toggle('active', view.pinned);
  view.pinButton.textContent = view.pinned ? '📌' : '📍';
  view.pinButton.setAttribute('aria-pressed', String(view.pinned));
  view.pinButton.title = view.pinned ? 'Allow this view to close' : 'Keep this view open';
  view.minimizeButton.hidden = !view.pinned;
}

function toggleMinimized(view) {
  view.minimized = !view.minimized;
  view.element.classList.toggle('minimized', view.minimized);
  view.minimizeButton.classList.toggle('active', view.minimized);
  view.minimizeButton.setAttribute('aria-pressed', String(view.minimized));
  view.minimizeButton.textContent = view.minimized ? '□' : '_';
  view.minimizeButton.title = view.minimized ? 'Restore this view' : 'Minimize this view';
}

// ── Port click ───────────────────────────────────────────────────

function onPortClick(e) {
  const { pipeId, portName, portType } = e.detail;
  showDataView(pipeId, portName, portType);
}

// ── Pipe select ──────────────────────────────────────────────────

function onPipeSelect(e) {
  const { pipeId } = e.detail;
  // Auto-show output data when selecting a pipe
  const pipe = graph.pipes.get(pipeId);
  if (!pipe) return;
  const outName = pipe.defaultOutputName;
  if (outName) {
    showDataView(pipeId, outName, 'output');
  }
}

function onGraphBackgroundClick() {
  if (!selectedPipeId) return;
  const selected = dataViews.get(selectedPipeId);
  selectedPipeId = null;
  if (selected && !selected.pinned) removeDataView(selected.pipeId);
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

  const configEntries = [...pipe.configs.values()].filter(cfg => cfg.type !== 'hidden');
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
      if (pipe.constructor.typeName === 'InputPipe') {
        pipe.setConfig('rawBytes', null);
        editor.setInputText(pipe.id, pipe.getConfig('text').value);
      }
      // Re-run from this pipe
      graph.processFrom(pipeId).catch(console.error);
      editor.updatePipeElement(pipe);
    }
    _configPipeId = null;
  }, { once: true });
}

// ── View mode ────────────────────────────────────────────────────

function setViewMode(view, mode) {
  view.mode = mode;
  view.modeButton.textContent = mode === 'text' ? 'Aa' : '0xFF';
  view.modeButton.title = mode === 'text' ? 'Switch to hex view' : 'Switch to text view';
  view.modeButton.setAttribute(
    'aria-label',
    mode === 'text' ? 'Text view; switch to hex' : 'Hex view; switch to text'
  );
  view.viewer.setMode(mode);
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
  const inputData = _addPipeContext?.sourceData ?? null;
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
        MIN_INPUT_APPROPRIATENESS,
        Math.min(MAX_INPUT_APPROPRIATENESS, pipe.cls.getInputAppropriateness(inputData))
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

  context.sourceData = context.input
    ? graph.pipes.get(context.input.pipeId)?.getOutputData(context.input.portName) ?? null
    : null;
  _addPipeContext = context;
  searchInput.value = '';
  renderPipeList('');
  dialog.showModal();
  searchInput.focus();
}

function onAddPipeRequest(e) {
  openAddPipeDialog({
    input: e.detail.input,
    position: e.detail.position,
  });
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
  if (context?.position) {
    pipe.position.x = context.position.x;
    pipe.position.y = context.position.y;
  } else if (inputPipe) {
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

// ── Sharing and sessions ─────────────────────────────────────────

async function onShare() {
  try {
    const url = await saveToUrl(graph.toJSON());
    if (navigator.share) {
      await navigator.share({ title: document.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    showToast('URL copied to clipboard!', 'success');
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Share failed:', e);
    showToast('Share failed: ' + e.message, 'error');
  }
}

async function onSaveSession() {
  const input = document.getElementById('session-name');
  const name = input.value.trim();
  if (!name) {
    showToast('Enter a session name', 'error');
    input.focus();
    return;
  }
  input.value = name;
  try {
    const existing = (await listIdbSessions()).some(session => session.name === name);
    if (existing && !confirm(`Replace the saved session "${name}"?`)) return;
    await saveToIdb(name, graph.toJSON());
    await refreshSessionLoadMenu();
    showToast(`Saved session "${name}"`, 'success');
  } catch (e) {
    console.error('Session save failed:', e);
    showToast('Session save failed: ' + e.message, 'error');
  }
}

async function onLoadSession(name) {
  try {
    const data = await loadFromIdb(name);
    if (!data) {
      showToast(`Session "${name}" was not found`, 'error');
      return;
    }
    await replaceGraph(data);
    document.getElementById('session-name').value = name;
    showToast(`Loaded session "${name}"`, 'success');
  } catch (e) {
    console.error('Session load failed:', e);
    showToast('Session load failed: ' + e.message, 'error');
  }
}

function initGuessDialog() {
  const dialog = document.getElementById('guess-dialog');
  const input = document.getElementById('guess-input');
  document.getElementById('guess-cancel').addEventListener('click', () => dialog.close());
  document.getElementById('guess-form').addEventListener('submit', event => {
    event.preventDefault();
    const value = input.value;
    if (!value) return;
    dialog.close();
    onGuessEncoding(value);
  });
}

function openGuessDialog() {
  const input = document.getElementById('guess-input');
  input.value = '';
  document.getElementById('guess-dialog').showModal();
  input.focus();
}

async function onGuessEncoding(input) {
  try {
    const chain = await guessPipeChain(new TextEncoder().encode(input), registry.values());
    _suspendUrlUpdates = true;
    clearGraphWithoutConfirmation();

    const inputPipe = createPipe('InputPipe');
    inputPipe.setConfig('text', input);
    inputPipe.position = { x: 60, y: 80 };
    graph.addPipe(inputPipe);
    editor.addPipeElement(inputPipe);

    let previous = inputPipe;
    for (const [index, step] of chain.entries()) {
      const pipe = createPipe(step.typeName);
      pipe.position = { x: 260 + index * 200, y: 80 };
      graph.addPipe(pipe);
      editor.addPipeElement(pipe);
      graph.connect(previous.id, previous.defaultOutputName, pipe.id, pipe.defaultInputName);
      previous = pipe;
    }

    editor.updateConnections();
    await graph.processAll();
    editor.fitView();
    showToast(
      chain.length > 0
        ? `Guessed ${chain.length} pipe${chain.length === 1 ? '' : 's'}`
        : 'No shortening decode pipes found',
      chain.length > 0 ? 'success' : ''
    );
  } catch (e) {
    console.error('Encoding guess failed:', e);
    showToast('Encoding guess failed: ' + e.message, 'error');
  } finally {
    _suspendUrlUpdates = false;
    scheduleUrlUpdate();
  }
}

async function replaceGraph(data) {
  _suspendUrlUpdates = true;
  try {
    clearGraphWithoutConfirmation();
    graph.fromJSON(data, registry);
    for (const pipe of graph.pipes.values()) editor.addPipeElement(pipe);
    editor.updateConnections();
    await graph.processAll();
    editor.fitView();
  } finally {
    _suspendUrlUpdates = false;
    scheduleUrlUpdate();
  }
}

function onClear() {
  if (!confirm('Clear the entire graph?')) return;
  clearGraphWithoutConfirmation();
  document.getElementById('session-name').value = randomSessionName();
  scheduleUrlUpdate();
}

function clearGraphWithoutConfirmation() {
  const ids = [...graph.pipes.keys()];
  for (const id of ids) {
    graph.removePipe(id);
    editor.removePipeElement(id);
  }
  editor.updateConnections();
  for (const id of Array.from(dataViews.keys())) removeDataView(id);
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

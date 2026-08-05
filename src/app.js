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
  saveAutosession,
  loadAutosession,
  listDefaultSessions,
  loadDefaultSession,
} from './state.js';
import { guessPipeChain } from './guess.js';
import { randomSessionName } from './session-name.js';
import { DEFAULT_SESSION, DEFAULT_SESSION_NAME } from './default-session.js';
import { FileInputPipe } from './pipes/builtin/file-input-pipe.js';
import { APP_COMMIT } from './version.js';
import { getInstallPrompt, clearInstallPrompt, isInstalledPWA } from './services/install.js';
import './ui/graph-editor.js';
import './ui/data-viewer.js';
import { cloneTemplate } from './ui/templates.js';
import { showToast } from './ui/toast.js';
import { wireMoveButton, initDragSort } from './ui/drag-sort.js';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (error) {
    console.warn('Service worker registration failed:', error);
    return null;
  }
}

const serviceWorkerRegistrationPromise = registerServiceWorker();

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

/**
 * Unified sidebar view registry.
 * Keyed by `${pipeId}:data` or `${pipeId}:config`.
 * All views share: pipeId, type, pinned, minimized, element, title,
 * pinButton, minimizeButton, moveButton.
 * Data views additionally carry: portName, portType, mode, errors, viewer,
 * copyButton, modeButton.
 * Config views additionally carry: fields.
 * @type {Map<string, object>}
 */
const sidebarViews = new Map();
let activeSelections = new Map();
let selectionRefreshFrame = null;
let selectedPipeId = null;
let deletePipeMode = false;
let selectedConfigPipeId = null;

/** Current layout mode: 'both' | 'graph' | 'data' */
let layoutMode = 'both';

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
  initHeaderInteractionGuards();
  document.getElementById('session-name').value = randomSessionName();
  initDataPanelResizer();

  graph.addListener(onGraphEvent);

  // Load from URL if available, otherwise restore the last autosaved session
  const loaded = await loadFromUrl();
  if (loaded) {
    graph.fromJSON(loaded, registry);
    for (const pipe of graph.pipes.values()) {
      editor.addPipeElement(pipe);
    }

    editor.updateConnections();
    await graph.processAll();
    editor.fitView();
  } else {
    const autosaved = await loadAutosession().catch(() => null);
    if (autosaved) {
      graph.fromJSON(autosaved, registry);
      for (const pipe of graph.pipes.values()) {
        editor.addPipeElement(pipe);
      }
      editor.updateConnections();
      await graph.processAll();
      editor.fitView();
    } else {
      graph.fromJSON(DEFAULT_SESSION, registry);
      for (const pipe of graph.pipes.values()) {
        editor.addPipeElement(pipe);
      }
      editor.updateConnections();
      await graph.processAll();
      editor.fitView();
      document.getElementById('session-name').value = DEFAULT_SESSION_NAME;
    }
  }

  // Wire toolbar controls
  initAboutDialog();
  initLayoutToggle();
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
  editor.addEventListener('delete-pipe-mode-toggle', onDeletePipeModeToggle);

  // Add Pipe dialog setup
  initAddPipeDialog();
  initPaneViewReordering();
  initConnActionPopover();
  initGuessDialog();

  scheduleUrlUpdate();
}

function initHeaderInteractionGuards() {
  const header = document.querySelector('.app-header');
  if (!header) return;

  const preventHeaderZoom = (event) => {
    if (event.type === 'gesturestart' || event.type === 'gesturechange') {
      event.preventDefault();
      return;
    }

    if ((event.touches?.length ?? 0) > 1) {
      event.preventDefault();
    }
  };

  header.addEventListener('gesturestart', preventHeaderZoom);
  header.addEventListener('gesturechange', preventHeaderZoom);
  header.addEventListener('touchstart', preventHeaderZoom, { passive: false });
  header.addEventListener('touchmove', preventHeaderZoom, { passive: false });
}

function initLayoutToggle() {
  const appBody = document.querySelector('.app-body');
  const btnCycle = document.getElementById('btn-layout-cycle');
  const layoutLabels = {
    graph: 'Graph',
    both: 'Both',
    data: 'Data',
  };
  const layoutTitles = {
    graph: 'Show graph only',
    both: 'Show graph and data panel',
    data: 'Show data panel only',
  };
  const layoutModes = ['graph', 'both', 'data'];
  const layoutIcons = Object.fromEntries(layoutModes.map(mode => [
    mode,
    btnCycle?.querySelector(`[data-layout-icon="${mode}"]`),
  ]));

  function setLayout(mode) {
    layoutMode = mode;
    appBody.dataset.layout = mode;
    btnCycle.title = layoutTitles[mode];
    btnCycle.setAttribute('aria-label', `Switch layout. Current: ${layoutLabels[mode]}`);
    Object.entries(layoutIcons).forEach(([iconMode, iconEl]) => {
      if (iconEl) iconEl.hidden = iconMode !== mode;
    });
    updateDataPanelVisibility();
    if (mode !== 'data' && editor) editor.fitView();
  }
  btnCycle.addEventListener('click', () => {
    const currentIndex = layoutModes.indexOf(layoutMode);
    setLayout(layoutModes[(currentIndex + 1) % layoutModes.length]);
  });

  // Initialize app-body data attribute
  setLayout('both');
}

function initAboutDialog() {
  const dialog = document.getElementById('about-dialog');
  const updateButton = document.getElementById('btn-update');
  const checkUpdatesButton = document.getElementById('btn-check-updates');
  let availableVersion = null;
  let checkId = 0;
  const showAboutDialog = () => {
    dialog.showModal();
    checkForUpdates();
    updateInstallStatus();
  };

  document.getElementById('about-version').textContent = APP_COMMIT;
  document.querySelectorAll('[data-about-trigger]').forEach(button => {
    button.addEventListener('click', showAboutDialog);
  });
  updateButton.addEventListener('click', () => {
    if (availableVersion) {
      installUpdate();
    } else {
      checkForUpdates();
    }
  });
  checkUpdatesButton.addEventListener('click', () => {
    checkForUpdates();
  });

  async function checkForUpdates() {
    const currentCheck = ++checkId;
    const status = document.getElementById('update-status');
    availableVersion = null;
    status.className = 'update-status checking';
    status.textContent = 'Checking for updates…';
    updateButton.hidden = true;
    checkUpdatesButton.disabled = true;

    try {
      const versionUrl = new URL('./version.js', import.meta.url);
      versionUrl.searchParams.set('cache', 'off');
      const response = await fetch(versionUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Update check returned ${response.status}`);
      const versionSource = await response.text();
      const latestCommit = versionSource
        .match(/APP_COMMIT\s*=\s*['"]([^'"]+)['"]/)?.[1];
      if (!latestCommit) throw new Error('Update check returned an invalid commit');
      if (currentCheck !== checkId) return;

      checkUpdatesButton.disabled = false;
      if (latestCommit === APP_COMMIT) {
        status.className = 'update-status success';
        status.textContent = 'Encode-O-Matic 2 is up to date.';
        return;
      }

      availableVersion = latestCommit;
      status.className = 'update-status';
      status.textContent = 'A new version is available.';
      updateButton.textContent = 'Update';
      updateButton.hidden = false;
    } catch (error) {
      if (currentCheck !== checkId) return;
      console.warn('Update check failed:', error);
      checkUpdatesButton.disabled = false;
      status.className = 'update-status error';
      status.textContent = 'Could not check for updates.';
      updateButton.textContent = 'Try again';
      updateButton.hidden = false;
    }
  }

  async function installUpdate() {
    const status = document.getElementById('update-status');
    updateButton.hidden = true;
    status.className = 'update-status checking';
    status.textContent = 'Updating…';

    try {
      const registration = await serviceWorkerRegistrationPromise;
      if (!registration) {
        window.location.reload();
        return;
      }

      let reloaded = false;
      const doReload = () => { if (!reloaded) { reloaded = true; window.location.reload(); } };
      navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
      const updatedRegistration = await registration.update();
      status.textContent = 'Update downloaded. Reloading…';
      // If no new SW is installing or waiting, the update already activated in the
      // background (skipWaiting fired before the user clicked Update), so reload now.
      if (!updatedRegistration.installing && !updatedRegistration.waiting) {
        doReload();
        return;
      }
      // Fallback: reload after 15 s in case controllerchange never fires.
      setTimeout(doReload, 15000);
    } catch (error) {
      console.warn('Update failed:', error);
      status.className = 'update-status error';
      status.textContent = 'Could not install the update.';
      updateButton.textContent = 'Try again';
      updateButton.hidden = false;
    }
  }

  function updateInstallStatus() {
    const container = document.getElementById('install-status');

    if (isInstalledPWA()) {
      container.hidden = false;
      container.innerHTML = '';
      const pill = document.createElement('span');
      pill.className = 'install-pill install-pill--installed';
      pill.textContent = '✓ App installed';
      container.appendChild(pill);
      return;
    }

    const prompt = getInstallPrompt();
    if (prompt) {
      container.hidden = false;
      container.innerHTML = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'install-pill install-pill--action';
      btn.textContent = 'Install app';
      btn.addEventListener('click', async () => {
        btn.textContent = 'Installing…';
        btn.disabled = true;
        try {
          await prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome === 'accepted') {
            clearInstallPrompt();
            container.innerHTML = '';
            const donePill = document.createElement('span');
            donePill.className = 'install-pill install-pill--installed';
            donePill.textContent = '✓ App installed';
            container.appendChild(donePill);
          } else {
            btn.textContent = 'Install app';
            btn.disabled = false;
          }
        } catch {
          btn.textContent = 'Install app';
          btn.disabled = false;
        }
      });
      container.appendChild(btn);
      return;
    }

    container.hidden = true;
  }
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
      || Number.parseFloat(dataPanel.style.getPropertyValue('--data-panel-width'))
      || Number.parseFloat(getComputedStyle(dataPanel).width)
      || Number.parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--data-panel-width'));
  }

  function setWidth(width) {
    const bounds = widthBounds();
    const nextWidth = Math.round(Math.min(bounds.max, Math.max(bounds.min, width)));
    dataPanel.style.setProperty('--data-panel-width', `${nextWidth}px`);
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
    if (sidebarViews.has(sidebarKey(event.pipeId, 'config'))) removeConfigView(event.pipeId);
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
    const json = graph.toJSON();
    saveToUrl(json).catch(error => {
      console.error('URL update failed:', error);
      showToast('Could not update the URL', 'error');
    });
    saveAutosession(json).catch(error => {
      console.error('Autosave failed:', error);
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

  for (const id of ['btn-session-save', 'btn-guess', 'btn-session-share', 'btn-clear']) {
    document.getElementById(id).addEventListener('click', close);
  }

  document.getElementById('btn-session-share').addEventListener('click', onShare);

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
  const savedSessions = await listIdbSessions();
  const sessions = savedSessions.length > 0 ? savedSessions : listDefaultSessions();
  loadMenu.replaceChildren();

  if (sessions.length === 0) {
    const empty = cloneTemplate('session-menu-item-template');
    empty.disabled = true;
    empty.textContent = 'No saved sessions';
    loadMenu.appendChild(empty);
    return;
  }

  for (const session of sessions) {
    const item = cloneTemplate('session-menu-item-template');
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
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    const next = Math.max(Number(range.min), Number(range.value) - Number(range.step));
    editor.setZoom(next);
  });
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    const next = Math.min(Number(range.max), Number(range.value) + Number(range.step));
    editor.setZoom(next);
  });
}

function refreshDataViews() {
  for (const view of sidebarViews.values()) {
    if (view.type === 'data') refreshDataView(view);
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
    const item = cloneTemplate('data-view-error-template');
    const message = item.querySelector('.data-view-error-message');
    message.textContent = error.message;

    const ranges = (error.selections ?? [])
      .filter(({ index, length }) => Number.isFinite(index) && Number.isFinite(length) && length > 0)
      .map(({ index, length }) => length === 1
        ? `byte ${index}`
        : `bytes ${index}-${index + length - 1}`);
    if (ranges.length > 0) {
      const locations = item.querySelector('.data-view-error-locations');
      locations.hidden = false;
      locations.textContent = `Trigger: ${ranges.join(', ')}`;
    }
    view.errors.appendChild(item);
  }
}

function initPaneViewReordering() {
  initDragSort(dataViewStack, '.data-view');
}

function createDataView(pipeId, portName, portType) {
  const element = cloneTemplate('data-view-template');
  const title = element.querySelector('.data-panel-title');
  const errors = element.querySelector('.data-view-errors');
  const viewer = element.querySelector('data-viewer');
  const copyButton = element.querySelector('[data-action="copy"]');
  const moveButton = element.querySelector('[data-action="move"]');
  const modeButton = element.querySelector('[data-action="mode"]');
  const pinButton = element.querySelector('[data-action="pin"]');
  const minimizeButton = element.querySelector('[data-action="minimize"]');
  dataViewStack.appendChild(element);
  wireMoveButton(element, moveButton);

  const view = {
    pipeId, type: 'data', portName, portType,
    pinned: false,
    minimized: false,
    mode: 'text',
    element, title, errors, viewer,
    copyButton, pinButton, minimizeButton, modeButton, moveButton,
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
  copyButton.addEventListener('click', async () => {
    try {
      const copied = await view.viewer.copyToClipboard();
      if (copied) showToast('Copied to clipboard!', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  });
  modeButton.addEventListener('click', () =>
    setViewMode(view, view.mode === 'text' ? 'hex' : 'text'));
  pinButton.addEventListener('click', () => togglePinned(view));
  minimizeButton.addEventListener('click', () => toggleMinimized(view));
  sidebarViews.set(sidebarKey(pipeId, 'data'), view);
  updateDataPanelVisibility();
  return view;
}

function showDataView(pipeId, portName, portType) {
  if (selectedPipeId !== pipeId) {
    dismissUnpinned(sidebarViews.get(sidebarKey(selectedPipeId, 'data')));
  }
  dismissUnpinned(sidebarViews.get(sidebarKey(selectedConfigPipeId, 'config')));

  selectedPipeId = pipeId;
  let view = sidebarViews.get(sidebarKey(pipeId, 'data'));
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
  const view = sidebarViews.get(sidebarKey(pipeId, 'data'));
  if (!view) return;
  view.element.remove();
  sidebarViews.delete(sidebarKey(pipeId, 'data'));
  if (selectedPipeId === pipeId) selectedPipeId = null;
  updateDataPanelVisibility();
}

function updateDataPanelVisibility() {
  dataPanel.hidden = sidebarViews.size === 0 || layoutMode === 'graph';
}

/**
 * Returns the Map key for a sidebar view.
 * @param {string|null} pipeId
 * @param {'data'|'config'} type
 * @returns {string}
 */
function sidebarKey(pipeId, type) { return `${pipeId}:${type}`; }

/**
 * Unconditionally removes a sidebar view.
 * @param {{ type: 'data'|'config', pipeId: string }} view
 */
function dismissView(view) {
  if (view.type === 'data') removeDataView(view.pipeId);
  else removeConfigView(view.pipeId);
}

/**
 * Removes a sidebar view only if it is not pinned. Safe to call with undefined.
 * @param {{ type: 'data'|'config', pipeId: string, pinned: boolean }|undefined} view
 */
function dismissUnpinned(view) {
  if (!view || view.pinned) return;
  dismissView(view);
}

function togglePinned(view) {
  const wasPinned = view.pinned;
  const activeId = view.type === 'data' ? selectedPipeId : selectedConfigPipeId;
  if (wasPinned && view.pipeId !== activeId) {
    dismissView(view);
    return;
  }
  if (wasPinned && view.minimized) toggleMinimized(view);
  view.pinned = !wasPinned;
  view.pinButton.classList.toggle('active', view.pinned);
  view.pinButton.textContent = view.pinned ? '📌' : '📍';
  view.pinButton.setAttribute('aria-pressed', String(view.pinned));
  view.pinButton.title = view.pinned ? 'Allow this view to close' : 'Keep this view open';
  view.pinButton.setAttribute('aria-label', view.pinButton.title);
  view.minimizeButton.hidden = !view.pinned;
}

function toggleMinimized(view) {
  view.minimized = !view.minimized;
  view.element.classList.toggle('minimized', view.minimized);
  view.minimizeButton.classList.toggle('active', view.minimized);
  view.minimizeButton.setAttribute('aria-pressed', String(view.minimized));
  view.minimizeButton.textContent = view.minimized ? '□' : '_';
  view.minimizeButton.title = view.minimized ? 'Restore this view' : 'Minimize this view';
  view.minimizeButton.setAttribute('aria-label', view.minimizeButton.title);
}

// ── Port click ───────────────────────────────────────────────────

function onPortClick(e) {
  const { pipeId, portName, portType } = e.detail;
  showDataView(pipeId, portName, portType);
}

// ── Pipe select ──────────────────────────────────────────────────

function onPipeSelect(e) {
  const { pipeId } = e.detail;
  if (deletePipeMode) {
    const pipeToDelete = graph.pipes.get(pipeId);
    if (!pipeToDelete) return;
    const confirmed = window.confirm(`Delete "${pipeToDelete.displayName}"?`);
    if (confirmed) {
      const upstreamPipeIds = graph.connections
        .filter(c => c.toPipeId === pipeId)
        .map(c => c.fromPipeId);
      const downstreamPipeIds = graph.connections
        .filter(c => c.fromPipeId === pipeId)
        .map(c => c.toPipeId);
      graph.removePipe(pipeId);
      editor.removePipeElement(pipeId);
      if (sidebarViews.has(sidebarKey(pipeId, 'config'))) removeConfigView(pipeId);
      setDeletePipeMode(false);
      const reprocessIds = upstreamPipeIds.length > 0 ? upstreamPipeIds : downstreamPipeIds;
      for (const id of reprocessIds) {
        graph.processFrom(id).catch(console.error);
      }
    }
    return;
  }
  // Auto-show output data when selecting a pipe
  const pipe = graph.pipes.get(pipeId);
  if (!pipe) return;
  const outName = pipe.defaultOutputName;
  if (outName) {
    showDataView(pipeId, outName, 'output');
  }
}

function onGraphBackgroundClick() {
  const dataView = sidebarViews.get(sidebarKey(selectedPipeId, 'data'));
  selectedPipeId = null;
  dismissUnpinned(dataView);

  const configView = sidebarViews.get(sidebarKey(selectedConfigPipeId, 'config'));
  selectedConfigPipeId = null;
  dismissUnpinned(configView);
}

function onDeletePipeModeToggle(e) {
  setDeletePipeMode(e.detail.enabled);
}

function setDeletePipeMode(enabled) {
  deletePipeMode = Boolean(enabled);
  editor.setDeletePipeMode(deletePipeMode);
}

// ── Connection action popover ────────────────────────────────────

/**
 * Creates and attaches the floating connection-action popover to the document.
 * The popover shows Delete and Add Pipe actions for the clicked connection.
 */
function initConnActionPopover() {
  const popover = document.getElementById('conn-action-popover');
  const deleteBtn = popover.querySelector('[data-action="delete"]');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_connActionTarget) {
      graph.disconnectById(_connActionTarget.id);
      editor.updateConnections();
      _connActionTarget = null;
    }
    hideConnActionPopover();
  });

  const addPipeBtn = popover.querySelector('[data-action="add"]');
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

  _connActionPopover = popover;

  // Close popover when clicking outside of it
  document.addEventListener('click', (e) => {
    if (_connActionPopover && !_connActionPopover.hidden &&
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
  _connActionPopover.style.setProperty('--popover-x', `${clientX + 6}px`);
  _connActionPopover.style.setProperty('--popover-y', `${clientY + 6}px`);
  _connActionPopover.hidden = false;

  const pw = _connActionPopover.offsetWidth;
  const ph = _connActionPopover.offsetHeight;
  _connActionPopover.style.setProperty(
    '--popover-x',
    `${Math.min(clientX + 6, window.innerWidth - pw - 8)}px`
  );
  _connActionPopover.style.setProperty(
    '--popover-y',
    `${Math.min(clientY + 6, window.innerHeight - ph - 8)}px`
  );
}

/** Hides the connection action popover. */
function hideConnActionPopover() {
  if (_connActionPopover) _connActionPopover.hidden = true;
  _connActionTarget = null;
}

// ── Connection click (delete) ────────────────────────────────────

function onConnectionClick(e) {
  const { connection, clientX, clientY } = e.detail;
  showConnActionPopover(clientX, clientY, connection);
  showDataView(connection.fromPipeId, connection.fromOutput, 'output');
}

// ── Config pane ────────────────────────────────────────────────────

function onConfigClick(e) {
  const { pipeId } = e.detail;
  showConfigView(pipeId);
}

function showConfigView(pipeId) {
  const pipe = graph.pipes.get(pipeId);
  if (!pipe) return;

  if (selectedConfigPipeId !== pipeId) {
    dismissUnpinned(sidebarViews.get(sidebarKey(selectedConfigPipeId, 'config')));
  }

  selectedConfigPipeId = pipeId;
  let view = sidebarViews.get(sidebarKey(pipeId, 'config'));
  if (!view) {
    const element = cloneTemplate('config-view-template');
    const title = element.querySelector('.data-panel-title');
    const fields = element.querySelector('.config-fields');
    const moveButton = element.querySelector('[data-action="move"]');
    const pinButton = element.querySelector('[data-action="pin"]');
    const minimizeButton = element.querySelector('[data-action="minimize"]');
    dataViewStack.appendChild(element);
    wireMoveButton(element, moveButton);
    view = { pipeId, type: 'config', element, title, fields, moveButton, pinButton, minimizeButton, pinned: false, minimized: false };
    pinButton.addEventListener('click', () => togglePinned(view));
    minimizeButton.addEventListener('click', () => toggleMinimized(view));
    sidebarViews.set(sidebarKey(pipeId, 'config'), view);
  } else if (view.minimized) {
    toggleMinimized(view);
  }

  view.title.textContent = `Configure: ${pipe.displayName}`;
  view.fields.replaceChildren();
  renderConfigFields(pipe, view.fields);
  updateDataPanelVisibility();
}

function removeConfigView(pipeId) {
  const view = sidebarViews.get(sidebarKey(pipeId, 'config'));
  if (!view) return;
  view.element.remove();
  sidebarViews.delete(sidebarKey(pipeId, 'config'));
  if (selectedConfigPipeId === pipeId) selectedConfigPipeId = null;
  updateDataPanelVisibility();
}

function renderConfigFields(pipe, fields) {
  const configEntries = [...pipe.configs.values()].filter(cfg => cfg.type !== 'hidden');
  if (configEntries.length === 0) {
    fields.appendChild(cloneTemplate('config-empty-template'));
    return;
  }

  for (const cfg of configEntries) {
    const field = cloneTemplate('config-field-template');
    const label = field.querySelector('label');
    label.textContent = cfg.name;
    label.title = cfg.description;
    const desc = field.querySelector('.field-desc');
    desc.textContent = cfg.description;
    const control = field.querySelector('.config-control');

    if (cfg.type === 'bytes') {
      const wrapper = cloneTemplate('config-file-picker-template');
      const fileNameDisplay = wrapper.querySelector('.config-file-name');
      const currentName = pipe.getConfig('fileName')?.value;
      fileNameDisplay.textContent = currentName || 'No file selected';
      const fileBtn = wrapper.querySelector('button');
      fileBtn.addEventListener('click', () => {
        const fileInput = cloneTemplate('file-input-template');
        document.body.appendChild(fileInput);
        fileInput.addEventListener('cancel', () => fileInput.remove());
        fileInput.onchange = async () => {
          fileInput.remove();
          const file = fileInput.files[0];
          if (!file) return;
          const buffer = await file.arrayBuffer();
          const base64 = FileInputPipe.bytesToBase64(new Uint8Array(buffer));
          fileNameDisplay.textContent = file.name;
          applyPipeConfig(pipe, cfg.name, base64, false);
          if (cfg.name === 'fileData' && pipe.getConfig('fileName') !== undefined) {
            applyPipeConfig(pipe, 'fileName', file.name, false);
          }
          processPipeAfterConfigChange(pipe.id, pipe);
        };
        fileInput.click();
      });
      control.appendChild(wrapper);
      fields.appendChild(field);
      continue;
    }

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

    const eventName = cfg.type === 'text' ? 'input' : 'change';
    input.addEventListener(eventName, () => {
      const value = cfg.type === 'boolean'
        ? input.checked
        : cfg.type === 'number'
          ? Number(input.value)
          : input.value;
      applyPipeConfig(pipe, cfg.name, value);
    });

    control.appendChild(input);
    fields.appendChild(field);
  }
}

function applyPipeConfig(pipe, name, value, processAfter = true) {
  pipe.setConfig(name, value);
  if (pipe.constructor.typeName === 'InputPipe') {
    pipe.setConfig('rawBytes', null);
    editor.setInputText(pipe.id, pipe.getConfig('text').value);
  }
  if (processAfter) processPipeAfterConfigChange(pipe.id, pipe);
}

function processPipeAfterConfigChange(pipeId, pipe = graph.pipes.get(pipeId)) {
  graph.processFrom(pipeId).catch(console.error);
  if (pipe) editor.updatePipeElement(pipe);
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

function makePipeListItem(pipe) {
  const item = cloneTemplate('pipe-list-item-template');
  item.querySelector('.pipe-list-item-name').textContent = pipe.typeDescription;
  item.querySelector('.pipe-list-item-desc').textContent = pipe.categoryDescription;
  item.addEventListener('click', () => addPipe(pipe.typeName));
  return item;
}

function renderPipeList(query) {
  const list = document.getElementById('pipe-list');
  list.replaceChildren();
  const q = query.toLowerCase();
  const inputData = _addPipeContext?.sourceData ?? null;

  const withAppropriateness = pipe => ({
    ...pipe,
    appropriateness: Math.max(
      MIN_INPUT_APPROPRIATENESS,
      Math.min(MAX_INPUT_APPROPRIATENESS, pipe.cls.getInputAppropriateness(inputData))
    ),
  });

  const allPipes = [...getPipesByCategory().values()].flat();

  if (q) {
    // Flat search results sorted by appropriateness
    const pipes = allPipes
      .filter(pipe =>
        pipe.typeDescription.toLowerCase().includes(q) ||
        pipe.typeName.toLowerCase().includes(q) ||
        pipe.categoryDescription.toLowerCase().includes(q))
      .map((pipe, index) => ({ ...withAppropriateness(pipe), index }))
      .sort((a, b) => b.appropriateness - a.appropriateness || a.index - b.index);

    for (const pipe of pipes) {
      list.appendChild(makePipeListItem(pipe));
    }
  } else {
    // Show Recommended category first when there is contextual input data
    if (inputData !== null) {
      const recommended = allPipes
        .map((pipe, index) => ({ ...withAppropriateness(pipe), index }))
        .filter(pipe => pipe.appropriateness > 0)
        .sort((a, b) => b.appropriateness - a.appropriateness || a.index - b.index);

      if (recommended.length > 0) {
        const header = document.createElement('h3');
        header.className = 'pipe-list-category';
        header.textContent = 'Recommended';
        list.appendChild(header);

        for (const pipe of recommended) {
          list.appendChild(makePipeListItem(pipe));
        }
      }
    }

    // Grouped by category, each group sorted by base name
    for (const [category, pipes] of getPipesByCategory()) {
      const header = document.createElement('h3');
      header.className = 'pipe-list-category';
      header.textContent = category;
      list.appendChild(header);

      const sorted = pipes
        .map((pipe, index) => ({ ...withAppropriateness(pipe), index }))
        .sort((a, b) =>
          a.baseName.localeCompare(b.baseName)
          || a.index - b.index
        );

      for (const pipe of sorted) {
        list.appendChild(makePipeListItem(pipe));
      }
    }
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
    : graph.getLastPipe()?.getOutputData() ?? null;
  _addPipeContext = context;
  searchInput.value = '';
  renderPipeList('');
  document.getElementById('pipe-list').scrollTop = 0;
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
    const data = await loadFromIdb(name) ?? loadDefaultSession(name);
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
      graph.connect(previous.id, step.outputName ?? previous.defaultOutputName, pipe.id, pipe.defaultInputName);
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
  setDeletePipeMode(false);
  const ids = [...graph.pipes.keys()];
  for (const id of ids) {
    graph.removePipe(id);
    editor.removePipeElement(id);
  }
  editor.updateConnections();
  for (const view of [...sidebarViews.values()]) dismissView(view);
}

// ── Bootstrap ────────────────────────────────────────────────────

init().catch(console.error);

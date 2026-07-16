/**
 * GraphEditor web component.
 *
 * A zoomable, pannable 2D canvas that displays pipes as draggable nodes
 * and connections as SVG Bezier curves.
 *
 * Events dispatched on the element:
 *   - 'pipe-port-click'  detail: {pipeId, portName, portType, rect}
 *   - 'pipe-config-click' detail: {pipeId}
 *   - 'pipe-select'       detail: {pipeId}
 *   - 'connection-click'  detail: {connection}
 *   - 'add-pipe-request'   detail: {input, position}
 *
 * API:
 *   editor.setGraph(graph)           — attach a PipeGraph
 *   editor.addPipeElement(pipe)      — add a visual pipe node
 *   editor.removePipeElement(pipeId) — remove a visual pipe node
 *   editor.updatePipeElement(pipe)   — refresh a pipe node
 *   editor.updateConnections()       — redraw all connection SVG paths
 *   editor.startDraftConnection(portEl) — begin connection drag
 *   editor.fitView()                 — fit all pipes in view
 *   editor.setZoom(percent)          — set zoom level from 20–300
 */

import { Connection } from '../pipes/graph.js';
import { FileInputPipe } from '../pipes/builtin/file-input-pipe.js';

/**
 * Compute SVG cubic bezier path between two points.
 * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
 * @returns {string}
 */
function bezierPath(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1);
  const cp = Math.max(40, Math.min(120, dy * 0.5));
  return `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
}

class GraphEditor extends HTMLElement {
  constructor() {
    super();
    this._graph = null;

    // Pan/zoom state
    this._scale = 1;
    this._panX = 0;
    this._panY = 0;
    this._isPanning = false;
    this._panStart = null;

    // Connection draft state
    this._draftFrom = null; // {pipeId, portName, portType, x, y}
    this._draftPath = null; // SVGPathElement
    this._addPipeControl = null;

    // Drag state
    this._dragging = null; // {pipeId, startX, startY, elemStartX, elemStartY}

    // Port elements: portKey → HTMLElement
    this._portElements = new Map();

    // Pipe elements: pipeId → HTMLElement
    this._pipeElements = new Map();

    // SVG connection path groups: connId → { hit: SVGPathElement, vis: SVGPathElement }
    this._connPathGroups = new Map();

    this._canvas = null;
    this._inner = null;
    this._svg = null;
  }

  connectedCallback() {
    this.innerHTML = '';
    this.style.display = 'block';

    // Outer canvas (handles pan/zoom)
    this._canvas = document.createElement('div');
    this._canvas.className = 'graph-canvas';
    this.appendChild(this._canvas);

    // Inner div (transformed for pan/zoom)
    this._inner = document.createElement('div');
    this._inner.className = 'graph-canvas-inner';
    this._canvas.appendChild(this._inner);

    // SVG layer for connections — large enough to contain all pipes
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.classList.add('connections-layer');
    this._svg.setAttribute('width', '8000');
    this._svg.setAttribute('height', '6000');
    this._svg.style.position = 'absolute';
    this._svg.style.top = '0';
    this._svg.style.left = '0';
    this._inner.appendChild(this._svg);

    this._addPipeControl = document.createElement('button');
    this._addPipeControl.className = 'add-pipe-control';
    this._addPipeControl.type = 'button';
    this._addPipeControl.setAttribute('aria-label', 'Add Pipe');
    this._addPipeControl.innerHTML = '<span>+</span><span>Add Pipe</span>';
    this._addPipeControl.addEventListener('mousedown', e => e.stopPropagation());
    this._addPipeControl.addEventListener('click', () => this._requestAddPipe());
    this._inner.appendChild(this._addPipeControl);

    // Events
    this._canvas.addEventListener('mousedown', this._onCanvasMouseDown.bind(this));
    this._canvas.addEventListener('mousemove', this._onCanvasMouseMove.bind(this));
    this._canvas.addEventListener('mouseup', this._onCanvasMouseUp.bind(this));
    this._canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    this._canvas.addEventListener('contextmenu', e => e.preventDefault());

    this._applyTransform();
    this._syncAddPipeControl();
  }

  /** @param {import('../pipes/graph.js').PipeGraph} graph */
  setGraph(graph) {
    this._graph = graph;
    graph.addListener(this._onGraphEvent.bind(this));
  }

  _onGraphEvent(event) {
    if (event.type === 'pipe-added' || event.type === 'pipe-removed') {
      this._syncAddPipeControl();
    }
    if (event.type === 'pipe-processed' || event.type === 'processed') {
      const pipe = this._graph?.pipes.get(event.pipeId);
      if (pipe) this.updatePipeElement(pipe);
      this.updateConnections();
    }
  }

  // ── Pipe node management ────────────────────────────────────

  /** @param {import('../pipes/pipe.js').Pipe} pipe */
  addPipeElement(pipe) {
    const el = this._createPipeElement(pipe);
    this._pipeElements.set(pipe.id, el);
    this._inner.appendChild(el);
    this._positionElement(el, pipe.position.x, pipe.position.y);
    this.updateConnections();
  }

  /** @param {string} pipeId */
  removePipeElement(pipeId) {
    const el = this._pipeElements.get(pipeId);
    if (el) {
      el.remove();
      this._pipeElements.delete(pipeId);
    }
    // Remove port elements
    for (const [key] of this._portElements) {
      if (key.startsWith(pipeId + ':')) this._portElements.delete(key);
    }
    this.updateConnections();
  }

  /** @param {import('../pipes/pipe.js').Pipe} pipe */
  updatePipeElement(pipe) {
    const el = this._pipeElements.get(pipe.id);
    if (!el) return;

    // Update error indicator
    const hasError = pipe.errors.length > 0;
    const indicatorEl = el.querySelector('.pipe-node-error-indicator');
    if (indicatorEl) {
      indicatorEl.hidden = !hasError;
      indicatorEl.setAttribute('aria-hidden', String(!hasError));
      indicatorEl.title = hasError ? pipe.errors[0].message : '';
      if (hasError) {
        indicatorEl.setAttribute('aria-label', `Error: ${pipe.errors[0].message}`);
      } else {
        indicatorEl.removeAttribute('aria-label');
      }
    }
    const errEl = el.querySelector('.pipe-node-error');
    if (errEl) {
      errEl.textContent = hasError ? pipe.errors[0].message : '';
      errEl.style.display = hasError ? '' : 'none';
    }

    // Refresh ports for dynamic-port pipes (URL parser, etc.)
    const topPorts = el.querySelector('.pipe-node-ports-top');
    const botPorts = el.querySelector('.pipe-node-ports-bottom');
    if (topPorts && botPorts) {
      this._buildPorts(pipe, topPorts, botPorts);
    }

    this.updateConnections();
  }

  /** @param {string} pipeId @param {string} text */
  setInputText(pipeId, text) {
    const textarea = this._pipeElements.get(pipeId)?.querySelector('.pipe-input-area textarea');
    if (textarea) textarea.value = text;
  }

  /** Redraws all SVG connection paths. */
  updateConnections() {
    if (!this._graph || !this._svg) return;

    // Remove path groups not in graph
    for (const [id, paths] of this._connPathGroups) {
      const exists = this._graph.connections.find(c => c.id === id);
      if (!exists) {
        paths.vis.remove();
        paths.hit.remove();
        this._connPathGroups.delete(id);
      }
    }

    // Add/update path groups for each connection
    for (const conn of this._graph.connections) {
      let paths = this._connPathGroups.get(conn.id);
      if (!paths) {
        // Visual path: rendered appearance only, no pointer events
        const vis = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        vis.classList.add('connection-path');

        // Hit path: wide transparent stroke for easier clicking
        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.classList.add('connection-hit');
        hit.dataset.connId = conn.id;
        hit.addEventListener('click', (e) => {
          this.dispatchEvent(new CustomEvent('connection-click', {
            detail: { connection: conn, clientX: e.clientX, clientY: e.clientY },
            bubbles: true,
          }));
        });
        hit.addEventListener('mouseenter', () => vis.classList.add('hover'));
        hit.addEventListener('mouseleave', () => vis.classList.remove('hover'));

        this._svg.appendChild(vis);
        this._svg.appendChild(hit);
        paths = { vis, hit };
        this._connPathGroups.set(conn.id, paths);
      }
      this._updateConnectionPath(paths, conn);
    }

    // Update draft path if active
    if (this._draftPath && this._draftFrom) {
      // kept up by mousemove
    }
  }

  _updateConnectionPath(paths, conn) {
    const fromKey = `${conn.fromPipeId}:output:${conn.fromOutput}`;
    const toKey   = `${conn.toPipeId}:input:${conn.toInput}`;
    const fromEl  = this._portElements.get(fromKey);
    const toEl    = this._portElements.get(toKey);
    if (!fromEl || !toEl) {
      paths.vis.setAttribute('d', '');
      paths.hit.setAttribute('d', '');
      return;
    }

    const fromPos = this._portCenter(fromEl);
    const toPos   = this._portCenter(toEl);
    const d = bezierPath(fromPos.x, fromPos.y, toPos.x, toPos.y);
    paths.vis.setAttribute('d', d);
    paths.hit.setAttribute('d', d);
  }

  /** Get port center in canvas-inner coordinates. */
  _portCenter(portEl) {
    const rect   = portEl.getBoundingClientRect();
    const svgRect = this._inner.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2 - svgRect.left) / this._scale,
      y: (rect.top  + rect.height / 2 - svgRect.top)  / this._scale,
    };
  }

  // ── Pipe element creation ───────────────────────────────────

  _createPipeElement(pipe) {
    const el = document.createElement('div');
    el.className = 'pipe-node';
    el.dataset.pipeId = pipe.id;

    // Input ports row
    const topPorts = document.createElement('div');
    topPorts.className = 'pipe-node-ports-top';

    // Header
    const header = document.createElement('div');
    header.className = 'pipe-node-header';
    const nameGroupEl = document.createElement('div');
    nameGroupEl.className = 'pipe-node-name-group';
    const nameEl = document.createElement('span');
    nameEl.className = 'pipe-node-name';
    nameEl.textContent = pipe.displayName;
    nameEl.title = pipe.displayName;
    const errorIndicatorEl = document.createElement('span');
    errorIndicatorEl.className = 'pipe-node-error-indicator';
    errorIndicatorEl.textContent = '❗';
    errorIndicatorEl.setAttribute('role', 'img');
    errorIndicatorEl.setAttribute('aria-hidden', 'true');
    errorIndicatorEl.hidden = true;
    nameGroupEl.appendChild(errorIndicatorEl);
    nameGroupEl.appendChild(nameEl);
    const cfgBtn = document.createElement('button');
    cfgBtn.className = 'pipe-node-config-btn';
    cfgBtn.textContent = '⚙';
    cfgBtn.title = 'Configure';
    cfgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('pipe-config-click', {
        detail: { pipeId: pipe.id }, bubbles: true
      }));
    });
    header.appendChild(nameGroupEl);
    header.appendChild(cfgBtn);

    // Output ports row
    const botPorts = document.createElement('div');
    botPorts.className = 'pipe-node-ports-bottom';

    // Error area
    const errEl = document.createElement('div');
    errEl.className = 'pipe-node-error';
    errEl.style.display = 'none';

    // Input area for InputPipe
    let inputArea = null;
    if (pipe.constructor.typeName === 'InputPipe') {
      inputArea = document.createElement('div');
      inputArea.className = 'pipe-input-area';
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Enter input text…';
      textarea.value = pipe.getConfig('text')?.value ?? '';
      textarea.addEventListener('input', () => {
        pipe.setConfig('text', textarea.value);
        pipe.setConfig('rawBytes', null);
        if (this._graph) {
          this._graph.processFrom(pipe.id).catch(console.error);
        }
      });
      inputArea.appendChild(textarea);
    } else if (pipe.constructor.typeName === 'FileInputPipe') {
      inputArea = document.createElement('div');
      inputArea.className = 'pipe-input-area pipe-file-area';
      const fileNameEl = document.createElement('div');
      fileNameEl.className = 'pipe-file-name';
      fileNameEl.textContent = pipe.getConfig('fileName')?.value || 'No file selected';
      fileNameEl.title = pipe.getConfig('fileName')?.value || '';
      const fileBtn = document.createElement('button');
      fileBtn.className = 'btn btn-sm';
      fileBtn.textContent = '📁 Choose File';
      fileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.onchange = async () => {
          const file = fileInput.files[0];
          if (!file) return;
          const buffer = await file.arrayBuffer();
          const base64 = FileInputPipe.bytesToBase64(new Uint8Array(buffer));
          pipe.setConfig('fileName', file.name);
          pipe.setConfig('fileData', base64);
          fileNameEl.textContent = file.name;
          fileNameEl.title = file.name;
          if (this._graph) {
            this._graph.processFrom(pipe.id).catch(console.error);
          }
        };
        fileInput.click();
      });
      inputArea.appendChild(fileNameEl);
      inputArea.appendChild(fileBtn);
    }

    el.appendChild(topPorts);
    el.appendChild(header);
    if (inputArea) el.appendChild(inputArea);
    el.appendChild(botPorts);
    el.appendChild(errEl);

    this._buildPorts(pipe, topPorts, botPorts);

    // Drag to move
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('port') || e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      this._dragging = {
        pipeId: pipe.id,
        el,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startElemX: pipe.position.x,
        startElemY: pipe.position.y,
      };
      el.style.cursor = 'grabbing';
    });

    // Select on click
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('port')) return;
      this.dispatchEvent(new CustomEvent('pipe-select', {
        detail: { pipeId: pipe.id }, bubbles: true
      }));
    });

    return el;
  }

  _buildPorts(pipe, topContainer, botContainer) {
    // Clear existing ports for this pipe from registry
    for (const [key] of this._portElements) {
      if (key.startsWith(pipe.id + ':')) this._portElements.delete(key);
    }
    topContainer.innerHTML = '';
    botContainer.innerHTML = '';

    // Input ports
    for (const portDef of pipe.defineInputs()) {
      const wrapper = this._createPortEl(pipe.id, portDef, 'input');
      topContainer.appendChild(wrapper);
    }
    // Output ports
    for (const portDef of pipe.defineOutputs()) {
      const wrapper = this._createPortEl(pipe.id, portDef, 'output');
      botContainer.appendChild(wrapper);
    }
  }

  _createPortEl(pipeId, portDef, portType) {
    const wrapper = document.createElement('div');
    wrapper.className = 'port-wrapper';

    const dot = document.createElement('div');
    dot.className = `port ${portType}-port`;
    dot.dataset.pipeId = pipeId;
    dot.dataset.portName = portDef.name;
    dot.dataset.portType = portType;
    dot.title = `${portType}: ${portDef.name} — ${portDef.description}`;

    const label = document.createElement('span');
    label.className = 'port-name';
    label.textContent = portDef.name;

    if (portType === 'input') {
      wrapper.appendChild(label);
      wrapper.appendChild(dot);
    } else {
      wrapper.appendChild(dot);
      wrapper.appendChild(label);
    }

    // Register
    const key = `${pipeId}:${portType}:${portDef.name}`;
    this._portElements.set(key, dot);

    // Click to start/finish connection
    dot.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._onPortMouseDown(e, pipeId, portDef.name, portType);
    });

    // Click output port to view data
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('pipe-port-click', {
        detail: { pipeId, portName: portDef.name, portType },
        bubbles: true
      }));
    });

    return wrapper;
  }

  // ── Connection dragging ─────────────────────────────────────

  _onPortMouseDown(e, pipeId, portName, portType) {
    if (portType === 'output') {
      // Start draft from output
      const portEl = this._portElements.get(`${pipeId}:output:${portName}`);
      if (!portEl) return;
      const pos = this._portCenter(portEl);
      this._draftFrom = { pipeId, portName, portType: 'output', x: pos.x, y: pos.y };
      this._canvas.classList.add('connecting');

      this._draftPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this._draftPath.classList.add('connection-path', 'draft');
      this._svg.appendChild(this._draftPath);
    } else if (portType === 'input' && this._draftFrom) {
      // Complete connection
      this._completeConnection(pipeId, portName);
    }
  }

  _onCanvasMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && !this._draftFrom && !this._dragging)) {
      // Pan
      this._isPanning = true;
      this._panStart = { x: e.clientX - this._panX, y: e.clientY - this._panY };
      this._canvas.style.cursor = 'grabbing';
    }
  }

  _onCanvasMouseMove(e) {
    if (this._isPanning) {
      this._panX = e.clientX - this._panStart.x;
      this._panY = e.clientY - this._panStart.y;
      this._applyTransform();
      return;
    }

    if (this._dragging) {
      const dx = (e.clientX - this._dragging.startMouseX) / this._scale;
      const dy = (e.clientY - this._dragging.startMouseY) / this._scale;
      const nx = this._dragging.startElemX + dx;
      const ny = this._dragging.startElemY + dy;
      const pipe = this._graph?.pipes.get(this._dragging.pipeId);
      if (pipe) {
        pipe.position.x = nx;
        pipe.position.y = ny;
        this._positionElement(this._dragging.el, nx, ny);
        this.updateConnections();
      }
      return;
    }

    if (this._draftFrom && this._draftPath) {
      const svgRect = this._inner.getBoundingClientRect();
      const mx = (e.clientX - svgRect.left) / this._scale;
      const my = (e.clientY - svgRect.top)  / this._scale;
      this._positionAddPipeControl(mx, my);
      this._draftPath.setAttribute('d',
        bezierPath(this._draftFrom.x, this._draftFrom.y, mx, my)
      );
    }
  }

  _onCanvasMouseUp(e) {
    this._canvas.style.cursor = '';
    if (this._dragging) {
      this._dragging.el.style.cursor = '';
      this._dragging = null;
      this.dispatchEvent(new CustomEvent('graph-change', { bubbles: true }));
    }
    if (this._isPanning) {
      this._isPanning = false;
    }
    if (this._draftFrom) {
      // Check if we released on an input port
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target?.classList.contains('port') && target.dataset.portType === 'input') {
        this._completeConnection(target.dataset.pipeId, target.dataset.portName);
      } else {
        this._requestAddPipe();
        this._cancelDraft();
      }
    }
  }

  _completeConnection(toPipeId, toPortName) {
    if (!this._draftFrom || !this._graph) {
      this._cancelDraft();
      return;
    }
    const { pipeId: fromPipeId, portName: fromPortName } = this._draftFrom;
    this._graph.connect(fromPipeId, fromPortName, toPipeId, toPortName);
    this._graph.processFrom(fromPipeId).catch(console.error);
    this._cancelDraft();
    this.updateConnections();
  }

  _cancelDraft() {
    if (this._draftPath) {
      this._draftPath.remove();
      this._draftPath = null;
    }
    this._draftFrom = null;
    this._canvas.classList.remove('connecting');
    this._syncAddPipeControl();
  }

  _positionAddPipeControl(x, y) {
    if (!this._addPipeControl) return;
    this._addPipeControl.hidden = false;
    this._addPipeControl.classList.add('draft');
    this._positionElement(this._addPipeControl, x - 70, y - 30);
  }

  _syncAddPipeControl() {
    if (!this._addPipeControl || this._draftFrom) return;
    const isEmpty = !this._graph || this._graph.pipes.size === 0;
    this._addPipeControl.hidden = !isEmpty;
    this._addPipeControl.classList.remove('draft');
    if (isEmpty) this._positionElement(this._addPipeControl, 60, 80);
  }

  _requestAddPipe() {
    if (!this._addPipeControl) return;
    const input = this._draftFrom
      ? { pipeId: this._draftFrom.pipeId, portName: this._draftFrom.portName }
      : null;
    this.dispatchEvent(new CustomEvent('add-pipe-request', {
      detail: {
        input,
        position: {
          x: parseFloat(this._addPipeControl.style.left) || 60,
          y: parseFloat(this._addPipeControl.style.top) || 80,
        },
      },
      bubbles: true,
    }));
  }

  // ── Pan/zoom ─────────────────────────────────────────────────

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = this._canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Zoom towards mouse
    this._panX = mx - (mx - this._panX) * delta;
    this._panY = my - (my - this._panY) * delta;
    this._scale = Math.max(0.2, Math.min(3, this._scale * delta));
    this._applyTransform();
    this.updateConnections();
    this._notifyZoom();
  }

  _applyTransform() {
    if (this._inner) {
      this._inner.style.transform = `translate(${this._panX}px, ${this._panY}px) scale(${this._scale})`;
    }
  }

  _positionElement(el, x, y) {
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
  }

  /** Fit all pipe nodes into view. */
  fitView() {
    if (!this._graph || this._graph.pipes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pipe of this._graph.pipes.values()) {
      minX = Math.min(minX, pipe.position.x);
      minY = Math.min(minY, pipe.position.y);
      maxX = Math.max(maxX, pipe.position.x + 160);
      maxY = Math.max(maxY, pipe.position.y + 100);
    }
    const cw = this._canvas.clientWidth;
    const ch = this._canvas.clientHeight;
    const gw = maxX - minX + 40;
    const gh = maxY - minY + 40;
    this._scale = Math.max(0.3, Math.min(1.5, Math.min(cw / gw, ch / gh)));
    this._panX = (cw - gw * this._scale) / 2 - minX * this._scale + 20;
    this._panY = (ch - gh * this._scale) / 2 - minY * this._scale + 20;
    this._applyTransform();
    this.updateConnections();
    this._notifyZoom();
  }

  /** Set zoom percentage while keeping the viewport center fixed. */
  setZoom(percent) {
    const nextScale = Math.max(0.2, Math.min(3, Number(percent) / 100));
    if (!this._canvas || !Number.isFinite(nextScale)) return;
    const cx = this._canvas.clientWidth / 2;
    const cy = this._canvas.clientHeight / 2;
    const ratio = nextScale / this._scale;
    this._panX = cx - (cx - this._panX) * ratio;
    this._panY = cy - (cy - this._panY) * ratio;
    this._scale = nextScale;
    this._applyTransform();
    this.updateConnections();
    this._notifyZoom();
  }

  _notifyZoom() {
    this.dispatchEvent(new CustomEvent('zoom-change', {
      detail: { percent: Math.round(this._scale * 100) },
      bubbles: true,
    }));
  }
}

customElements.define('graph-editor', GraphEditor);

export { GraphEditor };

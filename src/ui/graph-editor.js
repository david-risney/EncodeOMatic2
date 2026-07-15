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
 *
 * API:
 *   editor.setGraph(graph)           — attach a PipeGraph
 *   editor.addPipeElement(pipe)      — add a visual pipe node
 *   editor.removePipeElement(pipeId) — remove a visual pipe node
 *   editor.updatePipeElement(pipe)   — refresh a pipe node
 *   editor.updateConnections()       — redraw all connection SVG paths
 *   editor.startDraftConnection(portEl) — begin connection drag
 *   editor.fitView()                 — fit all pipes in view
 */

import { Connection } from '../pipes/graph.js';

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

    // Drag state
    this._dragging = null; // {pipeId, startX, startY, elemStartX, elemStartY}

    // Port elements: portKey → HTMLElement
    this._portElements = new Map();

    // Pipe elements: pipeId → HTMLElement
    this._pipeElements = new Map();

    // SVG connection paths: connId → SVGPathElement
    this._connPaths = new Map();

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

    // Events
    this._canvas.addEventListener('mousedown', this._onCanvasMouseDown.bind(this));
    this._canvas.addEventListener('mousemove', this._onCanvasMouseMove.bind(this));
    this._canvas.addEventListener('mouseup', this._onCanvasMouseUp.bind(this));
    this._canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    this._canvas.addEventListener('contextmenu', e => e.preventDefault());

    this._applyTransform();
  }

  /** @param {import('../pipes/graph.js').PipeGraph} graph */
  setGraph(graph) {
    this._graph = graph;
    graph.addListener(this._onGraphEvent.bind(this));
  }

  _onGraphEvent(event) {
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
    el.classList.toggle('has-error', hasError);
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

  /** Redraws all SVG connection paths. */
  updateConnections() {
    if (!this._graph || !this._svg) return;

    // Remove paths not in graph
    for (const [id, path] of this._connPaths) {
      const exists = this._graph.connections.find(c => c.id === id);
      if (!exists) {
        path.remove();
        this._connPaths.delete(id);
      }
    }

    // Add/update paths for each connection
    for (const conn of this._graph.connections) {
      let path = this._connPaths.get(conn.id);
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('connection-path');
        path.dataset.connId = conn.id;
        path.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('connection-click', {
            detail: { connection: conn }, bubbles: true
          }));
        });
        this._svg.appendChild(path);
        this._connPaths.set(conn.id, path);
      }
      this._updateConnectionPath(path, conn);
    }

    // Update draft path if active
    if (this._draftPath && this._draftFrom) {
      // kept up by mousemove
    }
  }

  _updateConnectionPath(path, conn) {
    const fromKey = `${conn.fromPipeId}:output:${conn.fromOutput}`;
    const toKey   = `${conn.toPipeId}:input:${conn.toInput}`;
    const fromEl  = this._portElements.get(fromKey);
    const toEl    = this._portElements.get(toKey);
    if (!fromEl || !toEl) {
      path.setAttribute('d', '');
      return;
    }

    const fromPos = this._portCenter(fromEl);
    const toPos   = this._portCenter(toEl);
    path.setAttribute('d', bezierPath(fromPos.x, fromPos.y, toPos.x, toPos.y));
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
    const nameEl = document.createElement('span');
    nameEl.className = 'pipe-node-name';
    nameEl.textContent = pipe.displayName;
    nameEl.title = pipe.displayName;
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
    header.appendChild(nameEl);
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
        if (this._graph) {
          this._graph.processFrom(pipe.id).catch(console.error);
        }
      });
      inputArea.appendChild(textarea);
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
  }
}

customElements.define('graph-editor', GraphEditor);

export { GraphEditor };

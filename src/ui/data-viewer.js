/**
 * DataViewer web component.
 *
 * Displays Uint8Array data either as text or as a colorized hex dump.
 *
 * Usage:
 *   <data-viewer></data-viewer>
 *
 * API:
 *   viewer.setData(bytes, label)   — update displayed data
 *   viewer.setSelections(ranges)   — highlight byte ranges
 *   viewer.setMode('text'|'hex')   — switch view mode
 *   viewer.setEditable(editable, onChange) — allow editing displayed bytes
 * Events:
 *   selection-change — detail.selections contains selected byte ranges
 */

/**
 * Generate a color for a byte value.
 * Uses HSL: hue derived from value, with distinct saturation/lightness.
 * @param {number} value - 0–255
 * @returns {string} CSS color
 */
function byteColor(value) {
  if (value === 0) return 'hsl(0, 0%, 40%)';          // null byte: dark gray
  if (value === 0x0a || value === 0x0d) return 'hsl(120, 60%, 55%)'; // newline/CR: green
  if (value === 0x20) return 'hsl(200, 30%, 60%)';     // space: light blue-gray
  if (value < 0x20 || value === 0x7f) return 'hsl(0, 70%, 60%)';    // control: red
  if (value < 0x80) return `hsl(${(value * 360 / 128) | 0}, 75%, 65%)`; // ASCII printable
  return `hsl(${((value - 128) * 360 / 128) | 0}, 55%, 50%)`;           // high bytes
}

/**
 * Encode a Uint8Array as a UTF-8 string, replacing invalid sequences.
 */
function decodeUtf8Lenient(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

const HEX_BYTES_RE = /^(?:[0-9a-fA-F]{2})(?:\s+[0-9a-fA-F]{2})*$/;

class DataViewer extends HTMLElement {
  constructor() {
    super();
    this._mode = 'text';
    this._data = null;  // Uint8Array | null
    this._label = '';
    this._inner = null;
    this._editable = false;
    this._onChange = null;
    this._selections = [];
  }

  /**
   * @param {{index: number, length: number}[]} selections
   */
  setSelections(selections = []) {
    const changed = selections.length !== this._selections.length ||
      selections.some((selection, index) =>
        selection.index !== this._selections[index]?.index ||
        selection.length !== this._selections[index]?.length);
    this._selections = selections;
    if (changed && this._shouldRenderOnDataChange()) {
      this._render();
    }
  }

  connectedCallback() {
    this._inner = document.createElement('div');
    this._inner.className = 'data-viewer-inner';
    this._inner.addEventListener('mouseup', () => {
      if (this._editable) return;
      if (this._mode === 'hex') {
        this._captureHexSelection();
      } else {
        this._captureTextSelection();
      }
    });
    this.appendChild(this._inner);
    this._render();
  }

  /**
   * @param {Uint8Array|null} bytes
   * @param {string} [label]
   */
  setData(bytes, label = '') {
    this._data = bytes;
    this._label = label;
    if (this._shouldRenderOnDataChange()) {
      this._render();
    }
  }

  _shouldRenderOnDataChange() {
    return !this._editable || !this.contains(document.activeElement);
  }

  /**
   * @param {'text'|'hex'} mode
   */
  setMode(mode) {
    this._mode = mode;
    if (this._inner) {
      this._inner.classList.toggle('hex-view', mode === 'hex');
    }
    this._render();
  }

  /**
   * @param {boolean} editable
   * @param {((bytes: Uint8Array, mode: 'text'|'hex') => void)|null} [onChange]
   */
  setEditable(editable, onChange = null) {
    const changed = this._editable !== editable;
    this._editable = editable;
    this._onChange = onChange;
    if (changed) {
      this._render();
    }
  }

  _render() {
    if (!this._inner) return;

    if (!this._data || (this._data.length === 0 && !this._editable)) {
      this._inner.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'data-viewer-empty';
      empty.textContent = this._data ? '(empty)' : 'No data';
      this._inner.appendChild(empty);
      return;
    }

    this._inner.innerHTML = '';

    if (this._mode === 'hex') {
      this._inner.classList.add('hex-view');
      this._renderHex();
    } else {
      this._inner.classList.remove('hex-view');
      this._renderText();
    }
  }

  _renderText() {
    const text = decodeUtf8Lenient(this._data);
    if (this._editable) {
      const editor = document.createElement('textarea');
      editor.className = 'data-viewer-editor';
      editor.value = text;
      editor.setAttribute('aria-label', 'Edit input as text');
      editor.addEventListener('input', () => {
        const bytes = new TextEncoder().encode(editor.value);
        this._data = bytes;
        this._updateInfo(bytes.length, editor.value.length);
        this._onChange?.(bytes, 'text');
      });
      editor.addEventListener('select', () => {
        const start = new TextEncoder().encode(editor.value.slice(0, editor.selectionStart)).length;
        const end = new TextEncoder().encode(editor.value.slice(0, editor.selectionEnd)).length;
        this._emitSelection(start, end);
      });
      this._inner.appendChild(editor);
    } else {
      const ranges = this._selectionRanges();
      if (ranges.length === 0) {
        const pre = document.createElement('span');
        pre.textContent = text;
        this._inner.appendChild(pre);
      } else {
        let offset = 0;
        for (const range of ranges) {
          this._appendTextSegment(this._data.slice(offset, range.start), false);
          this._appendTextSegment(this._data.slice(range.start, range.end), true);
          offset = range.end;
        }
        this._appendTextSegment(this._data.slice(offset), false);
      }
    }

    const info = document.createElement('div');
    info.className = 'data-viewer-info';
    info.textContent = `${this._data.length} byte${this._data.length === 1 ? '' : 's'} · ${text.length} char${text.length === 1 ? '' : 's'}`;
    this._inner.appendChild(info);
  }

  _renderHex() {
    if (this._editable) {
      const editor = document.createElement('textarea');
      editor.className = 'data-viewer-editor hex-editor';
      editor.value = [...this._data]
        .map(byte => byte.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
      editor.setAttribute('aria-label', 'Edit input as hexadecimal bytes');
      editor.addEventListener('input', () => {
        const value = editor.value.trim();
        const valid = value === '' || HEX_BYTES_RE.test(value);
        editor.classList.toggle('invalid', !valid);
        editor.setAttribute('aria-invalid', String(!valid));
        if (!valid) return;
        const bytes = value === ''
          ? new Uint8Array()
          : Uint8Array.from(value.split(/\s+/), token => Number.parseInt(token, 16));
        this._data = bytes;
        this._updateInfo(bytes.length);
        this._onChange?.(bytes, 'hex');
      });
      editor.addEventListener('select', () => {
        const tokens = [...editor.value.matchAll(/[0-9a-fA-F]{2}/g)];
        const selected = tokens
          .map((token, index) => ({
            index,
            start: token.index,
            end: token.index + token[0].length,
          }))
          .filter(token =>
            token.start < editor.selectionEnd && token.end > editor.selectionStart);
        this._emitSelection(
          selected[0]?.index ?? 0,
          selected.length === 0 ? 0 : selected.at(-1).index + 1
        );
      });
      this._inner.appendChild(editor);
    } else {
      const fragment = document.createDocumentFragment();
      const selected = new Set();
      for (const range of this._selectionRanges()) {
        for (let i = range.start; i < range.end; i++) selected.add(i);
      }
      for (let i = 0; i < this._data.length; i++) {
        const byte = this._data[i];
        const span = document.createElement('span');
        span.className = 'hex-byte';
        if (selected.has(i)) span.classList.add('data-viewer-selection');
        span.textContent = byte.toString(16).toUpperCase().padStart(2, '0');
        span.style.color = byteColor(byte);
        span.title = `0x${byte.toString(16).toUpperCase().padStart(2, '0')} = ${byte} = ${byte < 0x20 || byte > 0x7E ? '(ctrl)' : String.fromCharCode(byte)}`;
        fragment.appendChild(span);
      }
      this._inner.appendChild(fragment);
    }

    const info = document.createElement('div');
    info.className = 'data-viewer-info';
    info.textContent = `${this._data.length} byte${this._data.length === 1 ? '' : 's'}`;
    this._inner.appendChild(info);
  }

  _selectionRanges() {
    const ranges = this._selections
      .map(({ index, length }) => ({
        start: Math.max(0, Math.min(this._data?.length ?? 0, Math.floor(Number(index)))),
        end: Math.max(0, Math.min(
          this._data?.length ?? 0,
          Math.floor(Number(index)) + Math.floor(Number(length))
        )),
      }))
      .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start)
      .sort((a, b) => a.start - b.start);

    const merged = [];
    for (const range of ranges) {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        merged.push(range);
      }
    }
    return merged;
  }

  _appendTextSegment(bytes, selected) {
    if (bytes.length === 0) return;
    const span = document.createElement('span');
    if (selected) span.className = 'data-viewer-selection';
    span.textContent = decodeUtf8Lenient(bytes);
    this._inner.appendChild(span);
  }

  _captureTextSelection() {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this._emitSelection(0, 0);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!this._inner.contains(range.startContainer) || !this._inner.contains(range.endContainer) ||
        range.commonAncestorContainer.parentElement?.closest('.data-viewer-info')) {
      return;
    }
    const prefix = range.cloneRange();
    prefix.selectNodeContents(this._inner);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = new TextEncoder().encode(prefix.toString()).length;
    const length = new TextEncoder().encode(range.toString()).length;
    this._emitSelection(start, start + length);
  }

  _captureHexSelection() {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this._emitSelection(0, 0);
      return;
    }
    const range = selection.getRangeAt(0);
    const bytes = [...this._inner.querySelectorAll('.hex-byte')];
    const selected = bytes
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => range.intersectsNode(node));
    this._emitSelection(
      selected[0]?.index ?? 0,
      selected.length === 0 ? 0 : selected.at(-1).index + 1
    );
  }

  _emitSelection(start, end) {
    const selections = end > start ? [{ index: start, length: end - start }] : [];
    this.dispatchEvent(new CustomEvent('selection-change', {
      bubbles: true,
      detail: { selections },
    }));
  }

  _updateInfo(byteCount, charCount = null) {
    const info = this._inner.querySelector('.data-viewer-info');
    if (!info) return;
    info.textContent = `${byteCount} byte${byteCount === 1 ? '' : 's'}` +
      (charCount === null ? '' : ` · ${charCount} char${charCount === 1 ? '' : 's'}`);
  }
}

customElements.define('data-viewer', DataViewer);

export { DataViewer };

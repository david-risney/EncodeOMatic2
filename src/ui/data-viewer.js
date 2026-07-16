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
 *   viewer.setMode('text'|'hex')   — switch view mode
 *   viewer.setEditable(editable, onChange) — allow editing displayed bytes
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
  }

  connectedCallback() {
    this._inner = document.createElement('div');
    this._inner.className = 'data-viewer-inner';
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
      this._inner.appendChild(editor);
    } else {
      const pre = document.createElement('span');
      pre.textContent = text;
      this._inner.appendChild(pre);
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
      this._inner.appendChild(editor);
    } else {
      const fragment = document.createDocumentFragment();
      for (const byte of this._data) {
        const span = document.createElement('span');
        span.className = 'hex-byte';
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

  _updateInfo(byteCount, charCount = null) {
    const info = this._inner.querySelector('.data-viewer-info');
    if (!info) return;
    info.textContent = `${byteCount} byte${byteCount === 1 ? '' : 's'}` +
      (charCount === null ? '' : ` · ${charCount} char${charCount === 1 ? '' : 's'}`);
  }
}

customElements.define('data-viewer', DataViewer);

export { DataViewer };

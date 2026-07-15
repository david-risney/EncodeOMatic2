/**
 * State management — serializes and deserializes the graph from the URL
 * and from IndexedDB (for large graphs).
 *
 * URL format:
 *   ?g=<base64url-json>   — small graph (< ~2000 chars when encoded)
 *   ?gid=<uuid>           — large graph stored in IDB
 *
 * IDB:
 *   Database: 'encode-o-matic'
 *   Object store: 'graphs'
 *   Keys: UUID strings
 */

const DB_NAME = 'encode-o-matic';
const STORE = 'graphs';
const MAX_URL_BYTES = 2000;

// ── UUID generation ──────────────────────────────────────────────

/**
 * Generate a UUID v4. Uses crypto.randomUUID() when available, falls back
 * to Math.random() for environments that don't support it.
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 UUID using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Base64URL ────────────────────────────────────────────────────

function toBase64Url(str) {
  return btoa(encodeURIComponent(str)
    .replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64Url(b64) {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(padded);
  return decodeURIComponent(
    [...decoded].map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  );
}

// ── IndexedDB helpers ────────────────────────────────────────────

let _db = null;

async function openDb() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

async function idbSave(id, data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id, data, savedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbLoad(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result?.data ?? null);
    req.onerror   = () => reject(req.error);
  });
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Save graph to URL (and IDB if too large).
 * Updates window.location.href.
 * @param {object} graphJSON - plain JSON object from PipeGraph.toJSON()
 */
export async function saveToUrl(graphJSON) {
  const json = JSON.stringify(graphJSON);

  // Try URL first
  const encoded = toBase64Url(json);
  const url = new URL(window.location.href);

  if (encoded.length <= MAX_URL_BYTES) {
    url.searchParams.set('g', encoded);
    url.searchParams.delete('gid');
  } else {
    // Store in IDB, save ID in URL
    const id = generateUUID();
    await idbSave(id, graphJSON);
    url.searchParams.set('gid', id);
    url.searchParams.delete('g');
  }

  window.history.replaceState({}, '', url.toString());
  return url.toString();
}

/**
 * Load graph from URL params or IDB.
 * @returns {Promise<object|null>} plain JSON object or null
 */
export async function loadFromUrl() {
  const params = new URLSearchParams(window.location.search);

  if (params.has('g')) {
    try {
      return JSON.parse(fromBase64Url(params.get('g')));
    } catch (e) {
      console.error('Failed to decode graph from URL:', e);
      return null;
    }
  }

  if (params.has('gid')) {
    try {
      return await idbLoad(params.get('gid'));
    } catch (e) {
      console.error('Failed to load graph from IDB:', e);
      return null;
    }
  }

  return null;
}

/**
 * Save a named graph to IDB.
 * @param {string} id
 * @param {object} graphJSON
 */
export async function saveToIdb(id, graphJSON) {
  return idbSave(id, graphJSON);
}

/**
 * Load a named graph from IDB.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function loadFromIdb(id) {
  return idbLoad(id);
}

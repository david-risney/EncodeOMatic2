/**
 * State management — serializes graphs into shareable URLs and persists
 * named sessions in IndexedDB.
 *
 * URL format:
 *   ?g=<base64url-json>   — complete graph state
 * IDB:
 *   Database: 'encode-o-matic'
 *   Object store: 'graphs'
 *   Keys: session names
 */

const DB_NAME = 'encode-o-matic';
const STORE = 'graphs';
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

async function idbList() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Save graph to the URL.
 * Updates window.location.href.
 * @param {object} graphJSON - plain JSON object from PipeGraph.toJSON()
 */
export async function saveToUrl(graphJSON) {
  const json = JSON.stringify(graphJSON);

  const encoded = toBase64Url(json);
  const url = new URL(window.location.href);
  url.searchParams.set('g', encoded);
  url.searchParams.delete('gid');

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

/**
 * List saved sessions, newest first.
 * @returns {Promise<{name: string, savedAt: number}[]>}
 */
export async function listIdbSessions() {
  const records = await idbList();
  return records
    .map(record => ({ name: record.id, savedAt: record.savedAt }))
    .sort((a, b) => b.savedAt - a.savedAt || a.name.localeCompare(b.name));
}

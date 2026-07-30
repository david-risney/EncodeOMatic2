/**
 * State management — serializes graphs into shareable URLs and persists
 * named sessions in IndexedDB.
 *
 * URL format:
 *   ?g=<base64url-json>          — complete graph state (uncompressed)
 *   ?gc=<base64url-deflate-json> — complete graph state (deflate-raw compressed)
 * IDB:
 *   Database: 'encode-o-matic'
 *   Object store: 'graphs'
 *   Keys: session names
 */

const DB_NAME = 'encode-o-matic';
const STORE = 'graphs';

/** Reserved IDB key used for automatic session persistence. */
const AUTOSAVE_ID = '__autosave__';
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

function toBase64UrlBytes(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64UrlBytes(b64) {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compressString(str) {
  const bytes = new TextEncoder().encode(str);
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const compressed = input.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

async function decompressString(bytes) {
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const decompressed = input.pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(await new Response(decompressed).arrayBuffer());
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

// ── Public API ───────────────────────────────────────────────────

/**
 * Save graph to the URL.
 * Updates window.location.href.
 * Compresses the JSON with deflate-raw if that produces a shorter base64url string.
 * @param {object} graphJSON - plain JSON object from PipeGraph.toJSON()
 */
export async function saveToUrl(graphJSON) {
  const json = JSON.stringify(graphJSON);
  const uncompressed = toBase64Url(json);

  const url = new URL(window.location.href);
  url.searchParams.delete('gid');

  let useCompressed = false;
  try {
    const compressedBytes = await compressString(json);
    const compressed = toBase64UrlBytes(compressedBytes);
    if (compressed.length < uncompressed.length) {
      useCompressed = true;
      url.searchParams.set('gc', compressed);
      url.searchParams.delete('g');
    }
  } catch {
    // CompressionStream not available; fall through to uncompressed
  }

  if (!useCompressed) {
    url.searchParams.set('g', uncompressed);
    url.searchParams.delete('gc');
  }

  window.history.replaceState({}, '', url.toString());
  return url.toString();
}

/**
 * Load graph from URL params or IDB.
 * Supports both compressed (?gc=) and uncompressed (?g=) formats.
 * @returns {Promise<object|null>} plain JSON object or null
 */
export async function loadFromUrl() {
  const params = new URLSearchParams(window.location.search);

  if (params.has('gc')) {
    try {
      const bytes = fromBase64UrlBytes(params.get('gc'));
      const json = await decompressString(bytes);
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to decode graph from URL:', e);
      return null;
    }
  }

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
      return await loadFromIdb(params.get('gid'));
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
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id, data: graphJSON, savedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Load a named graph from IDB.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function loadFromIdb(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result?.data ?? null);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * List saved sessions, newest first.
 * Reserved internal entries (IDs starting with "__") are excluded.
 * @returns {Promise<{name: string, savedAt: number}[]>}
 */
export async function listIdbSessions() {
  const db = await openDb();
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return records
    .filter(record => !record.id.startsWith('__'))
    .map(record => ({ name: record.id, savedAt: record.savedAt }))
    .sort((a, b) => b.savedAt - a.savedAt || a.name.localeCompare(b.name));
}

/**
 * Save the current graph as the autosave session.
 * Called automatically on every graph change so the last state can be
 * restored when the app is opened without URL session parameters.
 * @param {object} graphJSON
 */
export async function saveAutosession(graphJSON) {
  return saveToIdb(AUTOSAVE_ID, graphJSON);
}

/**
 * Load the autosave session.
 * @returns {Promise<object|null>} plain JSON object or null
 */
export async function loadAutosession() {
  return loadFromIdb(AUTOSAVE_ID);
}

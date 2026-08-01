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

const EXAMPLE_SAML_REDIRECT_URL = 'https://idp.example.com/sso?SAMLRequest=fZDNCoJQEIVfRe4%2BvRpEDCoIbYLaVLRoE5MOKHh%2FujNCj58ZgW6C2cycme8cJmc0vYdqkNae6DkQS%2FQyvWWYhEINwYJD7hgsGmKQGs7V8QBZrMEHJ652vYr2u0Ld8VGn2VpFVwrcOVuocWeUmAfaWxa0Mo50tlnp7UqnF61hqpuKdqNtZ1Gmq1bEMyRJ1%2FiYXmh8T3HtTMLsVJl%2FYsHEDLOg%2F3MiM4UPXJU%2FOC%2FZhgQbFMyTGb%2F8dsvvlG8%3D&RelayState=https%3A%2F%2Fsp.example.com%2Fwelcome';
const EXAMPLE_QC_URL = 'https://david-risney.github.io/EncodeOMatic2/?qc=Lc69CsJQDAXgVwmZ1UHEoaPURRBFdBKHcBvpxfvX5EoF8d1NxSXDF05O3pgoMja4TS53fNhT9W4JHceMM3z41NlucHN-USyBzYovrNhc8SLhSKIshhtSXq-eElqezpi0fA9U-UTjRLEIqxrvNKd_6jbDlOvUfe69gv4KQPs8KtiAmsEnLewqEAwOCom9WlkW-PkC';
const EXAMPLE_ABNF_GRAMMAR = [
  'request-line = method SP request-target SP http-version CRLF',
  'method = 1*tchar',
  'request-target = 1*VCHAR',
  'http-version = "HTTP/" DIGIT "." DIGIT',
  'tchar = ALPHA / DIGIT / "!" / "#" / "$" / "%" / "&" / "\'" / "*" / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"',
  'SP = %x20',
  'CRLF = %x0D.0A',
  'VCHAR = %x21-7E',
  'ALPHA = %x41-5A / %x61-7A',
  'DIGIT = %x30-39',
].join('\n');

function createPipeData(id, type, x, y, configs = {}) {
  return {
    id,
    type,
    configs,
    position: { x, y },
  };
}

function createConnection(fromPipeId, fromOutput, toPipeId, toInput) {
  return { fromPipeId, fromOutput, toPipeId, toInput };
}

function cloneGraphJSON(graphJSON) {
  return JSON.parse(JSON.stringify(graphJSON));
}

const DEFAULT_SESSION_RECORDS = [
  {
    name: 'Example: SAML Redirect Decode',
    data: {
      pipes: [
        createPipeData('pipe-1', 'InputPipe', 60, 80, { text: EXAMPLE_SAML_REDIRECT_URL, rawBytes: null }),
        createPipeData('pipe-2', 'UrlParser', 280, 80),
        createPipeData('pipe-3', 'Base64Decode', 500, 80),
        createPipeData('pipe-4', 'DeflateRawDecompress', 720, 80),
        createPipeData('pipe-10', 'XmlParser', 940, 80),
      ],
      connections: [
        createConnection('pipe-1', 'output', 'pipe-2', 'input'),
        createConnection('pipe-2', 'query:SAMLRequest', 'pipe-3', 'input'),
        createConnection('pipe-3', 'output', 'pipe-4', 'input'),
        createConnection('pipe-4', 'output', 'pipe-10', 'input'),
      ],
    },
  },
  {
    name: 'Example: EncodeOMatic2 qc URL Decode',
    data: {
      pipes: [
        createPipeData('pipe-5', 'InputPipe', 60, 80, { text: EXAMPLE_QC_URL, rawBytes: null }),
        createPipeData('pipe-6', 'UrlParser', 280, 80),
        createPipeData('pipe-7', 'Base64urlDecode', 500, 80),
        createPipeData('pipe-8', 'DeflateRawDecompress', 720, 80),
        createPipeData('pipe-9', 'JsonParser', 940, 80),
      ],
      connections: [
        createConnection('pipe-5', 'output', 'pipe-6', 'input'),
        createConnection('pipe-6', 'query:qc', 'pipe-7', 'input'),
        createConnection('pipe-7', 'output', 'pipe-8', 'input'),
        createConnection('pipe-8', 'output', 'pipe-9', 'input'),
      ],
    },
  },
  {
    name: 'Example: AES-GCM Decryption',
    data: {
      pipes: [
        createPipeData('decrypt-ciphertext', 'InputPipe', 40, 60, {
          text: 'a918cb151feb7b697f5e78ec857d978ba93998f5e8ee439d19950f773af9387c19ac98a4b7f2813e5c13d0feb3dbdac836b88b',
          rawBytes: null,
        }),
        createPipeData('decode-ciphertext', 'HexDecode', 290, 60),
        createPipeData('decrypt-key', 'InputPipe', 40, 240, {
          text: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
          rawBytes: null,
        }),
        createPipeData('decode-key', 'HexDecode', 290, 240),
        createPipeData('decrypt-nonce', 'InputPipe', 40, 420, {
          text: '202122232425262728292a2b',
          rawBytes: null,
        }),
        createPipeData('decode-nonce', 'HexDecode', 290, 420),
        createPipeData('decrypt-aes-gcm', 'CipherDecrypt', 540, 220, { algorithm: 'AES-GCM' }),
        createPipeData('parse-plaintext', 'JsonParser', 790, 220),
      ],
      connections: [
        createConnection('decrypt-ciphertext', 'output', 'decode-ciphertext', 'input'),
        createConnection('decode-ciphertext', 'output', 'decrypt-aes-gcm', 'input'),
        createConnection('decrypt-key', 'output', 'decode-key', 'input'),
        createConnection('decode-key', 'output', 'decrypt-aes-gcm', 'key'),
        createConnection('decrypt-nonce', 'output', 'decode-nonce', 'input'),
        createConnection('decode-nonce', 'output', 'decrypt-aes-gcm', 'nonce'),
        createConnection('decrypt-aes-gcm', 'output', 'parse-plaintext', 'input'),
      ],
    },
  },
  {
    name: 'Example: ABNF HTTP Request Line',
    data: {
      pipes: [
        createPipeData('request-line-base64', 'InputPipe', 40, 80, {
          text: 'R0VUIC9hcGkvaXRlbXM/aWQ9NDIgSFRUUC8xLjENCg==',
          rawBytes: null,
        }),
        createPipeData('decode-request-line', 'Base64Decode', 290, 80),
        createPipeData('request-line-grammar', 'InputPipe', 290, 300, {
          text: EXAMPLE_ABNF_GRAMMAR,
          rawBytes: null,
        }),
        createPipeData('parse-request-line', 'AbnfParser', 560, 150, {
          startRule: 'request-line',
          captureRules: 'method,request-target,http-version',
        }),
      ],
      connections: [
        createConnection('request-line-base64', 'output', 'decode-request-line', 'input'),
        createConnection('decode-request-line', 'output', 'parse-request-line', 'input'),
        createConnection('request-line-grammar', 'output', 'parse-request-line', 'grammar'),
      ],
    },
  },
  {
    name: 'Example: ASN.1 DER Inspection',
    data: {
      pipes: [
        createPipeData('asn1-base64', 'InputPipe', 60, 100, {
          text: 'MAoCAQUWBWhlbGxv',
          rawBytes: null,
        }),
        createPipeData('decode-asn1', 'Base64Decode', 310, 100),
        createPipeData('parse-asn1', 'Asn1Parser', 560, 100),
        createPipeData('inspect-asn1-json', 'JsonParser', 810, 100, {
          paths: 'idBlock.tagNumber,valueBlock.value[0].valueBlock.valueDec',
        }),
      ],
      connections: [
        createConnection('asn1-base64', 'output', 'decode-asn1', 'input'),
        createConnection('decode-asn1', 'output', 'parse-asn1', 'input'),
        createConnection('parse-asn1', 'json', 'inspect-asn1-json', 'input'),
      ],
    },
  },
  {
    name: 'Example: Fix Mojibake',
    data: {
      pipes: [
        createPipeData('mojibake-text', 'InputPipe', 80, 120, {
          text: 'Itâ€™s a cafÃ©.',
          rawBytes: null,
        }),
        createPipeData('recover-original-bytes', 'CharsetEncode', 350, 120, {
          toEncoding: 'windows-1252',
        }),
        createPipeData('decode-original-text', 'CharsetDecode', 620, 120, {
          fromEncoding: 'utf-8',
          fatal: true,
        }),
      ],
      connections: [
        createConnection('mojibake-text', 'output', 'recover-original-bytes', 'input'),
        createConnection('recover-original-bytes', 'output', 'decode-original-text', 'input'),
      ],
    },
  },
];
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

export function listDefaultSessions() {
  return DEFAULT_SESSION_RECORDS.map(({ name }) => ({ name }));
}

export function loadDefaultSession(name) {
  const record = DEFAULT_SESSION_RECORDS.find(session => session.name === name);
  return record ? cloneGraphJSON(record.data) : null;
}

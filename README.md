# Encode-O-Matic 2

A client-side visual encoding/decoding pipeline tool, hosted on [GitHub Pages](https://david-risney.github.io/EncodeOMatic2/).

## Features

- **Visual pipe graph editor** — add, connect, and configure encoding/decoding pipes on a 2D canvas
- **Live data flow** — see data transform as it flows through the graph in real time
- **Text and hex views** — inspect data in a right-side pane, with pinning for comparing nodes
- **Live URL state** — the current graph is always reflected in a shareable URL
- **Named sessions** — save and load graphs locally with IndexedDB
- **Encoding guesses** — build a likely decoding chain from applicability scores
- **Worker threads** — pipe processing runs off the main thread using a Web Worker pool
- **Offline support** — install the app and keep using its complete toolset without a network connection

## Built-in Pipes

### Input
- **Input Buffer** — type or paste text to feed into the graph

### Encoding
- **Base64 Encode / Decode**
- **Base64url Encode / Decode** (URL-safe, unpadded)
- **Base32 Encode / Decode** (RFC 4648 standard and hex alphabets)
- **Base58 Encode / Decode** (Bitcoin/IPFS alphabet)
- **Ascii85 Encode / Decode** (Adobe/PostScript Base85)
- **Percent Encode / Decode** (URL encoding, RFC 3986; supports custom character-set via regex)
- **Quoted-Printable Encode / Decode**
- **Hex Encode / Decode**
- **HTML Encode / Decode** (all 2099 HTML5 named character references via the `he` library)
- **XML Encode / Decode**
- **Charset Decode / Encode** (UTF-8, UTF-16, ISO-8859-1, GBK, Shift-JIS, and more via iconv-lite)
- **Binary Encode / Decode** (base-2 bit strings)
- **Slash Escape / Unescape** (C-style backslash sequences)
- **CSS Escape / Unescape**
- **URL Encode / Decode** (`encodeURI` / `decodeURI`)
- **ROT** (Caesar cipher, configurable rotation)
- **Gzip Compress / Decompress**
- **Deflate Compress / Decompress**
- **Form URL-encoded Encode / Decode** (application/x-www-form-urlencoded)
- **HMAC** (SHA-1/SHA-256/SHA-512)
- **MIME Header Decode / Encode** (RFC 2047 encoded words via emailjs-mime-codec)
- **SHA Hash** (SHA-1/SHA-224/SHA-256/SHA-384/SHA-512)
- **SHA-3 Hash** (SHA3-224/SHA3-256/SHA3-384/SHA3-512)
- **Keccak Hash** (Keccak-224/Keccak-256/Keccak-384/Keccak-512)
- **BLAKE2b Hash / BLAKE2s Hash / BLAKE3 Hash**
- **MD4 Hash / MD5 Hash / RIPEMD-160 Hash / SM3 Hash / Whirlpool Hash**
- **CRC-32 / CRC-32C / CRC-64 / Adler-32**
- **xxHash32 / xxHash64 / xxHash3 / xxHash128**
- **Unicode Escape Encode / Decode** (\\uXXXX / \\u{XXXXX})
- **Unicode Normalize** (NFC/NFD/NFKC/NFKD)
- **Punycode Encode / Decode** (internationalized domain names, xn--)
- **Fullwidth to Halfwidth / Halfwidth to Fullwidth** (Unicode character width conversion)
- **String Reverse** (grapheme-cluster-aware)

### Parsing
- **URL Parser** — splits a URL into protocol, hostname, path, query params (one output per param), hash
- **JSON Parser** — parses JSON and exposes top-level keys as separate outputs
- **Regex Match** — applies a regex and exposes capture groups as outputs
- **Cookie Parser**
- **CSV Parser**
- **HTTP Request / Response Parser**
- **JWT Parser**
- **Search Params Parser**

## Usage

1. Click **+ Add Pipe** to add a pipe to the canvas
2. Drag pipes to reposition them
3. Drag from an output port (bottom) to an input port (top) to connect pipes
4. Click a port to view the data flowing through it
5. Pin data views to keep them open while selecting other nodes; pinned views can be minimized
6. Click ⚙ on a pipe to configure it
7. Click 🔗 to share the current URL, or use **Session** to save and load named local sessions

## Example: Decode a URL-encoded, Base64-encoded, UTF-8 string

1. Add an **Input Buffer** pipe and type a URL like `https://example.com?q=SGVsbG8gV29ybGQ%3D`
2. Add a **URL Parser** pipe — auto-connects to the input buffer
3. Click ⚙ to add a **Percent Decode** pipe connected to the `query:q` output of the URL parser
4. Add a **Base64 Decode** pipe connected to the percent decode output
5. Add a **Charset Decode** pipe (set to `utf-8`) connected to the base64 decode output
6. Click the final output port to see `Hello World`

## Technical Details

- Pure client-side JavaScript, HTML, CSS — no framework
- Uses modern Web APIs: Web Components (`customElements`), Web Workers, IndexedDB, URL API
- ES modules throughout (`type="module"`)
- Hosted on GitHub Pages (no server required)
- Installable PWA with a versioned, precached application shell
- The `vendor/iconv-lite.js` bundle is checked in; rebuild it with `npm run build:vendor` when updating `iconv-lite`

## Development

Serve the repository root with any static file server:

```sh
# Using Python
python3 -m http.server 8080

# Using Node.js npx
npx serve .
```

Then open `http://localhost:8080` in your browser.

### Vendor bundles

Several encoding libraries are bundled as pre-built ESM files in `vendor/` and committed to the repository so GitHub Pages can serve them without a CI build step.
Regenerate all vendor bundles after updating any of these dependencies:

| File | Library | Purpose |
|------|---------|---------|
| `vendor/iconv-lite.js` | iconv-lite | Charset encode/decode |
| `vendor/he.js` | he | HTML entity encoding/decoding (all 2099 HTML5 named refs) |
| `vendor/mime-codec.js` | emailjs-mime-codec | MIME RFC 2047 encoded-word encode/decode |
| `vendor/rfc4648.js` | rfc4648 | Base32 encoding/decoding |
| `vendor/bs58.js` | bs58 | Base58 encoding/decoding |
| `vendor/hash-wasm.js` | hash-wasm | Hashing, checksums, and HMAC |
| `vendor/ascii85.js` | ascii85 | Ascii85/Base85 encoding/decoding |
| `vendor/punycode.js` | punycode | Internationalized domain name (IDN) encode/decode |

```sh
npm install
npm run build:vendor
```

### Tests

Install the development dependencies and run the Vitest/jsdom unit suite:

```sh
npm install
npm test
```

Use `npm run test:watch` while developing.

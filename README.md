# Encode-O-Matic 2

A client-side visual encoding/decoding pipeline tool, hosted on [GitHub Pages](https://david-risney.github.io/EncodeOMatic2/).

## Features

- **Visual pipe graph editor** — add, connect, and configure encoding/decoding pipes on a 2D canvas
- **Live data flow** — see data transform as it flows through the graph in real time
- **Text and hex views** — inspect data as text or as colorized hex bytes
- **URL state** — share graphs via URL (small graphs embedded in URL; large graphs in IndexedDB with ID in URL)
- **Worker threads** — pipe processing runs off the main thread using a Web Worker pool

## Built-in Pipes

### Input
- **Input Buffer** — type or paste text to feed into the graph

### Encoding
- **Base64 Encode / Decode**
- **Percent Encode / Decode** (URL encoding, RFC 3986)
- **Hex Encode / Decode**
- **HTML Encode / Decode**
- **XML Encode / Decode**
- **Charset Decode / Encode** (UTF-8, UTF-16, ISO-8859-1, GBK, Shift-JIS, and more)
- **Binary Encode / Decode** (base-2 bit strings)
- **Slash Escape / Unescape** (C-style backslash sequences)
- **URL Encode / Decode** (`encodeURI` / `decodeURI`)

### Parsing
- **URL Parser** — splits a URL into protocol, hostname, path, query params (one output per param), hash
- **JSON Parser** — parses JSON and exposes top-level keys as separate outputs
- **Regex Match** — applies a regex and exposes capture groups as outputs

## Usage

1. Click **+ Add Pipe** to add a pipe to the canvas
2. Drag pipes to reposition them
3. Drag from an output port (bottom) to an input port (top) to connect pipes
4. Click a port to view the data flowing through it
5. Click ⚙ on a pipe to configure it
6. Click **Save to URL** to copy a shareable URL to your clipboard

## Example: Decode a URL-encoded, Base64-encoded, UTF-8 string

1. Add an **Input Buffer** pipe and type a URL like `https://example.com?q=SGVsbG8gV29ybGQ%3D`
2. Add a **URL Parser** pipe — auto-connects to the input buffer
3. Click ⚙ to add a **Percent Decode** pipe connected to the `query:q` output of the URL parser
4. Add a **Base64 Decode** pipe connected to the percent decode output
5. Add a **Charset Decode** pipe (set to `utf-8`) connected to the base64 decode output
6. Click the final output port to see `Hello World`

## Technical Details

- Pure client-side JavaScript, HTML, CSS — no framework, no build step
- Uses modern Web APIs: Web Components (`customElements`), Web Workers, IndexedDB, URL API
- ES modules throughout (`type="module"`)
- Hosted on GitHub Pages (no server required)

## Development

No build step needed. Serve the repository root with any static file server:

```sh
# Using Python
python3 -m http.server 8080

# Using Node.js npx
npx serve .
```

Then open `http://localhost:8080` in your browser.

/**
 * MIME Parse pipe.
 *
 * Parses a MIME message (RFC 2045/2046) or a bare multipart body into its
 * headers and parts using emailjs-mime-parser. Transfer encodings
 * (base64, quoted-printable) and RFC 2047 header words are decoded by the
 * library, so each part output holds the decoded bytes.
 *
 * Inputs:
 *   - input (default)   — raw MIME message or multipart body bytes
 *
 * Configs:
 *   - contentType       — Content-Type header to use when the input is a bare
 *                         body without headers (e.g. an HTTP multipart body)
 *
 * Outputs:
 *   - structure (default) — JSON description of the MIME tree
 *   - header:NAME         — dynamic port: top-level header value
 *   - part:PATH           — dynamic port: decoded bytes of a leaf part
 */

import { Pipe, PipeConfig, PipeError, PortDef } from '../../pipe.js';
import { parseMime } from '../../../../vendor/mime-parser.js';
import { bytesToBinaryString } from '../encoding/binary-string.js';

const UTF8_ENCODER = new TextEncoder();
const MULTIPART_CONTENT_TYPE_PATTERN = /^content-type:\s*multipart\//im;
const MIME_HEADER_PATTERN = /^(?:mime-version|content-type|content-transfer-encoding|content-disposition):/im;

/** Human-readable header value for a parsed header entry. */
function headerEntryText(entry) {
  if (entry == null) return '';
  const { value } = entry;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map(item => (item && typeof item === 'object'
        ? [item.name, item.address].filter(Boolean).join(' ').trim() || JSON.stringify(item)
        : String(item)))
      .join(', ');
  }
  if (value == null) return entry.initial ?? '';
  return String(value);
}

function contentTypeOf(node) {
  return node.contentType?.value ?? '';
}

function filenameOf(node) {
  const disposition = node.headers?.['content-disposition']?.[0];
  return disposition?.params?.filename
    ?? node.contentType?.params?.name
    ?? '';
}

function fieldNameOf(node) {
  return node.headers?.['content-disposition']?.[0]?.params?.name ?? '';
}

export class MimeParserPipe extends Pipe {
  static typeName = 'MimeParser';
  static typeDescription = 'MIME Parse';
  static category = 'Data Formats';
  static categoryDescription = 'Parse a MIME message or multipart body into headers and decoded parts.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(0, 4096));
    } catch {
      return 0;
    }
    if (/^(?:HTTP\/|GET |POST |PUT |HEAD |DELETE |PATCH |OPTIONS )/.test(text)) return 0;
    if (MULTIPART_CONTENT_TYPE_PATTERN.test(text)) return 10;
    if (MIME_HEADER_PATTERN.test(text)) return 5;
    if (/^--[^\r\n]+\r?\n/.test(text)) return 5;
    return 0;
  }

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'contentType',
        description: 'Content-Type header to prepend when the input has no MIME headers '
          + '(for example multipart/form-data; boundary=...)',
        defaultValue: '',
        type: 'string',
      }),
    ];
  }

  defineOutputs() {
    return [
      new PortDef('structure', 'MIME tree structure as JSON', true),
      ...(this._dynamicOutputs ?? []),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    if (data.length === 0) {
      throw new PipeError('MIME input is empty');
    }

    let message = bytesToBinaryString(data);
    const contentType = (this.getConfig('contentType')?.value ?? '').trim();
    if (contentType) {
      message = `Content-Type: ${contentType}\r\n\r\n${message}`;
    }

    let root;
    try {
      root = parseMime(message);
    } catch (e) {
      throw new PipeError(`Cannot parse MIME data: ${e?.message ?? String(e)}`);
    }

    const result = new Map();
    const dynamicOutputs = [];

    const addPort = (name, description, bytes) => {
      dynamicOutputs.push(new PortDef(name, description));
      if (!this._outputData.has(name)) {
        this._outputData.set(name, null);
      }
      result.set(name, bytes);
    };

    for (const [name, entries] of Object.entries(root.headers ?? {})) {
      const value = entries.map(headerEntryText).join('\n');
      addPort(`header:${name}`, `Header: ${name}`, UTF8_ENCODER.encode(value));
    }

    const describe = (node, path) => {
      const children = node.childNodes ?? [];
      const description = {
        path,
        contentType: contentTypeOf(node),
        charset: node.charset ?? '',
        contentTransferEncoding: node.contentTransferEncoding?.value ?? '',
        headers: Object.fromEntries(
          Object.entries(node.headers ?? {}).map(([name, entries]) => [name, entries.map(headerEntryText).join('\n')])
        ),
      };

      const filename = filenameOf(node);
      if (filename) description.filename = filename;
      const fieldName = fieldNameOf(node);
      if (fieldName) description.name = fieldName;

      if (children.length > 0) {
        description.parts = children.map((child, index) => describe(child, path ? `${path}.${index + 1}` : `${index + 1}`));
        return description;
      }

      const content = node.content ?? new Uint8Array(0);
      description.size = content.length;
      const label = [filename, fieldName, contentTypeOf(node)].find(Boolean) ?? 'part';
      addPort(`part:${path}`, `Part ${path}: ${label}`, content);
      return description;
    };

    const rootChildren = root.childNodes ?? [];
    const structure = rootChildren.length > 0 ? describe(root, '') : describe(root, '1');

    this._dynamicOutputs = dynamicOutputs;
    result.set('structure', UTF8_ENCODER.encode(JSON.stringify(structure, null, 2)));
    return result;
  }
}

export const builtinPipes = [MimeParserPipe];

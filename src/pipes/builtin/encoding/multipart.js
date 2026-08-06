/**
 * MIME multipart encode pipe.
 *
 * Builds an RFC 2046 multipart body (multipart/mixed, multipart/form-data, …)
 * from one or more wired part inputs. Use the MIME Parse pipe for the
 * inverse direction.
 *
 * Inputs:
 *   - part1 (default) … partN — part payload bytes (count set by partCount)
 *
 * Outputs:
 *   - output (default) — the multipart body bytes
 *   - contentType      — media type including the boundary parameter
 */

import { Pipe, PipeConfig, PipeError, PortDef } from '../../pipe.js';
import { encodeQuotedPrintable } from './quoted-printable.js';
import { bytesToBinaryString } from './binary-string.js';

const UTF8_ENCODER = new TextEncoder();
const DEFAULT_BOUNDARY = 'EncodeOMaticBoundary';
const MAX_PARTS = 16;
// RFC 2046 bchars, with the trailing character restricted to bcharsnospace.
const BOUNDARY_PATTERN = /^[0-9A-Za-z'()+_,\-./:=? ]{0,69}[0-9A-Za-z'()+_,\-./:=?]$/;

function splitList(value) {
  return String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

/** Value at index, falling back to the last entry, then to a default. */
function pickListValue(list, index, fallback) {
  if (list.length === 0) return fallback;
  return list[Math.min(index, list.length - 1)];
}

/** Break a Base64 string into 76-character lines as required by RFC 2045. */
function wrapBase64(text) {
  return (text.match(/.{1,76}/g) ?? []).join('\r\n');
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Quote a Content-Disposition parameter value. */
function quoteParam(value) {
  return `"${value.replace(/["\\\r\n]/g, '')}"`;
}

export class MimeMultipartEncodePipe extends Pipe {
  static typeName = 'MimeMultipartEncode';
  static typeDescription = 'MIME Multipart Encode';
  static category = 'Data Formats';
  static categoryDescription = 'Build an RFC 2046 multipart body from one or more part inputs.';

  defineInputs() {
    const count = this._partCount();
    return Array.from({ length: count }, (_, index) => new PortDef(
      `part${index + 1}`,
      `Part ${index + 1} payload bytes`,
      index === 0
    ));
  }

  defineOutputs() {
    return [
      new PortDef('output', 'Multipart body bytes', true),
      new PortDef('contentType', 'Content-Type value including the boundary'),
    ];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'partCount',
        description: `Number of part inputs (1-${MAX_PARTS})`,
        defaultValue: 2,
        type: 'number',
      }),
      new PipeConfig({
        name: 'subtype',
        description: 'Multipart subtype',
        defaultValue: 'mixed',
        type: 'select',
        options: ['mixed', 'form-data', 'alternative', 'related', 'digest', 'parallel'],
      }),
      new PipeConfig({
        name: 'boundary',
        description: 'Boundary delimiter (without the leading dashes)',
        defaultValue: DEFAULT_BOUNDARY,
        type: 'string',
      }),
      new PipeConfig({
        name: 'contentTypes',
        description: 'Comma-separated Content-Type per part; the last entry applies to remaining parts',
        defaultValue: 'text/plain; charset=utf-8',
        type: 'string',
      }),
      new PipeConfig({
        name: 'fieldNames',
        description: 'Comma-separated form-data field names (multipart/form-data only)',
        defaultValue: '',
        type: 'string',
      }),
      new PipeConfig({
        name: 'transferEncoding',
        description: 'Content-Transfer-Encoding applied to every part',
        defaultValue: 'none',
        type: 'select',
        options: ['none', 'base64', 'quoted-printable'],
      }),
      new PipeConfig({
        name: 'includeHeaders',
        description: 'Prepend MIME-Version and top-level Content-Type headers',
        defaultValue: false,
        type: 'boolean',
      }),
    ];
  }

  _partCount() {
    const raw = Number(this.getConfig('partCount')?.value ?? 2);
    if (!Number.isFinite(raw)) return 2;
    return Math.min(MAX_PARTS, Math.max(1, Math.floor(raw)));
  }

  async process(inputs) {
    const count = this._partCount();
    const subtype = this.getConfig('subtype')?.value ?? 'mixed';
    const boundary = String(this.getConfig('boundary')?.value ?? '').trim() || DEFAULT_BOUNDARY;
    const contentTypes = splitList(this.getConfig('contentTypes')?.value);
    const fieldNames = splitList(this.getConfig('fieldNames')?.value);
    const transferEncoding = this.getConfig('transferEncoding')?.value ?? 'none';
    const includeHeaders = this.getConfig('includeHeaders')?.value === true;

    if (!BOUNDARY_PATTERN.test(boundary)) {
      throw new PipeError(`Invalid multipart boundary: ${boundary}`);
    }

    const chunks = [];
    if (includeHeaders) {
      chunks.push(UTF8_ENCODER.encode(
        `MIME-Version: 1.0\r\nContent-Type: multipart/${subtype}; boundary="${boundary}"\r\n\r\n`
      ));
    }

    for (let index = 0; index < count; index++) {
      const payload = inputs.get(`part${index + 1}`) ?? new Uint8Array(0);
      const contentType = pickListValue(contentTypes, index, 'text/plain; charset=utf-8');

      let headers = `--${boundary}\r\n`;
      if (subtype === 'form-data') {
        const fieldName = pickListValue(fieldNames, index, '') || `field${index + 1}`;
        headers += `Content-Disposition: form-data; name=${quoteParam(fieldName)}\r\n`;
      }
      headers += `Content-Type: ${contentType}\r\n`;

      let body;
      if (transferEncoding === 'base64') {
        headers += 'Content-Transfer-Encoding: base64\r\n';
        body = UTF8_ENCODER.encode(wrapBase64(btoa(bytesToBinaryString(payload))));
      } else if (transferEncoding === 'quoted-printable') {
        headers += 'Content-Transfer-Encoding: quoted-printable\r\n';
        body = UTF8_ENCODER.encode(encodeQuotedPrintable(payload));
      } else {
        // A delimiter is CRLF + "--boundary", but lenient parsers also split on
        // a bare LF, so reject both forms plus a payload that starts with one.
        const binaryPayload = bytesToBinaryString(payload);
        if (binaryPayload.startsWith(`--${boundary}`) || binaryPayload.includes(`\n--${boundary}`)) {
          throw new PipeError(
            `Part ${index + 1} contains the boundary delimiter; choose another boundary or a transfer encoding`
          );
        }
        body = payload;
      }

      chunks.push(UTF8_ENCODER.encode(`${headers}\r\n`), body, UTF8_ENCODER.encode('\r\n'));
    }

    chunks.push(UTF8_ENCODER.encode(`--${boundary}--\r\n`));

    return new Map([
      ['output', concatBytes(chunks)],
      ['contentType', UTF8_ENCODER.encode(`multipart/${subtype}; boundary="${boundary}"`)],
    ]);
  }
}

export const builtinPipes = [MimeMultipartEncodePipe];

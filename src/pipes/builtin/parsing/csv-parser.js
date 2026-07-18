/**
 * CSV Parser pipe.
 *
 * Parses RFC 4180 CSV text and exposes each column as a dynamic output port.
 */

import { Pipe, PortDef, PipeConfig } from '../../pipe.js';

function parseCsv(text, delimiter) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuote = false;
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let i = 0;

  while (i < lines.length) {
    const c = lines[i];
    if (inQuote) {
      if (c === '"' && lines[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (c === '"') {
        inQuote = false;
        i++;
      } else {
        field += c;
        i++;
      }
    } else if (c === '"') {
      inQuote = true;
      i++;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
      i++;
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      i++;
    } else {
      field += c;
      i++;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export class CsvParserPipe extends Pipe {
  static typeName = 'CsvParser';
  static typeDescription = 'CSV Parse';
  static category = 'Parsing';
  static categoryDescription = 'Parse CSV text into columns as separate outputs.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;

    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return 0;
    }

    if (text.length === 0) return 0;

    const rows = parseCsv(text, ',');
    if (rows.length < 2) return 0;
    if (rows.some(row => row.length <= 1)) return 0;

    const width = rows[0].length;
    return rows.every(row => row.length === width) ? 5 : 0;
  }

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineOutputs() {
    return [...(this._dynamicOutputs ?? [])];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'hasHeader',
        description: 'First row is column names',
        defaultValue: true,
        type: 'boolean',
      }),
      new PipeConfig({
        name: 'delimiter',
        description: 'Column delimiter',
        defaultValue: ',',
        type: 'string',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(data).trimEnd();
    if (!text) {
      this._dynamicOutputs = [];
      return new Map();
    }

    const delimiter = this.getConfig('delimiter')?.value || ',';
    const hasHeader = this.getConfig('hasHeader')?.value ?? true;
    const rows = parseCsv(text, delimiter);
    if (rows.length === 0) {
      this._dynamicOutputs = [];
      return new Map();
    }

    const headerRow = hasHeader ? rows[0] : rows[0].map((_, i) => String(i));
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const enc = new TextEncoder();
    const result = new Map();
    this._dynamicOutputs = [];

    for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
      const colName = headerRow[colIdx];
      const portName = `col:${colName}`;
      this._dynamicOutputs.push(new PortDef(portName, `Column: ${colName}`));
      if (!this._outputData.has(portName)) this._outputData.set(portName, null);
      const values = dataRows.map(row => row[colIdx] ?? '').join('\n');
      result.set(portName, enc.encode(values));
    }

    return result;
  }
}

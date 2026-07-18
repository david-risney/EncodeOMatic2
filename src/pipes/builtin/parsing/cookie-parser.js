import { Pipe, PipeError, PortDef, PipeConfig } from '../../pipe.js';

const SET_COOKIE_VALUE_FIELDS = new Map([
  ['path', 'Path'],
  ['domain', 'Domain'],
  ['expires', 'Expires'],
  ['max-age', 'Max-Age'],
  ['samesite', 'SameSite'],
]);

const SET_COOKIE_BOOLEAN_FIELDS = new Map([
  ['secure', 'Secure'],
  ['httponly', 'HttpOnly'],
]);

function splitNameValue(segment) {
  const separatorIndex = segment.indexOf('=');
  if (separatorIndex === -1) {
    return [segment, ''];
  }
  return [segment.slice(0, separatorIndex), segment.slice(separatorIndex + 1)];
}

export class CookieParserPipe extends Pipe {
  static typeName = 'CookieParser';
  static typeDescription = 'Cookie Parse';
  static category = 'Parsing';
  static categoryDescription = 'Parse a Cookie or Set-Cookie header value into fields.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    return text.includes('=') && !text.includes(':') ? 5 : 0;
  }

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'mode',
        description: 'Whether to parse a Cookie or Set-Cookie header value',
        defaultValue: 'Cookie',
        type: 'select',
        options: ['Cookie', 'Set-Cookie'],
      }),
    ];
  }

  defineOutputs() {
    return [...(this._dynamicOutputs ?? [])];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder('utf-8').decode(data).trim();
    if (text.length === 0) {
      throw new PipeError('Cookie header value is empty');
    }

    const enc = new TextEncoder();
    const result = new Map();
    const dynamicOutputs = [];
    const mode = this.getConfig('mode')?.value ?? 'Cookie';
    const fields = text.split(';').map(part => part.trim()).filter(Boolean);

    const addField = (name, value) => {
      const portName = `key:${name}`;
      dynamicOutputs.push(new PortDef(portName, `Cookie field: ${name}`));
      if (!this._outputData.has(portName)) {
        this._outputData.set(portName, null);
      }
      result.set(portName, enc.encode(value));
    };

    if (mode === 'Set-Cookie') {
      const [cookieName = '', cookieValue = ''] = splitNameValue(fields.shift() ?? '');
      addField('name', cookieName.trim());
      addField('value', cookieValue.trim());

      for (const field of fields) {
        const [rawName, rawValue] = splitNameValue(field);
        const normalizedName = rawName.trim().toLowerCase();
        const valueFieldName = SET_COOKIE_VALUE_FIELDS.get(normalizedName);
        if (valueFieldName) {
          addField(valueFieldName, rawValue.trim());
          continue;
        }
        const booleanFieldName = SET_COOKIE_BOOLEAN_FIELDS.get(normalizedName);
        if (booleanFieldName) {
          addField(booleanFieldName, 'true');
        }
      }
    } else {
      for (const field of fields) {
        const [rawName, rawValue] = splitNameValue(field);
        addField(rawName.trim(), rawValue.trim());
      }
    }

    this._dynamicOutputs = dynamicOutputs;
    return result;
  }
}

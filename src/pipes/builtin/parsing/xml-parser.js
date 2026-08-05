/**
 * XML Parser pipe.
 *
 * Parses XML and exposes root attributes and direct child elements as outputs.
 * When the `xpaths` config is set, only the specified XPath expressions are
 * exposed instead.
 */

import { Pipe, PortDef, PipeConfig, PipeError } from '../../pipe.js';

const PARSER_ERROR_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml';

/**
 * Returns the parse error message when the parsed document represents a failure.
 *
 * Browsers report XML parse failures differently: some produce a `parsererror`
 * root element while others wrap it inside an HTML document, so look for the
 * element anywhere in the tree.
 */
function getParseError(document) {
  const root = document.documentElement;
  if (!root) return 'parse error';
  const errorElement = document.getElementsByTagNameNS(PARSER_ERROR_NS, 'parsererror')[0]
    ?? (root.localName === 'parsererror' ? root : null)
    ?? document.querySelector('parsererror');
  if (!errorElement) return null;
  return errorElement.textContent?.trim() || 'parse error';
}

function serializeNode(serializer, node) {
  if (node.nodeType === Node.ATTRIBUTE_NODE) return node.value;
  if (
    node.nodeType === Node.TEXT_NODE
    || node.nodeType === Node.CDATA_SECTION_NODE
    || node.nodeType === Node.COMMENT_NODE
  ) {
    return node.nodeValue ?? '';
  }
  return serializer.serializeToString(node);
}

function evaluateXPath(document, expression, serializer) {
  const result = document.evaluate(
    expression,
    document,
    document.createNSResolver(document.documentElement),
    XPathResult.ANY_TYPE,
    null
  );

  switch (result.resultType) {
    case XPathResult.STRING_TYPE:
      return result.stringValue;
    case XPathResult.NUMBER_TYPE:
      return String(result.numberValue);
    case XPathResult.BOOLEAN_TYPE:
      return String(result.booleanValue);
    default: {
      const values = [];
      let node;
      while ((node = result.iterateNext())) values.push(serializeNode(serializer, node));
      return values.join('\n');
    }
  }
}

export class XmlParserPipe extends Pipe {
  static typeName = 'XmlParser';
  static typeDescription = 'XML Parser';
  static category = 'Data Formats';
  static categoryDescription = 'Parse XML and expose root attributes, child elements, or XPath results.';
  static supportsWorker = false;

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0 || typeof DOMParser !== 'function') return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (!text) return 0;
    const document = new DOMParser().parseFromString(text, 'application/xml');
    return getParseError(document) === null ? 10 : -10;
  }

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineOutputs() {
    return [
      new PortDef('xml', 'Parsed XML', true),
      new PortDef('text', 'Root element text content'),
      ...(this._dynamicOutputs ?? []),
    ];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'xpaths',
        description: 'Newline-delimited XPath expressions to expose as outputs. Leave empty to expose root attributes and direct child elements.',
        defaultValue: '',
        type: 'string',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      throw new PipeError('Invalid XML: input is not valid UTF-8');
    }

    const document = new DOMParser().parseFromString(text, 'application/xml');
    const parseError = getParseError(document);
    if (parseError !== null) throw new PipeError(`Invalid XML: ${parseError}`);
    const root = document.documentElement;

    const serializer = new XMLSerializer();
    const enc = new TextEncoder();
    const result = new Map([
      ['xml', enc.encode(serializer.serializeToString(document))],
      ['text', enc.encode(root.textContent ?? '')],
    ]);
    const xpaths = (this.getConfig('xpaths')?.value ?? '').trim();
    this._dynamicOutputs = [];

    if (xpaths) {
      for (const expression of [...new Set(xpaths.split('\n').map(path => path.trim()).filter(Boolean))]) {
        const portName = `xpath:${expression}`;
        this._dynamicOutputs.push(new PortDef(portName, `XPath: ${expression}`));
        if (!this._outputData.has(portName)) this._outputData.set(portName, null);
        try {
          result.set(portName, enc.encode(evaluateXPath(document, expression, serializer)));
        } catch (error) {
          throw new PipeError(`Invalid XPath "${expression}": ${error.message}`);
        }
      }
    } else {
      for (const attribute of root.attributes) {
        const portName = `attribute:${attribute.name}`;
        this._dynamicOutputs.push(new PortDef(portName, `Root attribute: ${attribute.name}`));
        if (!this._outputData.has(portName)) this._outputData.set(portName, null);
        result.set(portName, enc.encode(attribute.value));
      }

      const children = new Map();
      for (const child of root.children) {
        const nodes = children.get(child.nodeName) ?? [];
        nodes.push(child);
        children.set(child.nodeName, nodes);
      }
      for (const [name, nodes] of children) {
        const portName = `element:${name}`;
        this._dynamicOutputs.push(new PortDef(portName, `Child element: ${name}`));
        if (!this._outputData.has(portName)) this._outputData.set(portName, null);
        result.set(portName, enc.encode(nodes.map(node => serializeNode(serializer, node)).join('\n')));
      }
    }

    return result;
  }
}

export const builtinPipes = [XmlParserPipe];

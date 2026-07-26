/**
 * Web Input Pipe — fetches a URL with CORS and feeds the response body
 * downstream as raw bytes.
 */

import { Pipe, PipeConfig, PipeError, PortDef } from '../pipe.js';

export class WebInputPipe extends Pipe {
  static typeName = 'WebInputPipe';
  static typeDescription = 'Web Input';
  static category = 'Input';
  static categoryDescription = 'Fetch a URL over the network as graph input.';

  defineInputs() {
    return []; // No inputs — this is a source pipe
  }

  defineOutputs() {
    return [new PortDef('output', 'Response body as bytes', true)];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'url',
        description: 'URL to fetch',
        defaultValue: '',
        type: 'string',
      }),
    ];
  }

  async process(_inputs) {
    const url = this.getConfig('url')?.value ?? '';
    if (!url) {
      return new Map([['output', new Uint8Array(0)]]);
    }
    let response;
    try {
      response = await fetch(url, { mode: 'cors' });
    } catch (e) {
      throw new PipeError(`Fetch failed: ${e.message ?? String(e)}`);
    }
    if (!response.ok) {
      throw new PipeError(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return new Map([['output', new Uint8Array(buffer)]]);
  }
}

export const builtinPipes = [WebInputPipe];

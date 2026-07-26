import { Pipe, PipeConfig, PipeError } from '../../pipe.js';

export function selectConfig(name, description, defaultValue, options) {
  return new PipeConfig({
    name,
    description,
    defaultValue,
    type: 'select',
    options,
  });
}

export function numberConfig(name, description, defaultValue) {
  return new PipeConfig({
    name,
    description,
    defaultValue,
    type: 'number',
  });
}

export function getNumberConfig(pipe, name, fallback) {
  const value = Number(pipe.getConfig(name)?.value);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export function wrapHashError(error, fallback = 'Hashing failed') {
  if (error instanceof PipeError) {
    return error;
  }
  if (error instanceof Error && error.message) {
    return new PipeError(error.message);
  }
  return new PipeError(fallback);
}

export class HashWasmPipe extends Pipe {
  getInputBytes(inputs, portName = this.defaultInputName) {
    return inputs.get(portName) ?? new Uint8Array(0);
  }

  async processWithHasher(inputs, createHasher, fallback) {
    try {
      const hasher = await createHasher();
      hasher.init();
      hasher.update(this.getInputBytes(inputs));
      return new Map([['output', hasher.digest('binary')]]);
    } catch (error) {
      throw wrapHashError(error, fallback);
    }
  }
}

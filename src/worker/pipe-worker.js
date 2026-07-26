/**
 * Pipe Worker — runs pipe processing in a Web Worker thread.
 *
 * Messages received from main thread:
 *   { type: 'process', id, pipeType, configs, inputs }
 *   inputs: { portName: number[] }   (Uint8Array serialized as plain arrays)
 *
 * Messages sent back to main thread:
 *   { type: 'result', id, outputs, errors }
 *   outputs: { portName: number[] }
 *   errors: { message, selections }[]
 */

import { builtinPipes } from '../pipes/builtin/index.js';

export const workerRegistry = new Map(
  builtinPipes
    .filter(PipeClass => PipeClass.supportsWorker !== false)
    .map(PipeClass => [PipeClass.typeName, PipeClass])
);

self.onmessage = async ({ data }) => {
  if (data.type !== 'process') return;

  const { id, pipeType, configs, inputs } = data;

  const PipeClass = workerRegistry.get(pipeType);
  // Validate that PipeClass is a known, safe constructor from our registry
  // before instantiating it. This prevents unexpected dispatch if somehow
  // the registry is bypassed.
  if (typeof PipeClass !== 'function') {
    self.postMessage({
      type: 'result',
      id,
      outputs: {},
      errors: [{ message: `Unknown pipe type: ${String(pipeType).slice(0, 64)}`, selections: [] }],
    });
    return;
  }

  const pipe = new PipeClass();

  // Restore configs
  for (const [name, value] of Object.entries(configs ?? {})) {
    pipe.setConfig(name, value);
  }

  // Restore inputs (plain arrays → Uint8Array)
  const inputMap = new Map();
  for (const [portName, arr] of Object.entries(inputs ?? {})) {
    inputMap.set(portName, arr === null ? null : new Uint8Array(arr));
  }

  pipe._inputData = inputMap;
  await pipe.run();

  // Serialize outputs (Uint8Array → plain array for structured clone)
  const outputs = {};
  for (const [portName, data] of pipe._outputData) {
    outputs[portName] = data ? [...data] : null;
  }

  const errors = pipe.errors.map(e => ({
    message: e.message,
    selections: e.selections ?? [],
  }));

  // Return dynamic output port definitions so main thread can sync them
  const dynamicOutputPorts = pipe._dynamicOutputs
    ? pipe._dynamicOutputs.map(p => ({ name: p.name, description: p.description }))
    : null;

  self.postMessage({ type: 'result', id, outputs, errors, dynamicOutputPorts });
};

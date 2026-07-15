export const encode = (value) => new TextEncoder().encode(value);
export const decode = (value) => new TextDecoder().decode(value);

export async function processText(pipe, value, port = pipe.defaultOutputName) {
  const outputs = await pipe.process(new Map([[pipe.defaultInputName, encode(value)]]));
  return decode(outputs.get(port));
}

export async function processBytes(pipe, bytes, port = pipe.defaultOutputName) {
  const outputs = await pipe.process(
    new Map([[pipe.defaultInputName, Uint8Array.from(bytes)]])
  );
  return outputs.get(port);
}

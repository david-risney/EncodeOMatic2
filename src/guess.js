/**
 * Find the best sequence of pipes that repeatedly shortens the supplied data.
 * Longer sequences win; applicability scores break ties from left to right.
 *
 * @param {Uint8Array} input
 * @param {Iterable<typeof import('./pipes/pipe.js').Pipe>} pipeClasses
 * @returns {Promise<{typeName: string, score: number}[]>}
 */
export async function guessPipeChain(input, pipeClasses) {
  const candidates = [...pipeClasses].filter(PipeClass =>
    PipeClass.typeName !== 'InputPipe' &&
    PipeClass.typeName !== 'FileInputPipe'
  );
  const memo = new Map();

  const find = async data => {
    const key = Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('');
    if (memo.has(key)) return memo.get(key);

    const applicable = candidates
      .map(PipeClass => ({
        PipeClass,
        score: Number(PipeClass.getInputAppropriateness(data)),
      }))
      .filter(candidate => Number.isFinite(candidate.score) && candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    let best = [];
    for (const { PipeClass, score } of applicable) {
      const pipe = new PipeClass();
      if (pipe.defineInputs().length === 0 || pipe.defineOutputs().length === 0) continue;

      try {
        const outputs = await pipe.process(new Map([[pipe.defaultInputName, data]]));
        const output = outputs.get(pipe.defaultOutputName);
        if (!(output instanceof Uint8Array) || output.length === 0 || output.length >= data.length) {
          continue;
        }

        const path = [
          { typeName: PipeClass.typeName, score },
          ...await find(output),
        ];
        if (isBetterPath(path, best)) best = path;
      } catch {
        // Invalid candidates are expected while exploring possible decoders.
      }
    }

    memo.set(key, best);
    return best;
  };

  return find(input);
}

function isBetterPath(candidate, current) {
  if (candidate.length !== current.length) return candidate.length > current.length;
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i].score !== current[i].score) {
      return candidate[i].score > current[i].score;
    }
  }
  return false;
}

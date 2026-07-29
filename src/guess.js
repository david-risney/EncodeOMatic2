/**
 * Find the best sequence of pipes that transforms the supplied data.
 * Longer sequences win; applicability scores break ties from left to right.
 * Pipes that expand the data (e.g. decompression, archive extraction, JSON
 * parsing) are allowed as long as they produce bytes different from the input.
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
  // Sentinel used to detect cycles: if find() is called recursively with the
  // same key while it is already being computed, return an empty path instead
  // of looping forever.
  const COMPUTING = Symbol('computing');

  const find = async data => {
    const key = Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('');
    if (memo.has(key)) {
      const cached = memo.get(key);
      return cached === COMPUTING ? [] : cached;
    }
    memo.set(key, COMPUTING);

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
        if (!ArrayBuffer.isView(output) || output.length === 0) continue;
        // Allow expanding output only for high-confidence pipes (magic-byte or
        // format-confirmed, score ≥ 8).  Lower-confidence pipes must shorten data.
        if (score < 8 && output.length >= data.length) continue;
        // Skip no-op pipes whose output is byte-for-byte identical to the input.
        if (output.length === data.length && output.every((b, i) => b === data[i])) continue;

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

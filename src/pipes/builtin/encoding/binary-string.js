/**
 * Shared byte/binary-string helpers for encoding pipes.
 *
 * A "binary string" holds one byte per UTF-16 code unit (latin1), which is the
 * representation expected by `btoa`/`atob` and by the MIME parser library.
 */

const CHUNK_SIZE = 0x8000;

/**
 * @param {Uint8Array} data
 * @returns {string} latin1 string with one code unit per byte
 */
export function bytesToBinaryString(data) {
  let binary = '';
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...data.subarray(i, i + CHUNK_SIZE));
  }
  return binary;
}

/**
 * @param {string} binary latin1 string with one code unit per byte
 * @returns {Uint8Array}
 */
export function binaryStringToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Utilities for hex, bytes, CSPRNG.
 * @module
 */
/*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */
/**
 * Checks if something is Uint8Array. Be careful: nodejs Buffer will return true.
 * @param a - Value to inspect.
 * @returns `true` when the value is a Uint8Array view, including Node's `Buffer`.
 * @example
 * Guards a value before treating it as raw key material.
 *
 * ```ts
 * isBytes(new Uint8Array());
 * ```
 */
function isBytes(a) {
    // Plain `instanceof Uint8Array` is too strict for some Buffer / proxy /
    // cross-realm cases. The fallback still requires a real ArrayBuffer view
    // so plain JSON-deserialized `{ constructor: ... }`
    // spoofing is rejected, and `BYTES_PER_ELEMENT === 1` keeps the fallback on byte-oriented views.
    return (a instanceof Uint8Array ||
        (ArrayBuffer.isView(a) &&
            a.constructor.name === 'Uint8Array' &&
            'BYTES_PER_ELEMENT' in a &&
            a.BYTES_PER_ELEMENT === 1));
}
/**
 * Asserts something is boolean.
 * @param b - Value to validate.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Validates a boolean option before branching on it.
 *
 * ```ts
 * abool(true);
 * ```
 */
function abool(b) {
    if (typeof b !== 'boolean')
        throw new TypeError(`boolean expected, not ${b}`);
}
/**
 * Asserts something is a non-negative safe integer.
 * @param n - Value to validate.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validates a non-negative length or counter.
 *
 * ```ts
 * anumber(1);
 * ```
 */
function anumber(n) {
    if (typeof n !== 'number')
        throw new TypeError('number expected, got ' + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
        throw new RangeError('positive integer expected, got ' + n);
}
/**
 * Asserts something is Uint8Array.
 * @param value - Value to validate.
 * @param length - Expected byte length.
 * @param title - Optional label used in error messages.
 * @returns The validated byte array.
 * On Node, `Buffer` is accepted too because it is a Uint8Array view.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument lengths. {@link RangeError}
 * @example
 * Validates a fixed-length nonce or key buffer.
 *
 * ```ts
 * abytes(new Uint8Array([1, 2]), 2);
 * ```
 */
function abytes(value, length, title = '') {
    const bytes = isBytes(value);
    const len = value?.length;
    const needsLen = length !== undefined;
    if (!bytes || (needsLen && len !== length)) {
        const prefix = title && `"${title}" `;
        const ofLen = needsLen ? ` of length ${length}` : '';
        const got = bytes ? `length=${len}` : `type=${typeof value}`;
        const message = prefix + 'expected Uint8Array' + ofLen + ', got ' + got;
        if (!bytes)
            throw new TypeError(message);
        throw new RangeError(message);
    }
    return value;
}
/**
 * Asserts a hash- or MAC-like instance has not been destroyed or finished.
 * @param instance - Stateful instance to validate.
 * @param checkFinished - Whether to reject finished instances.
 * When `false`, only `destroyed` is checked.
 * @throws If the hash instance has already been destroyed or finalized. {@link Error}
 * @example
 * Guards against calling `update()` or `digest()` on a finished hash.
 *
 * ```ts
 * aexists({ destroyed: false, finished: false });
 * ```
 */
function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
/**
 * Asserts output is a properly-sized byte array.
 * @param out - Output buffer to validate.
 * @param instance - Hash-like instance providing `outputLen`.
 * This is the relaxed `digestInto()`-style contract: output must be at least `outputLen`,
 * unlike one-shot cipher helpers elsewhere in the repo that often require exact lengths.
 * @throws On wrong argument types. {@link TypeError}
 * @param onlyAligned - Whether `out` must be 4-byte aligned for zero-allocation word views.
 * @throws On wrong output buffer lengths. {@link RangeError}
 * @throws On wrong output buffer alignment. {@link Error}
 * @example
 * Verifies that a caller-provided output buffer is large enough.
 *
 * ```ts
 * aoutput(new Uint8Array(16), { outputLen: 16 });
 * ```
 */
function aoutput(out, instance, onlyAligned = false) {
    abytes(out, undefined, 'output');
    const min = instance.outputLen;
    if (out.length < min) {
        throw new RangeError('digestInto() expects output buffer of length at least ' + min);
    }
    if (onlyAligned && !isAligned32(out))
        throw new Error('invalid output, must be aligned');
}
/**
 * Casts a typed-array view to Uint8Array.
 * @param arr - Typed-array view to reinterpret.
 * @returns Uint8Array view over the same bytes.
 * @example
 * Views 32-bit words as raw bytes without copying.
 *
 * ```ts
 * u8(new Uint32Array([1]));
 * ```
 */
function u8(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
/**
 * Casts a typed-array view to Uint32Array.
 * @param arr - Typed-array view to reinterpret.
 * @returns Uint32Array view over the same bytes. Callers are expected to provide a
 * 4-byte-aligned offset; trailing `1..3` bytes are silently dropped.
 * @example
 * Views a byte buffer as 32-bit words for block processing.
 *
 * ```ts
 * u32(new Uint8Array(4));
 * ```
 */
function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
/**
 * Zeroizes typed arrays in place.
 * Warning: JS provides no guarantees.
 * @param arrays - Arrays to wipe.
 * @example
 * Wipes a temporary key buffer after use.
 *
 * ```ts
 * const bytes = new Uint8Array([1]);
 * clean(bytes);
 * ```
 */
function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
/**
 * Creates a DataView for byte-level manipulation.
 * @param arr - Typed-array view to wrap.
 * @returns DataView over the same bytes.
 * @example
 * Creates an endian-aware view for length encoding.
 *
 * ```ts
 * createView(new Uint8Array(4));
 * ```
 */
function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
/**
 * Whether the current platform is little-endian.
 * Most are; some IBM systems are not.
 */
const isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
/**
 * Reverses byte order of one 32-bit word.
 * @param word - Unsigned 32-bit word to swap.
 * @returns The same word with bytes reversed.
 * @example
 * Swaps a big-endian word into little-endian byte order.
 *
 * ```ts
 * byteSwap(0x11223344);
 * ```
 */
const byteSwap = (word) => ((word << 24) & 0xff000000) |
    ((word << 8) & 0xff0000) |
    ((word >>> 8) & 0xff00) |
    ((word >>> 24) & 0xff);
/**
 * Normalizes one 32-bit word to the little-endian representation expected by cipher cores.
 * @param n - Unsigned 32-bit word to normalize.
 * @returns Little-endian normalized word on big-endian hosts, else the input word unchanged.
 * @example
 * Normalizes a host-endian word before passing it into an ARX/AES core.
 *
 * ```ts
 * swap8IfBE(0x11223344);
 * ```
 */
const swap8IfBE = isLE
    ? (n) => n
    : (n) => byteSwap(n) >>> 0;
/**
 * Byte-swaps every word of a Uint32Array in place.
 * @param arr - Uint32Array whose words should be swapped.
 * @returns The same array after in-place byte swapping.
 * @example
 * Swaps every 32-bit word in a word-view buffer.
 *
 * ```ts
 * byteSwap32(new Uint32Array([0x11223344]));
 * ```
 */
const byteSwap32 = (arr) => {
    for (let i = 0; i < arr.length; i++)
        arr[i] = byteSwap(arr[i]);
    return arr;
};
/**
 * Normalizes a Uint32Array view to the little-endian representation expected by cipher cores.
 * @param u - Word view to normalize in place.
 * @returns Little-endian normalized word view.
 * @example
 * Normalizes a word-view buffer before block processing.
 *
 * ```ts
 * swap32IfBE(new Uint32Array([0x11223344]));
 * ```
 */
const swap32IfBE = isLE
    ? (u) => u
    : byteSwap32;
// Built-in hex conversion:
// {@link https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex | caniuse entry}
const hasHexBuiltin = /* @__PURE__ */ (() => 
// @ts-ignore
typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
/**
 * Convert byte array to hex string. Uses built-in function, when available.
 * @param bytes - Bytes to encode.
 * @returns Lowercase hexadecimal string.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Formats ciphertext bytes for logs or test vectors.
 *
 * ```ts
 * bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])); // 'cafe0123'
 * ```
 */
function bytesToHex(bytes) {
    abytes(bytes);
    // @ts-ignore
    if (hasHexBuiltin)
        return bytes.toHex();
    // pre-caching improves the speed 6x
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
    }
    return hex;
}
// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
        return ch - asciis._0; // '2' => 50-48
    if (ch >= asciis.A && ch <= asciis.F)
        return ch - (asciis.A - 10); // 'B' => 66-(65-10)
    if (ch >= asciis.a && ch <= asciis.f)
        return ch - (asciis.a - 10); // 'b' => 98-(97-10)
    return;
}
/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @param hex - Hexadecimal string to decode.
 * @returns Decoded bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On malformed hexadecimal input. {@link RangeError}
 * @example
 * Parses a hex test vector into bytes.
 *
 * ```ts
 * hexToBytes('cafe0123'); // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 * ```
 */
function hexToBytes(hex) {
    if (typeof hex !== 'string')
        throw new TypeError('hex string expected, got ' + typeof hex);
    if (hasHexBuiltin) {
        try {
            return Uint8Array.fromHex(hex);
        }
        catch (error) {
            if (error instanceof SyntaxError)
                throw new RangeError(error.message);
            throw error;
        }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
        throw new RangeError('hex string expected, got unpadded hex of length ' + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === undefined || n2 === undefined) {
            const char = hex[hi] + hex[hi + 1];
            throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
    }
    return array;
}
// Used in micro
/**
 * Converts a big-endian hex string into bigint.
 * @param hex - Hexadecimal string without `0x`.
 * @returns Parsed bigint value. The empty string is treated as `0n`.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Parses a big-endian field element or counter from hex.
 *
 * ```ts
 * hexToNumber('ff');
 * ```
 */
function hexToNumber(hex) {
    if (typeof hex !== 'string')
        throw new TypeError('hex string expected, got ' + typeof hex);
    return BigInt(hex === '' ? '0' : '0x' + hex); // Big Endian
}
// Used in ff1
// BE: Big Endian, LE: Little Endian
/**
 * Converts big-endian bytes into bigint.
 * @param bytes - Big-endian bytes.
 * @returns Parsed bigint value. Empty input is treated as `0n`.
 * @throws On invalid byte input passed to the internal hex conversion. {@link TypeError}
 * @example
 * Reads a big-endian integer from serialized bytes.
 *
 * ```ts
 * bytesToNumberBE(new Uint8Array([1, 0]));
 * ```
 */
function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex(bytes));
}
// Used in micro, ff1
/**
 * Converts a number into big-endian bytes of fixed length.
 * @param n - Number to encode.
 * @param len - Output length in bytes.
 * @returns Big-endian bytes padded to `len`.
 * Validation is indirect through `hexToBytes(...)`, so negative values, `len = 0`,
 * and values that do not fit surface through the downstream hex parser instead of a
 * dedicated range guard here.
 * @throws On wrong argument types. {@link TypeError}
 * @throws If the requested output length cannot represent the encoded value. {@link RangeError}
 * @example
 * Encodes a counter as fixed-width big-endian bytes.
 *
 * ```ts
 * numberToBytesBE(1, 2);
 * ```
 */
function numberToBytesBE(n, len) {
    // Reject coercible non-numeric inputs before string/hex conversion changes behavior.
    if (typeof n === 'number')
        anumber(n);
    else if (typeof n !== 'bigint')
        throw new TypeError(`number or bigint expected, got ${typeof n}`);
    anumber(len);
    return hexToBytes(n.toString(16).padStart(len * 2, '0'));
}
/**
 * Checks if two U8A use same underlying buffer and overlaps.
 * This is invalid and can corrupt data.
 * @param a - First byte view.
 * @param b - Second byte view.
 * @returns `true` when the views overlap in memory.
 * @example
 * Detects whether two slices alias the same backing buffer.
 *
 * ```ts
 * overlapBytes(new Uint8Array(4), new Uint8Array(4));
 * ```
 */
function overlapBytes(a, b) {
    // Zero-length views cannot overwrite anything, even if their offset sits inside another range.
    if (!a.byteLength || !b.byteLength)
        return false;
    return (a.buffer === b.buffer && // best we can do, may fail with an obscure Proxy
        a.byteOffset < b.byteOffset + b.byteLength && // a starts before b end
        b.byteOffset < a.byteOffset + a.byteLength // b starts before a end
    );
}
/**
 * If input and output overlap and input starts before output, we will overwrite end of input before
 * we start processing it, so this is not supported for most ciphers
 * (except chacha/salsa, which were designed for this)
 * @param input - Input bytes.
 * @param output - Output bytes.
 * @throws If the output view would overwrite unread input bytes. {@link Error}
 * @example
 * Rejects an in-place layout that would overwrite unread input bytes.
 *
 * ```ts
 * complexOverlapBytes(new Uint8Array(4), new Uint8Array(4));
 * ```
 */
function complexOverlapBytes(input, output) {
    // This is very cursed. It works somehow, but I'm completely unsure,
    // reasoning about overlapping aligned windows is very hard.
    if (overlapBytes(input, output) && input.byteOffset < output.byteOffset)
        throw new Error('complex overlap of input and output is not supported');
}
/**
 * Copies several Uint8Arrays into one.
 * @param arrays - Byte arrays to concatenate.
 * @returns Combined byte array.
 * @throws On wrong argument types inside the byte-array list. {@link TypeError}
 * @example
 * Builds a `nonce || ciphertext` style buffer.
 *
 * ```ts
 * concatBytes(new Uint8Array([1]), new Uint8Array([2]));
 * ```
 */
function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        abytes(a);
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}
/**
 * Merges user options into defaults.
 * @param defaults - Default option values.
 * @param opts - User-provided overrides.
 * @returns Combined options object.
 * The merge mutates `defaults` in place and returns the same object.
 * @throws If options are missing or not an object. {@link Error}
 * @example
 * Applies user overrides to the default cipher options.
 *
 * ```ts
 * checkOpts({ rounds: 20 }, { rounds: 8 });
 * ```
 */
function checkOpts(defaults, opts) {
    if (opts == null || typeof opts !== 'object')
        throw new Error('options must be defined');
    const merged = Object.assign(defaults, opts);
    return merged;
}
/**
 * Compares two byte arrays in kinda constant time once lengths already match.
 * @param a - First byte array.
 * @param b - Second byte array.
 * @returns `true` when the arrays contain the same bytes. Different lengths still return early.
 * @example
 * Compares an expected authentication tag with the received one.
 *
 * ```ts
 * equalBytes(new Uint8Array([1]), new Uint8Array([1]));
 * ```
 */
function equalBytes(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a[i] ^ b[i];
    return diff === 0;
}
/**
 * Wraps a keyed MAC constructor into a one-shot helper with `.create()`.
 * @param keyLen - Valid probe-key length used to read static metadata once.
 * The probe key is only used for `outputLen` / `blockLen`, so callers with several valid key sizes
 * can pass any representative size as long as those values stay fixed.
 * @param macCons - Keyed MAC constructor or factory.
 * @param fromMsg - Optional adapter that derives extra constructor args from the one-shot message.
 * @returns Callable MAC helper with `.create()`.
 */
function wrapMacConstructor(keyLen, macCons, fromMsg) {
    const mac = macCons;
    const getArgs = (fromMsg || (() => []));
    const macC = (msg, key) => mac(key, ...getArgs(msg))
        .update(msg)
        .digest();
    const tmp = mac(new Uint8Array(keyLen), ...getArgs(new Uint8Array(0)));
    macC.outputLen = tmp.outputLen;
    macC.blockLen = tmp.blockLen;
    macC.create = (key, ...args) => mac(key, ...args);
    return macC;
}
/**
 * Wraps a cipher: validates args, ensures encrypt() can only be called once.
 * Used internally by the exported cipher constructors.
 * Output-buffer support is inferred from the wrapped `encrypt` / `decrypt`
 * arity (`fn.length === 2`), and tag-bearing constructors are expected to use
 * `args[1]` for optional AAD.
 * @__NO_SIDE_EFFECTS__
 * @param params - Static cipher metadata. See {@link CipherParams}.
 * @param constructor - Cipher constructor.
 * @returns Wrapped constructor with validation.
 */
const wrapCipher = (params, constructor) => {
    function wrappedCipher(key, ...args) {
        // Validate key
        abytes(key, undefined, 'key');
        // Validate nonce if nonceLength is present
        if (params.nonceLength !== undefined) {
            const nonce = args[0];
            abytes(nonce, params.varSizeNonce ? undefined : params.nonceLength, 'nonce');
        }
        // Validate AAD if tagLength present
        const tagl = params.tagLength;
        if (tagl && args[1] !== undefined)
            abytes(args[1], undefined, 'AAD');
        const cipher = constructor(key, ...args);
        const checkOutput = (fnLength, output) => {
            if (output !== undefined) {
                if (fnLength !== 2)
                    throw new Error('cipher output not supported');
                abytes(output, undefined, 'output');
            }
        };
        // Create wrapped cipher with validation and single-use encryption
        let called = false;
        const wrCipher = {
            encrypt(data, output) {
                if (called)
                    throw new Error('cannot encrypt() twice with same key + nonce');
                called = true;
                abytes(data);
                checkOutput(cipher.encrypt.length, output);
                return cipher.encrypt(data, output);
            },
            decrypt(data, output) {
                abytes(data);
                if (tagl && data.length < tagl)
                    throw new Error('"ciphertext" expected length bigger than tagLength=' + tagl);
                checkOutput(cipher.decrypt.length, output);
                return cipher.decrypt(data, output);
            },
        };
        return wrCipher;
    }
    Object.assign(wrappedCipher, params);
    return wrappedCipher;
};
/**
 * By default, returns u8a of length.
 * When out is available, it checks it for validity and uses it.
 * @param expectedLength - Required output length.
 * @param out - Optional destination buffer.
 * @param onlyAligned - Whether `out` must be 4-byte aligned.
 * @returns Output buffer ready for writing.
 * @throws On wrong argument types. {@link TypeError}
 * @throws If the provided output buffer has the wrong size or alignment. {@link Error}
 * @example
 * Reuses a caller-provided output buffer when lengths match.
 *
 * ```ts
 * getOutput(16, new Uint8Array(16));
 * ```
 */
function getOutput(expectedLength, out, onlyAligned = true) {
    if (out === undefined)
        return new Uint8Array(expectedLength);
    // Keep Buffer/cross-realm Uint8Array support here instead of trusting a shape-compatible object.
    abytes(out, undefined, 'output');
    if (out.length !== expectedLength)
        throw new Error('"output" expected Uint8Array of length ' + expectedLength + ', got: ' + out.length);
    if (onlyAligned && !isAligned32(out))
        throw new Error('invalid output, must be aligned');
    return out;
}
/**
 * Encodes data and AAD bit lengths into a 16-byte buffer.
 * @param dataLength - Data length in bits.
 * @param aadLength - AAD length in bits.
 * The serialized block is still `aadLength || dataLength`, matching GCM/Poly1305
 * conventions even though the helper parameter order is `(dataLength, aadLength)`.
 * @param isLE - Whether to encode lengths as little-endian.
 * @returns 16-byte length block.
 * @throws On wrong argument types passed to the endian validator. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Builds the length block appended by GCM and Poly1305.
 *
 * ```ts
 * u64Lengths(16, 8, true);
 * ```
 */
function u64Lengths(dataLength, aadLength, isLE) {
    // Reject coercible non-number lengths like '10' and true before BigInt(...) accepts them.
    anumber(dataLength);
    anumber(aadLength);
    abool(isLE);
    const num = new Uint8Array(16);
    const view = createView(num);
    view.setBigUint64(0, BigInt(aadLength), isLE);
    view.setBigUint64(8, BigInt(dataLength), isLE);
    return num;
}
/**
 * Checks whether a byte array is aligned to a 4-byte offset.
 * @param bytes - Byte array to inspect.
 * @returns `true` when the view is 4-byte aligned.
 * @example
 * Checks whether a buffer can be safely viewed as Uint32Array.
 *
 * ```ts
 * isAligned32(new Uint8Array(4));
 * ```
 */
function isAligned32(bytes) {
    return bytes.byteOffset % 4 === 0;
}
/**
 * Copies bytes into a new Uint8Array.
 * @param bytes - Bytes to copy.
 * @returns Copied byte array.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Copies input into an aligned Uint8Array before block processing.
 *
 * ```ts
 * copyBytes(new Uint8Array([1, 2]));
 * ```
 */
function copyBytes(bytes) {
    // `Uint8Array.from(...)` would also accept arrays / other typed arrays. Keep this helper strict
    // because callers use it at byte-validation boundaries before mutating the detached copy.
    return Uint8Array.from(abytes(bytes));
}

/**
 * GHash from AES-GCM and its little-endian "mirror image" Polyval from AES-SIV.
 *
 * Implemented in terms of GHash with conversion function for keys
 * GCM GHASH from
 * {@link https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf | NIST SP800-38d},
 * SIV from
 * {@link https://www.rfc-editor.org/rfc/rfc8452 | RFC 8452}.
 *
 * GHASH   modulo: x^128 + x^7   + x^2   + x     + 1
 * POLYVAL modulo: x^128 + x^127 + x^126 + x^121 + 1
 *
 * @module
 */
const BLOCK_SIZE$1 = 16;
// TODO: rewrite
// temporary padding buffer
// ZEROS32 aliases these bytes, so clean(ZEROS32) also resets this shared tail-padding scratch.
const ZEROS16$1 = /* @__PURE__ */ new Uint8Array(16);
const ZEROS32$1 = /* @__PURE__ */ u32(ZEROS16$1);
// GHASH reduces modulo x^128 + x^7 + x^2 + x + 1, so the low-degree terms
// x^7 + x^2 + x + 1 become bits `11100001` = 0xe1 in R = 0xe1 || 0^120.
const POLY$1 = 0xe1;
// v = 2*v % POLY
// NOTE: because x + x = 0 (add/sub is same), mul2(x) != x+x
// Montgomery ladder can multiply any field element with this doubling step;
// addition stays simple xor.
const mul2$1 = (s0, s1, s2, s3) => {
    const hiBit = s3 & 1;
    return {
        s3: (s2 << 31) | (s3 >>> 1),
        s2: (s1 << 31) | (s2 >>> 1),
        s1: (s0 << 31) | (s1 >>> 1),
        // NIST SP 800-38D §6.3 applies `V >> 1` and XORs R on carry. In this
        // 4x32-bit split, R = 0xe1 || 0^120 lives in the top byte of s0.
        s0: (s0 >>> 1) ^ ((POLY$1 << 24) & -(hiBit & 1)), // reduce % poly
    };
};
// Per-word part of RFC 8452 `ByteReverse`; callers also reverse the 32-bit word order.
const swapLE = (n) => (((n >>> 0) & 0xff) << 24) |
    (((n >>> 8) & 0xff) << 16) |
    (((n >>> 16) & 0xff) << 8) |
    ((n >>> 24) & 0xff) |
    0;
// POLYVAL first applies RFC 8452's per-word byte reversal, then re-normalizes
// host-endian u32 loads to the little-endian word value `_updateBlock()` expects.
const swap8IfLE = (n) => swap8IfBE(swapLE(n));
/**
 * `mulX_GHASH(ByteReverse(H))` from RFC 8452 Appendix A.
 * @param k mutated in place
 */
function _toGHASHKey(k) {
    // The input is the original POLYVAL key H; reverse() materializes
    // RFC 8452's `ByteReverse(H)` before the GHASH mulX step.
    k.reverse();
    const hiBit = k[15] & 1;
    // k >>= 1
    let carry = 0;
    for (let i = 0; i < k.length; i++) {
        const t = k[i];
        k[i] = (t >>> 1) | carry;
        carry = (t & 1) << 7;
    }
    k[0] ^= -hiBit & 0xe1; // if (hiBit) n ^= 0xe1000000000000000000000000000000;
    return k;
}
// Precompute-window heuristic only: larger inputs trade memory for fewer table lookups.
// Any caller-provided length hint still collapses to one of the supported windows {2, 4, 8}.
const estimateWindow = (bytes) => {
    if (bytes > 64 * 1024)
        return 8;
    if (bytes > 1024)
        return 4;
    return 2;
};
/**
 * Incremental GHASH state for AES-GCM.
 * @param key - 16-byte GHASH key.
 * @param expectedLength - Expected message length for table sizing.
 * Chunking is segment-based, not hash-streaming: every `update()` call is zero-padded
 * to the next 16-byte boundary before it is absorbed. This matches the internal AES/GCM
 * use where AAD, payload, and length block are separate padded segments.
 * @example
 * Feeds one ciphertext block into an incremental GHASH state with a fresh hash key.
 *
 * ```ts
 * import { GHASH } from '@noble/ciphers/_polyval.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const mac = new GHASH(key);
 * mac.update(new Uint8Array(16));
 * mac.digest();
 * ```
 */
class GHASH {
    blockLen = BLOCK_SIZE$1;
    outputLen = BLOCK_SIZE$1;
    s0 = 0;
    s1 = 0;
    s2 = 0;
    s3 = 0;
    finished = false;
    destroyed = false;
    t;
    W;
    windowSize;
    // We select bits per window adaptively based on expectedLength
    constructor(key, expectedLength) {
        abytes(key, 16, 'key');
        key = copyBytes(key);
        const kView = createView(key);
        let k0 = kView.getUint32(0, false);
        let k1 = kView.getUint32(4, false);
        let k2 = kView.getUint32(8, false);
        let k3 = kView.getUint32(12, false);
        // generate table of doubled keys (half of montgomery ladder)
        const doubles = [];
        for (let i = 0; i < 128; i++) {
            doubles.push({ s0: swapLE(k0), s1: swapLE(k1), s2: swapLE(k2), s3: swapLE(k3) });
            ({ s0: k0, s1: k1, s2: k2, s3: k3 } = mul2$1(k0, k1, k2, k3));
        }
        const W = estimateWindow(expectedLength || 1024);
        if (![1, 2, 4, 8].includes(W))
            throw new Error('ghash: invalid window size, expected 2, 4 or 8');
        this.W = W;
        const bits = 128; // always 128 bits;
        const windows = bits / W;
        const windowSize = (this.windowSize = 2 ** W);
        const items = [];
        // Create precompute table for window of W bits
        for (let w = 0; w < windows; w++) {
            // truth table: 00, 01, 10, 11
            for (let byte = 0; byte < windowSize; byte++) {
                // prettier-ignore
                let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
                for (let j = 0; j < W; j++) {
                    const bit = (byte >>> (W - j - 1)) & 1;
                    if (!bit)
                        continue;
                    const { s0: d0, s1: d1, s2: d2, s3: d3 } = doubles[W * w + j];
                    ((s0 ^= d0), (s1 ^= d1), (s2 ^= d2), (s3 ^= d3));
                }
                items.push({ s0, s1, s2, s3 });
            }
        }
        this.t = items;
    }
    _updateBlock(s0, s1, s2, s3) {
        ((s0 ^= this.s0), (s1 ^= this.s1), (s2 ^= this.s2), (s3 ^= this.s3));
        const { W, t, windowSize } = this;
        // prettier-ignore
        let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
        const mask = (1 << W) - 1; // 2**W will kill performance.
        let w = 0;
        // NIST SP 800-38D §6.3 interprets blocks as little-endian polynomials,
        // so the lookup walk consumes each word byte-by-byte from
        // least-significant to most-significant bits.
        for (const num of [s0, s1, s2, s3]) {
            for (let bytePos = 0; bytePos < 4; bytePos++) {
                const byte = (num >>> (8 * bytePos)) & 0xff;
                for (let bitPos = 8 / W - 1; bitPos >= 0; bitPos--) {
                    const bit = (byte >>> (W * bitPos)) & mask;
                    const { s0: e0, s1: e1, s2: e2, s3: e3 } = t[w * windowSize + bit];
                    ((o0 ^= e0), (o1 ^= e1), (o2 ^= e2), (o3 ^= e3));
                    w += 1;
                }
            }
        }
        this.s0 = o0;
        this.s1 = o1;
        this.s2 = o2;
        this.s3 = o3;
    }
    update(data) {
        aexists(this);
        abytes(data);
        data = copyBytes(data);
        const b32 = u32(data);
        const blocks = Math.floor(data.length / BLOCK_SIZE$1);
        const left = data.length % BLOCK_SIZE$1;
        for (let i = 0; i < blocks; i++) {
            this._updateBlock(swap8IfBE(b32[i * 4 + 0]), swap8IfBE(b32[i * 4 + 1]), swap8IfBE(b32[i * 4 + 2]), swap8IfBE(b32[i * 4 + 3]));
        }
        if (left) {
            ZEROS16$1.set(data.subarray(blocks * BLOCK_SIZE$1));
            // Tail blocks go through the shared ZEROS32 scratch, so they need the same host-endian
            // normalization as full blocks; otherwise segmented GHASH/POLYVAL updates diverge on BE.
            this._updateBlock(swap8IfBE(ZEROS32$1[0]), swap8IfBE(ZEROS32$1[1]), swap8IfBE(ZEROS32$1[2]), swap8IfBE(ZEROS32$1[3]));
            clean(ZEROS32$1); // clean tmp buffer
        }
        return this;
    }
    destroy() {
        // `aexists(this)` guards update/digest paths, so destroy must mark the instance unusable too.
        this.destroyed = true;
        const { t } = this;
        // Wipe the key-derived precompute table; scalar accumulator words remain,
        // but the destroyed guard blocks further use.
        // clean precompute table
        for (const elm of t) {
            ((elm.s0 = 0), (elm.s1 = 0), (elm.s2 = 0), (elm.s3 = 0));
        }
    }
    digestInto(out) {
        aexists(this);
        // `digestInto(out)` is the no-allocation fast path, so callers must pass a
        // 32-bit-aligned buffer before we reinterpret it with `u32(out)`.
        aoutput(out, this, true);
        this.finished = true;
        // NIST SP 800-38D §6.4 returns the final 128-bit block Y_m.
        // `digestInto()` follows the relaxed `aoutput()` contract, so only
        // out[0..15] may be touched.
        const { s0, s1, s2, s3 } = this;
        const o32 = u32(out);
        o32[0] = s0;
        o32[1] = s1;
        o32[2] = s2;
        o32[3] = s3;
        swap32IfBE(o32);
    }
    digest() {
        const res = new Uint8Array(BLOCK_SIZE$1);
        this.digestInto(res);
        // `res` is independent of internal state, so it stays valid after destroy() wipes the table.
        this.destroy();
        return res;
    }
}
/**
 * Incremental POLYVAL state for AES-SIV.
 * @param key - 16-byte POLYVAL key.
 * @param expectedLength - Expected message length for table sizing.
 * Inherits GHASH's segment-padded `update()` behavior: each call is padded
 * independently to a 16-byte boundary before absorption.
 * @example
 * Feeds one block into an incremental POLYVAL state with a fresh hash key.
 *
 * ```ts
 * import { Polyval } from '@noble/ciphers/_polyval.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const mac = new Polyval(key);
 * mac.update(new Uint8Array(16));
 * mac.digest();
 * ```
 */
class Polyval extends GHASH {
    constructor(key, expectedLength) {
        abytes(key);
        // RFC 8452 Appendix A converts the POLYVAL key with
        // `mulX_GHASH(ByteReverse(H))`; copy first because `_toGHASHKey(...)`
        // mutates in place.
        const ghKey = _toGHASHKey(copyBytes(key));
        super(ghKey, expectedLength);
        clean(ghKey);
    }
    update(data) {
        aexists(this);
        abytes(data);
        data = copyBytes(data);
        const b32 = u32(data);
        const left = data.length % BLOCK_SIZE$1;
        const blocks = Math.floor(data.length / BLOCK_SIZE$1);
        for (let i = 0; i < blocks; i++) {
            // RFC 8452 Appendix A feeds `ByteReverse(X_i)` into GHASH, so POLYVAL
            // reverses the 32-bit word order in addition to the per-word byte swap.
            this._updateBlock(swap8IfLE(b32[i * 4 + 3]), swap8IfLE(b32[i * 4 + 2]), swap8IfLE(b32[i * 4 + 1]), swap8IfLE(b32[i * 4 + 0]));
        }
        if (left) {
            ZEROS16$1.set(data.subarray(blocks * BLOCK_SIZE$1));
            this._updateBlock(swap8IfLE(ZEROS32$1[3]), swap8IfLE(ZEROS32$1[2]), swap8IfLE(ZEROS32$1[1]), swap8IfLE(ZEROS32$1[0]));
            clean(ZEROS32$1);
        }
        return this;
    }
    digestInto(out) {
        aexists(this);
        // `digestInto(out)` is the no-allocation fast path, so callers must pass a
        // 32-bit-aligned buffer before we reinterpret the output prefix with `u32(view)`.
        aoutput(out, this, true);
        this.finished = true;
        // RFC 8452 Appendix A maps POLYVAL output back through `ByteReverse(...)`.
        // `digestInto()` follows the relaxed `aoutput()` contract, so only out[0..15] may be touched.
        const view = out.subarray(0, this.outputLen);
        const { s0, s1, s2, s3 } = this;
        const o32 = u32(view);
        o32[0] = s0;
        o32[1] = s1;
        o32[2] = s2;
        o32[3] = s3;
        swap32IfBE(o32);
        view.reverse();
    }
}
/**
 * GHash MAC for AES-GCM.
 * @param msg - Message bytes to authenticate.
 * @param key - 16-byte GHASH key.
 * @returns 16-byte authentication tag.
 * @example
 * Authenticates a short message with GHASH and a fresh hash key.
 *
 * ```ts
 * import { ghash } from '@noble/ciphers/_polyval.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * ghash(new Uint8Array(), key);
 * ```
 */
const ghash = 
/* @__PURE__ */ wrapMacConstructor(16, (key, expectedLength) => new GHASH(key, expectedLength), (msg) => [msg.length]);
/**
 * POLYVAL MAC for AES-SIV.
 * @param msg - Message bytes to authenticate.
 * @param key - 16-byte POLYVAL key.
 * @returns 16-byte authentication tag.
 * @example
 * Authenticates a short message with POLYVAL and a fresh hash key.
 *
 * ```ts
 * import { polyval } from '@noble/ciphers/_polyval.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * polyval(new Uint8Array(), key);
 * ```
 */
const polyval = 
/* @__PURE__ */ wrapMacConstructor(16, (key, expectedLength) => new Polyval(key, expectedLength), (msg) => [msg.length]);

/**
 * {@link https://en.wikipedia.org/wiki/Advanced_Encryption_Standard | AES}
 * a.k.a. Advanced Encryption Standard
 * is a variant of Rijndael block cipher, standardized by NIST in 2001.
 * We provide the fastest available pure JS implementation.
 *
 * `cipher = encrypt(block, key)`
 *
 * Data is split into 128-bit blocks.
 * Encrypted in 10/12/14 rounds (128/192/256 bits). In every round:
 * 1. **S-box**, table substitution
 * 2. **Shift rows**, cyclic shift left of all rows of data array
 * 3. **Mix columns**, multiplying every column by fixed polynomial
 * 4. **Add round key**, round_key xor i-th column of array
 *
 * Check out
 * {@link https://csrc.nist.gov/files/pubs/fips/197/final/docs/fips-197.pdf | FIPS-197},
 * {@link https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf | NIST 800-38G},
 * and {@link https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/aes-development/rijndael-ammended.pdf | original proposal}.
 * @module
 */
const BLOCK_SIZE = 16;
// AES operates on 16-byte blocks, i.e. 4 32-bit words.
const BLOCK_SIZE32 = 4;
// Shared zero block (`0^128`) used by GCM's `H = CIPH_K(0^128)` / J0 scratch
// and by CMAC / SIV helpers; callers take `.slice()` before mutating it.
const EMPTY_BLOCK = /* @__PURE__ */ new Uint8Array(BLOCK_SIZE);
// RFC 5297 §2.1 / §2.4: S2V uses `<one> = 0^127 || 1` for the `n = 0` special case.
const ONE_BLOCK = /* @__PURE__ */ Uint8Array.from([
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
]);
const POLY = 0x11b; // 1 + x + x**3 + x**4 + x**8
// Validates plain AES key sizes only; AES-SIV's doubled-key contract is checked elsewhere.
function validateKeyLength(key) {
    if (![16, 24, 32].includes(key.length))
        throw new Error('"aes key" expected Uint8Array of length 16/24/32, got length=' + key.length);
}
// TODO: remove multiplication, binary ops only
// Doubles one GF(2^8) field element; callers are expected to stay in byte range.
// FIPS 197 upd1 §4.3 equation (4.5): XTIMES(b) left-shifts by one and, when
// b7=1, reduces by m(x); using POLY=0x11b here yields the same byte result
// as XORing with {1b} after the shift.
function mul2(n) {
    return (n << 1) ^ (POLY & -(n >> 7));
}
// Shift-and-add multiplication in GF(2^8); callers are expected to pass byte values.
// FIPS 197 upd1 §4.3 equation (4.7): general products are XORs of repeated
// XTIMES() multiples, e.g. {57}•{13} = {57}⊕{ae}⊕{07}.
function mul(a, b) {
    let res = 0;
    for (; b > 0; b >>= 1) {
        // Usual shift-and-add step in GF(2^8), not a scalar-multiplication ladder.
        res ^= a & -(b & 1); // if (b&1) res ^=a (but const-time).
        a = mul2(a); // a = 2*a
    }
    return res;
}
/**
 * Increments a counter block with wrap around.
 * AES call sites here currently use the big-endian branch, but the helper supports both layouts.
 * NIST SP 800-38A Appendix B.1 and SP 800-38D §6.2 increment the
 * least-significant/rightmost bits.
 * `isLE=false` matches that standard counter-block layout, while `isLE=true`
 * is a generic extension for non-AES callers.
 * The implementation keeps a 32-bit bitwise carry path, so `carry` is capped at `0xffffff00`;
 * larger values throw instead of silently overflowing before the next-byte propagation step.
 */
// Keep the helper explicitly typed so `--isolatedDeclarations` can expose it
// through the test-only `__TESTS` export without inference errors.
const incBytes = (data, isLE, carry = 1) => {
    // Keep `carry + byte <= 0xffffffff` so the `| 0` / `>>> 8` path below
    // never truncates a real carry bit.
    if (!Number.isSafeInteger(carry) || carry > 0xffffff00)
        throw new Error('incBytes: wrong carry ' + carry);
    abytes(data);
    for (let i = 0; i < data.length; i++) {
        const pos = !isLE ? data.length - 1 - i : i;
        carry = (carry + (data[pos] & 0xff)) | 0;
        data[pos] = carry & 0xff;
        carry >>>= 8;
    }
};
// AES S-box is generated using finite field inversion,
// an affine transform, and xor of a constant 0x63.
const sbox = /* @__PURE__ */ (() => {
    const t = new Uint8Array(256);
    // Repeated multiplication by {03} walks all 255 nonzero field elements
    // once, so t[255 - i] is the multiplicative inverse of t[i] for the
    // affine step.
    for (let i = 0, x = 1; i < 256; i++, x ^= mul2(x))
        t[i] = x;
    const box = new Uint8Array(256);
    // FIPS 197 upd1 §5.1.1: SBOX({00}) = {63} because the inverse step leaves
    // {00} at {00}, then the affine transform xors in c = {63}.
    box[0] = 0x63;
    for (let i = 0; i < 255; i++) {
        let x = t[255 - i];
        x |= x << 8;
        box[t[i]] = (x ^ (x >> 4) ^ (x >> 5) ^ (x >> 6) ^ (x >> 7) ^ 0x63) & 0xff;
    }
    clean(t);
    return box;
})();
// FIPS 197 upd1 §5.3.2: INVSBOX() is derived from SBOX() by swapping input
// and output roles (Table 6).
// `indexOf` is only used once at module init, so the quadratic setup cost stays off hot paths.
const invSbox = /* @__PURE__ */ sbox.map((_, j) => sbox.indexOf(j));
// FIPS 197 upd1 §5.2: ROTWORD([a0,a1,a2,a3]) = [a1,a2,a3,a0]; with this LE
// word packing that is a right rotate by 8 bits.
const rotr32_8 = (n) => (n << 24) | (n >>> 8);
// LE T-table helper: rotates one precomputed word by one byte so T1/T2/T3
// reuse T0's substitution/mix result in the other byte lanes.
const rotl32_8 = (n) => (n << 8) | (n >>> 24);
// T-table is optimization suggested in 5.2 of original proposal (missed from FIPS-197). Changes:
// - LE instead of BE
// - bigger tables: T0 and T1 are merged into T01 table and T2 & T3 into T23;
//   so index is u16, instead of u8. This speeds up things, unexpectedly
function genTtable(sbox, fn) {
    if (sbox.length !== 256)
        throw new Error('Wrong sbox length');
    const T0 = new Uint32Array(256).map((_, j) => fn(sbox[j]));
    const T1 = T0.map(rotl32_8);
    const T2 = T1.map(rotl32_8);
    const T3 = T2.map(rotl32_8);
    // Pre-xor adjacent lanes so apply0123/applySbox can fetch two substituted
    // byte lanes per lookup in the LE round layout.
    const T01 = new Uint32Array(256 * 256);
    const T23 = new Uint32Array(256 * 256);
    const sbox2 = new Uint16Array(256 * 256);
    for (let i = 0; i < 256; i++) {
        for (let j = 0; j < 256; j++) {
            const idx = i * 256 + j;
            T01[idx] = T0[i] ^ T1[j];
            T23[idx] = T2[i] ^ T3[j];
            sbox2[idx] = (sbox[i] << 8) | sbox[j];
        }
    }
    return { sbox, sbox2, T0, T1, T2, T3, T01, T23 };
}
// Forward round precompute: the packed word stores the MIXCOLUMNS row
// [{02},{01},{01},{03}] in LE byte-lane order, and the returned `sbox2`
// is also reused by key expansion and the final round.
const tableEncoding = /* @__PURE__ */ genTtable(sbox, (s) => (mul(s, 3) << 24) | (s << 16) | (s << 8) | mul(s, 2));
// Inverse round precompute: the packed word stores the INVMIXCOLUMNS row
// [{0e},{09},{0d},{0b}] in LE byte-lane order, and the tables are reused
// by decrypt() and expandKeyDecLE().
const tableDecoding = /* @__PURE__ */ genTtable(invSbox, (s) => (mul(s, 11) << 24) | (mul(s, 13) << 16) | (mul(s, 9) << 8) | mul(s, 14));
// FIPS 197 upd1 §5.2 Table 5: left-most bytes of Rcon[j] = x^(j-1), generated by repeated XTIMES().
const xPowers = /* @__PURE__ */ (() => {
    const p = new Uint8Array(16);
    for (let i = 0, x = 1; i < 16; i++, x = mul2(x))
        p[i] = x;
    return p;
})();
/** Forward AES key expansion used across ECB/CBC/CTR/GCM/CMAC/KW-style paths. */
function expandKeyLE$1(key) {
    abytes(key);
    const len = key.length;
    validateKeyLength(key);
    const { sbox2 } = tableEncoding;
    const toClean = [];
    // Copy on BE or misaligned inputs so the LE word normalization below never
    // mutates caller key bytes in place.
    if (!isLE || !isAligned32(key))
        toClean.push((key = copyBytes(key)));
    const k32 = swap32IfBE(u32(key));
    const Nk = k32.length;
    // `applySbox` normally reads one byte lane from each argument; repeating
    // `n` across all four lanes turns it into SUBWORD(n).
    const subByte = (n) => applySbox(sbox2, n, n, n, n);
    // AES key sizes are 16/24/32 bytes, so len + 28 yields the 44/52/60
    // schedule words from FIPS 197 §5.2 / Table 3.
    const xk = new Uint32Array(len + 28); // expanded key
    xk.set(k32);
    // 4.3.1 Key expansion
    for (let i = Nk; i < xk.length; i++) {
        let t = xk[i - 1];
        if (i % Nk === 0)
            t = subByte(rotr32_8(t)) ^ xPowers[i / Nk - 1];
        else if (Nk > 6 && i % Nk === 4)
            t = subByte(t);
        xk[i] = xk[i - Nk] ^ t;
    }
    clean(...toClean);
    return xk;
}
function expandKeyDecLE(key) {
    const encKey = expandKeyLE$1(key);
    const xk = encKey.slice();
    const Nk = encKey.length;
    const { sbox2 } = tableEncoding;
    const { T0, T1, T2, T3 } = tableDecoding;
    // Local decrypt() walks round keys forward from xk[0], so reverse the
    // encryption round-key blocks first before applying the equivalent-inverse
    // middle-round transform.
    for (let i = 0; i < Nk; i += 4) {
        for (let j = 0; j < 4; j++)
            xk[i + j] = encKey[Nk - i - 4 + j];
    }
    clean(encKey);
    // Apply InvMixColumn to the reversed round keys using the same LE sbox2
    // packing as the forward path.
    // apply InvMixColumn except first & last round
    for (let i = 4; i < Nk - 4; i++) {
        const x = xk[i];
        const w = applySbox(sbox2, x, x, x, x);
        xk[i] = T0[w & 0xff] ^ T1[(w >>> 8) & 0xff] ^ T2[(w >>> 16) & 0xff] ^ T3[w >>> 24];
    }
    return xk;
}
// Apply tables
function apply0123(T01, T23, s0, s1, s2, s3) {
    // `T01` takes the low byte lane from `s0` plus the next lane from `s1`;
    // `T23` does the same for `s2`/`s3`.
    // Equivalent to `T0[s0&0xff] ^ T1[(s1>>>8)&0xff] ^ T2[(s2>>>16)&0xff] ^
    // T3[s3>>>24]`, but with two merged-table fetches.
    return (T01[((s0 << 8) & 0xff00) | ((s1 >>> 8) & 0xff)] ^
        T23[((s2 >>> 8) & 0xff00) | ((s3 >>> 24) & 0xff)]);
}
function applySbox(sbox2, s0, s1, s2, s3) {
    // `sbox2` packs two substituted byte lanes at a time in the same LE
    // layout used by the round code.
    // Equivalent to `SBOX(byte0(s0)) | SBOX(byte1(s1))<<8 |
    // SBOX(byte2(s2))<<16 | SBOX(byte3(s3))<<24`.
    return (sbox2[(s0 & 0xff) | (s1 & 0xff00)] |
        (sbox2[((s2 >>> 16) & 0xff) | ((s3 >>> 16) & 0xff00)] << 16));
}
function encrypt(xk, s0, s1, s2, s3) {
    const { sbox2, T01, T23 } = tableEncoding;
    let k = 0;
    ((s0 ^= xk[k++]), (s1 ^= xk[k++]), (s2 ^= xk[k++]), (s3 ^= xk[k++]));
    // `xk` has Nr+1 round-key blocks, so after the initial AddRoundKey and the
    // final S-box-only round there are Nr-1 full table/MixColumns rounds left.
    const rounds = xk.length / 4 - 2;
    for (let i = 0; i < rounds; i++) {
        const t0 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
        const t1 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
        const t2 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
        const t3 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
        ((s0 = t0), (s1 = t1), (s2 = t2), (s3 = t3));
    }
    // last round (without mixcolumns, so using SBOX2 table)
    const t0 = xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3);
    const t1 = xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0);
    const t2 = xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1);
    const t3 = xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2);
    return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
// Can't be merged with encrypt: arg positions for apply0123 / applySbox are different
function decrypt(xk, s0, s1, s2, s3) {
    const { sbox2, T01, T23 } = tableDecoding;
    let k = 0;
    ((s0 ^= xk[k++]), (s1 ^= xk[k++]), (s2 ^= xk[k++]), (s3 ^= xk[k++]));
    // With `expandKeyDecLE()` the round keys are already reversed and middle
    // rounds are InvMixColumns-adjusted, so this loop follows the equivalent
    // inverse cipher order directly.
    const rounds = xk.length / 4 - 2;
    for (let i = 0; i < rounds; i++) {
        const t0 = xk[k++] ^ apply0123(T01, T23, s0, s3, s2, s1);
        const t1 = xk[k++] ^ apply0123(T01, T23, s1, s0, s3, s2);
        const t2 = xk[k++] ^ apply0123(T01, T23, s2, s1, s0, s3);
        const t3 = xk[k++] ^ apply0123(T01, T23, s3, s2, s1, s0);
        ((s0 = t0), (s1 = t1), (s2 = t2), (s3 = t3));
    }
    // Final equivalent-inverse round omits InvMixColumns, so use inverse
    // S-box lanes in InvShiftRows order.
    const t0 = xk[k++] ^ applySbox(sbox2, s0, s3, s2, s1);
    const t1 = xk[k++] ^ applySbox(sbox2, s1, s0, s3, s2);
    const t2 = xk[k++] ^ applySbox(sbox2, s2, s1, s0, s3);
    const t3 = xk[k++] ^ applySbox(sbox2, s3, s2, s1, s0);
    return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function ctrCounter(xk, nonce, src, dst) {
    abytes(nonce, BLOCK_SIZE, 'nonce');
    abytes(src);
    const srcLen = src.length;
    dst = getOutput(srcLen, dst);
    complexOverlapBytes(src, dst);
    // Internal helper: mutate `nonce` in place as the live counter block so
    // each encrypted block uses the next CTR value.
    const ctr = nonce;
    const c32 = u32(ctr);
    const src32 = u32(src);
    const dst32 = u32(dst);
    // Fill block (empty, ctr=0)
    let { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    // process blocks
    for (let i = 0; i + 4 <= src32.length; i += 4) {
        dst32[i + 0] = src32[i + 0] ^ swap8IfBE(s0);
        dst32[i + 1] = src32[i + 1] ^ swap8IfBE(s1);
        dst32[i + 2] = src32[i + 2] ^ swap8IfBE(s2);
        dst32[i + 3] = src32[i + 3] ^ swap8IfBE(s3);
        incBytes(ctr, false, 1); // Full 128 bit counter with wrap around
        ({ s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3])));
    }
    // NIST SP 800-38A CTR mode uses the leading `u` bits of the next output
    // block for the final short block.
    // It's possible to handle > u32 fast, but is it worth it?
    const start = BLOCK_SIZE * Math.floor(src32.length / BLOCK_SIZE32);
    if (start < srcLen) {
        const b32 = new Uint32Array([s0, s1, s2, s3]);
        swap32IfBE(b32);
        const buf = u8(b32);
        for (let i = start, pos = 0; i < srcLen; i++, pos++)
            dst[i] = src[i] ^ buf[pos];
        clean(b32);
    }
    // Unsafe mutable-counter API only advances whole blocks. Callers that want to
    // resume after consuming part of this block must re-run from the same counter
    // with left-padding and strip the already-consumed prefix themselves.
    return dst;
}
// AES CTR with overflowing 32 bit counter
// It's possible to do 32le significantly simpler (and probably faster) by using u32.
// But, we need both, and perf bottleneck is in ghash anyway.
// Unsafe 32-bit CTR helper: mutates `nonce` in place, expects aligned `src`/`dst`,
// and uses `isLE` to choose which 32-bit counter word is incremented.
function ctr32(xk, isLE, nonce, src, dst) {
    abytes(nonce, BLOCK_SIZE, 'nonce');
    abytes(src);
    dst = getOutput(src.length, dst);
    const ctr = nonce; // write new value to nonce, so it can be re-used
    const c32 = u32(ctr);
    const view = createView(ctr);
    const src32 = u32(src);
    const dst32 = u32(dst);
    // NIST SP 800-38D GCTR increments the rightmost 32 bits of J0, while
    // RFC 8452 AES-GCM-SIV increments the first 32 bits as a little-endian u32.
    const ctrPos = isLE ? 0 : 12;
    const srcLen = src.length;
    // Fill block (empty, ctr=0)
    let ctrNum = view.getUint32(ctrPos, isLE); // read current counter value
    let { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    // process blocks
    for (let i = 0; i + 4 <= src32.length; i += 4) {
        dst32[i + 0] = src32[i + 0] ^ swap8IfBE(s0);
        dst32[i + 1] = src32[i + 1] ^ swap8IfBE(s1);
        dst32[i + 2] = src32[i + 2] ^ swap8IfBE(s2);
        dst32[i + 3] = src32[i + 3] ^ swap8IfBE(s3);
        ctrNum = (ctrNum + 1) >>> 0; // u32 wrap
        view.setUint32(ctrPos, ctrNum, isLE);
        ({ s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3])));
    }
    // leftovers (less than a block)
    const start = BLOCK_SIZE * Math.floor(src32.length / BLOCK_SIZE32);
    if (start < srcLen) {
        const b32 = new Uint32Array([s0, s1, s2, s3]);
        swap32IfBE(b32);
        const buf = u8(b32);
        for (let i = start, pos = 0; i < srcLen; i++, pos++)
            dst[i] = src[i] ^ buf[pos];
        clean(b32);
    }
    // Same unsafe contract as ctrCounter(): only full blocks advance the stored
    // mutable counter state; partial-block continuation is caller-managed.
    return dst;
}
/**
 * **CTR** (Counter Mode): turns a block cipher into a stream cipher using a
 * full 16-byte counter block.
 * Efficient and parallelizable. Requires a unique nonce per encryption. Unauthenticated: needs MAC.
 * @param key - AES key bytes.
 * @param nonce - 16-byte counter block, incremented as a full AES block.
 * @returns Cipher instance with `encrypt()` and `decrypt()`.
 * @example
 * Encrypts a short payload with a fresh AES key and counter block.
 *
 * ```ts
 * import { ctr } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const nonce = randomBytes(16);
 * const cipher = ctr(key, nonce);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const ctr = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 16 }, function aesctr(key, nonce) {
    function processCtr(buf, dst) {
        abytes(buf);
        if (dst !== undefined) {
            abytes(dst);
            // Optional output buffers must stay 4-byte aligned because
            // ctrCounter() reinterprets them as Uint32Array words.
            if (!isAligned32(dst))
                throw new Error('unaligned destination');
        }
        const xk = expandKeyLE$1(key);
        // Public CTR keeps caller nonce bytes immutable even though ctrCounter()
        // advances the live 16-byte counter block in place.
        const n = copyBytes(nonce); // align + avoid changing
        const toClean = [xk, n];
        if (!isAligned32(buf))
            toClean.push((buf = copyBytes(buf)));
        const out = ctrCounter(xk, n, buf, dst);
        clean(...toClean);
        return out;
    }
    return {
        encrypt: (plaintext, dst) => processCtr(plaintext, dst),
        decrypt: (ciphertext, dst) => processCtr(ciphertext, dst),
    };
});
function validateBlockDecrypt(data) {
    abytes(data);
    // ECB/CBC decryption always consumes whole ciphertext blocks; PKCS#7/CMS
    // padding, when enabled, is removed only after decrypting the final block.
    if (data.length % BLOCK_SIZE !== 0) {
        throw new Error('aes-(cbc/ecb).decrypt ciphertext should consist of blocks with size ' + BLOCK_SIZE);
    }
}
// ECB/CBC core modes operate on whole blocks; `pkcs5` enables the library's
// PKCS#7/CMS-compatible final-block padding convenience before encryption.
function validateBlockEncrypt(plaintext, pkcs5, dst) {
    abytes(plaintext);
    let outLen = plaintext.length;
    const remaining = outLen % BLOCK_SIZE;
    if (!pkcs5 && remaining !== 0)
        throw new Error('aec/(cbc-ecb): unpadded plaintext with disabled padding');
    if (pkcs5) {
        let left = BLOCK_SIZE - remaining;
        // RFC 5652 pads even already-aligned inputs, so a full extra block is
        // appended when the plaintext length is already a multiple of 16 bytes.
        if (!left)
            left = BLOCK_SIZE; // if no bytes left, create empty padding block
        outLen = outLen + left;
    }
    dst = getOutput(outLen, dst);
    complexOverlapBytes(plaintext, dst);
    // Copy on BE or misaligned inputs so u32()/swap32IfBE() normalization never
    // mutates caller plaintext bytes in place before ECB/CBC processing.
    if (!isLE || !isAligned32(plaintext))
        plaintext = copyBytes(plaintext);
    const b = u32(plaintext);
    swap32IfBE(b);
    const o = u32(dst);
    return { b, o, out: dst };
}
// `pkcs5` is the historical option name; for AES's 16-byte block this is the
// generic PKCS#7/CMS-style block-padding rule on decrypt.
function validatePKCS(data, pkcs5) {
    if (!pkcs5)
        return data;
    const len = data.length;
    // RFC 5652 pads even empty / already-aligned inputs, so a valid padded
    // ECB/CBC ciphertext is never empty when PKCS#7/CMS unpadding is enabled.
    // AES-CBC/ECB ciphertext should be full blocks before unpadding
    if (len === 0)
        throw new Error('aes/pkcs7: empty ciphertext not allowed');
    const lastByte = data[len - 1];
    let valid = 1;
    valid &= ((lastByte - 1) >>> 31) ^ 1; // pad >= 1
    valid &= ((16 - lastByte) >>> 31) ^ 1; // pad <= 16
    // Check exactly 16 tail bytes in constant-shape loop
    // For i < pad: byte must equal pad
    // For i >= pad: ignore byte
    for (let i = 0; i < 16; i++) {
        // const b = data[len - 1 - i];
        const shouldCheck = (i - lastByte) >>> 31; // 1 if i < pad else 0
        const eq = (data[len - 1 - i] ^ lastByte) === 0 ? 1 : 0; // 1 if equal
        valid &= eq | (shouldCheck ^ 1); // pass if equal OR not checked
    }
    // if (invalidLen) throw new Error('aes/pkcs7: ciphertext length must be multiple of 16');
    if (!valid)
        throw new Error('aes/pkcs7: wrong padding');
    return data.subarray(0, len - lastByte);
}
// ECB/CBC callers only pass the final short block here, so `left.length` is
// 0..15 and the helper always emits exactly one padded 16-byte block.
function padPCKS(left) {
    const tmp = new Uint8Array(16);
    const tmp32 = u32(tmp);
    tmp.set(left);
    const paddingByte = BLOCK_SIZE - left.length;
    // RFC 5652 §6.3 fills the whole suffix with the padding length byte:
    // e.g. `aa 0f..0f` for a 1-byte tail, or `10..10` for a full extra block.
    for (let i = BLOCK_SIZE - paddingByte; i < BLOCK_SIZE; i++)
        tmp[i] = paddingByte;
    return tmp32;
}
/**
 * **ECB** (Electronic Codebook): Deterministic encryption; identical plaintext blocks yield
 * identical ciphertexts. Not secure due to pattern leakage.
 * See {@link https://words.filippo.io/the-ecb-penguin/ | the AES Penguin}.
 * @param key - AES key bytes.
 * @param opts - Padding options. See {@link BlockOpts}.
 * @returns Cipher instance with `encrypt()` and `decrypt()`.
 * @example
 * Shows the basic ECB encrypt call shape with a fresh key; avoid ECB in new designs.
 *
 * ```ts
 * import { ecb } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const cipher = ecb(key);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const ecb = /* @__PURE__ */ wrapCipher({ blockSize: 16 }, function aesecb(key, opts = {}) {
    const pkcs5 = !opts.disablePadding;
    return {
        encrypt(plaintext, dst) {
            const { b, o, out: _out } = validateBlockEncrypt(plaintext, pkcs5, dst);
            const xk = expandKeyLE$1(key);
            let i = 0;
            for (; i + 4 <= b.length;) {
                const { s0, s1, s2, s3 } = encrypt(xk, b[i + 0], b[i + 1], b[i + 2], b[i + 3]);
                ((o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3));
            }
            if (pkcs5) {
                const tmp32 = padPCKS(plaintext.subarray(i * 4));
                swap32IfBE(tmp32);
                const { s0, s1, s2, s3 } = encrypt(xk, tmp32[0], tmp32[1], tmp32[2], tmp32[3]);
                ((o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3));
            }
            swap32IfBE(o);
            clean(xk);
            return _out;
        },
        decrypt(ciphertext, dst) {
            validateBlockDecrypt(ciphertext);
            const xk = expandKeyDecLE(key);
            dst = getOutput(ciphertext.length, dst);
            const toClean = [xk];
            complexOverlapBytes(ciphertext, dst);
            // Copy on BE or misaligned ciphertext so u32()/swap32IfBE()
            // normalization never mutates caller bytes in place before decrypt().
            if (!isLE || !isAligned32(ciphertext))
                toClean.push((ciphertext = copyBytes(ciphertext)));
            const b = u32(ciphertext);
            const o = u32(dst);
            swap32IfBE(b);
            for (let i = 0; i + 4 <= b.length;) {
                const { s0, s1, s2, s3 } = decrypt(xk, b[i + 0], b[i + 1], b[i + 2], b[i + 3]);
                ((o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3));
            }
            swap32IfBE(o);
            clean(...toClean);
            return validatePKCS(dst, pkcs5);
        },
    };
});
/**
 * **CBC** (Cipher Block Chaining): Each plaintext block is XORed with the
 * previous block of ciphertext before encryption.
 * Hard to use: requires proper padding and an unpredictable IV. Unauthenticated: needs MAC.
 * @param key - AES key bytes.
 * @param iv - 16-byte unpredictable initialization vector.
 * @param opts - Padding options. See {@link BlockOpts}.
 * @returns Cipher instance with `encrypt()` and `decrypt()`.
 * @example
 * Encrypts a padded message with a fresh key and 16-byte IV.
 *
 * ```ts
 * import { cbc } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const iv = randomBytes(16);
 * const cipher = cbc(key, iv);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const cbc = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 16 }, function aescbc(key, iv, opts = {}) {
    const pkcs5 = !opts.disablePadding;
    return {
        encrypt(plaintext, dst) {
            const xk = expandKeyLE$1(key);
            const { b, o, out: _out } = validateBlockEncrypt(plaintext, pkcs5, dst);
            let _iv = iv;
            const toClean = [xk];
            // Copy on BE or misaligned inputs so IV normalization and the mutable
            // local chaining state never write back into caller IV bytes.
            if (!isLE || !isAligned32(_iv))
                toClean.push((_iv = copyBytes(_iv)));
            const n32 = u32(_iv);
            swap32IfBE(n32);
            // prettier-ignore
            let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
            let i = 0;
            for (; i + 4 <= b.length;) {
                ((s0 ^= b[i + 0]), (s1 ^= b[i + 1]), (s2 ^= b[i + 2]), (s3 ^= b[i + 3]));
                ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
                ((o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3));
            }
            if (pkcs5) {
                const tmp32 = padPCKS(plaintext.subarray(i * 4));
                swap32IfBE(tmp32);
                ((s0 ^= tmp32[0]), (s1 ^= tmp32[1]), (s2 ^= tmp32[2]), (s3 ^= tmp32[3]));
                ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
                ((o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3));
            }
            swap32IfBE(o);
            clean(...toClean);
            return _out;
        },
        decrypt(ciphertext, dst) {
            validateBlockDecrypt(ciphertext);
            const xk = expandKeyDecLE(key);
            let _iv = iv;
            const toClean = [xk];
            // Copy on BE or misaligned inputs so IV normalization and the mutable
            // local chaining state never write back into caller IV bytes.
            if (!isLE || !isAligned32(_iv))
                toClean.push((_iv = copyBytes(_iv)));
            const n32 = u32(_iv);
            swap32IfBE(n32);
            dst = getOutput(ciphertext.length, dst);
            complexOverlapBytes(ciphertext, dst);
            // Copy on BE or misaligned ciphertext so u32()/swap32IfBE()
            // normalization never mutates caller bytes in place before decrypt().
            if (!isLE || !isAligned32(ciphertext))
                toClean.push((ciphertext = copyBytes(ciphertext)));
            const b = u32(ciphertext);
            const o = u32(dst);
            swap32IfBE(b);
            // prettier-ignore
            let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
            for (let i = 0; i + 4 <= b.length;) {
                // prettier-ignore
                const ps0 = s0, ps1 = s1, ps2 = s2, ps3 = s3;
                ((s0 = b[i + 0]), (s1 = b[i + 1]), (s2 = b[i + 2]), (s3 = b[i + 3]));
                const { s0: o0, s1: o1, s2: o2, s3: o3 } = decrypt(xk, s0, s1, s2, s3);
                ((o[i++] = o0 ^ ps0), (o[i++] = o1 ^ ps1), (o[i++] = o2 ^ ps2), (o[i++] = o3 ^ ps3));
            }
            swap32IfBE(o);
            clean(...toClean);
            return validatePKCS(dst, pkcs5);
        },
    };
});
/**
 * CFB (CFB-128): Cipher Feedback Mode with 128-bit segments. The input for the
 * block cipher is the previous cipher output.
 * Unauthenticated: needs MAC.
 * @param key - AES key bytes.
 * @param iv - 16-byte unpredictable initialization vector.
 * @returns Cipher instance with `encrypt()` and `decrypt()`.
 * @example
 * Encrypts a short message with feedback mode and a fresh key/IV pair.
 *
 * ```ts
 * import { cfb } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const iv = randomBytes(16);
 * const cipher = cfb(key, iv);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const cfb = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 16 }, function aescfb(key, iv) {
    function processCfb(src, isEncrypt, dst) {
        abytes(src);
        const srcLen = src.length;
        dst = getOutput(srcLen, dst);
        // CFB feeds back previous ciphertext, so overlapping src/dst could
        // overwrite bytes that are still needed as the next feedback block.
        if (overlapBytes(src, dst))
            throw new Error('overlapping src and dst not supported.');
        const xk = expandKeyLE$1(key);
        let _iv = iv;
        const toClean = [xk];
        // Copy on BE or misaligned inputs so u32()/swap32IfBE() normalization
        // never mutates caller IV/src bytes in place before CFB processing.
        if (!isLE || !isAligned32(_iv))
            toClean.push((_iv = copyBytes(_iv)));
        if (!isLE || !isAligned32(src))
            toClean.push((src = copyBytes(src)));
        const src32 = u32(src);
        const dst32 = u32(dst);
        // NIST SP 800-38A §6.3 feeds back the previous ciphertext segment in
        // both directions: encrypt reuses freshly written dst words, decrypt
        // reuses the source ciphertext words.
        const next32 = isEncrypt ? dst32 : src32;
        const n32 = u32(_iv);
        swap32IfBE(src32);
        swap32IfBE(n32);
        // prettier-ignore
        let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
        for (let i = 0; i + 4 <= src32.length;) {
            const { s0: e0, s1: e1, s2: e2, s3: e3 } = encrypt(xk, s0, s1, s2, s3);
            dst32[i + 0] = src32[i + 0] ^ e0;
            dst32[i + 1] = src32[i + 1] ^ e1;
            dst32[i + 2] = src32[i + 2] ^ e2;
            dst32[i + 3] = src32[i + 3] ^ e3;
            ((s0 = next32[i++]), (s1 = next32[i++]), (s2 = next32[i++]), (s3 = next32[i++]));
        }
        // leftovers (less than block)
        const start = BLOCK_SIZE * Math.floor(src32.length / BLOCK_SIZE32);
        if (start < srcLen) {
            // Byte-oriented API: for a final short tail, reuse the next CFB-128
            // output block and XOR only the needed prefix. RFC 3826 §3.1.3 /
            // §3.1.4 describes the same no-padding rule at bit granularity for a
            // final r<=128 segment.
            ({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
            const tmp = new Uint32Array([s0, s1, s2, s3]);
            swap32IfBE(tmp);
            const buf = u8(tmp);
            for (let i = start, pos = 0; i < srcLen; i++, pos++)
                dst[i] = src[i] ^ buf[pos];
            clean(buf);
        }
        swap32IfBE(dst32);
        clean(...toClean);
        return dst;
    }
    return {
        encrypt: (plaintext, dst) => processCfb(plaintext, true, dst),
        decrypt: (ciphertext, dst) => processCfb(ciphertext, false, dst),
    };
});
// TODO: merge with chacha, however gcm has bitLen while chacha has byteLen
// `data` is the payload covered by the polynomial MAC: ciphertext for GCM,
// plaintext for GCM-SIV. Keep AAD/data/length as separate updates because
// GHASH/POLYVAL pad each call to block boundaries, so the chunks must match the
// spec-defined segments instead of arbitrary concatenation boundaries.
function computeTag$1(fn, isLE, key, data, AAD) {
    const aadLength = AAD ? AAD.length : 0;
    const h = fn.create(key, data.length + aadLength);
    if (AAD)
        h.update(AAD);
    // u64Lengths() takes (dataBits, aadBits) but still serializes the final
    // block as len(AAD) || len(data), matching both GCM and GCM-SIV.
    const num = u64Lengths(8 * data.length, 8 * aadLength, isLE);
    h.update(data);
    h.update(num);
    const res = h.digest();
    clean(num);
    return res;
}
/**
 * **GCM** (Galois/Counter Mode): Combines CTR mode with polynomial MAC. Efficient and widely used.
 * Not perfect:
 * a) conservative key wear-out is `2**32` (4B) msgs.
 * b) key wear-out under random nonces is even smaller: `2**23` (8M) messages for `2**-50` chance.
 * c) MAC can be forged: see Poly1305 documentation.
 * @param key - AES key bytes.
 * @param nonce - Nonce bytes (12 recommended, minimum 8; other lengths use GHASH J0 derivation).
 * @param AAD - Additional authenticated data.
 * @returns AEAD cipher instance with a fixed 16-byte tag.
 * @example
 * Encrypts and authenticates plaintext with a fresh key and 12-byte nonce.
 *
 * ```ts
 * import { gcm } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const nonce = randomBytes(12);
 * const cipher = gcm(key, nonce);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const gcm = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 12, tagLength: 16, varSizeNonce: true }, function aesgcm(key, nonce, AAD) {
    // SP 800-38D lets implementations narrow supported IV lengths.
    // This wrapper intentionally requires at least 8 bytes; OpenSSL accepts shorter IVs too.
    // 12-byte nonces take the fast path; other allowed lengths use GHASH to derive J0.
    if (nonce.length < 8)
        throw new Error('aes/gcm: invalid nonce length');
    const tagLength = 16;
    function _computeTag(authKey, tagMask, data) {
        const tag = computeTag$1(ghash, false, authKey, data, AAD);
        for (let i = 0; i < tagMask.length; i++)
            tag[i] ^= tagMask[i];
        return tag;
    }
    function deriveKeys() {
        const xk = expandKeyLE$1(key);
        const authKey = EMPTY_BLOCK.slice();
        const counter = EMPTY_BLOCK.slice();
        ctr32(xk, false, counter, counter, authKey);
        // NIST 800-38d, page 15: different behavior for 96-bit and non-96-bit nonces
        if (nonce.length === 12) {
            counter.set(nonce);
        }
        else {
            const nonceLen = EMPTY_BLOCK.slice();
            const view = createView(nonceLen);
            view.setBigUint64(8, BigInt(nonce.length * 8), false);
            // GHASH.update() pads each call to 16 bytes, so
            // update(nonce).update(nonceLen) realizes
            // IV || 0^s || 0^64 || [len(IV)]_64 for non-96-bit nonces.
            // ghash(nonce || u64be(0) || u64be(nonceLen*8))
            const g = ghash.create(authKey).update(nonce).update(nonceLen);
            g.digestInto(counter); // digestInto doesn't trigger '.destroy'
            g.destroy();
        }
        // GCTR_K(J0, 0^128) = E_K(J0); reusing ctr32() here extracts that tag
        // mask and leaves `counter` advanced to inc32(J0) for payload GCTR.
        const tagMask = ctr32(xk, false, counter, EMPTY_BLOCK);
        return { xk, authKey, counter, tagMask };
    }
    return {
        encrypt(plaintext) {
            const { xk, authKey, counter, tagMask } = deriveKeys();
            const out = new Uint8Array(plaintext.length + tagLength);
            const toClean = [xk, authKey, counter, tagMask];
            if (!isAligned32(plaintext))
                toClean.push((plaintext = copyBytes(plaintext)));
            ctr32(xk, false, counter, plaintext, out.subarray(0, plaintext.length));
            const tag = _computeTag(authKey, tagMask, out.subarray(0, out.length - tagLength));
            toClean.push(tag);
            out.set(tag, plaintext.length);
            clean(...toClean);
            return out;
        },
        decrypt(ciphertext) {
            const { xk, authKey, counter, tagMask } = deriveKeys();
            const toClean = [xk, authKey, tagMask, counter];
            if (!isAligned32(ciphertext))
                toClean.push((ciphertext = copyBytes(ciphertext)));
            const data = ciphertext.subarray(0, -tagLength);
            const passedTag = ciphertext.subarray(-tagLength);
            const tag = _computeTag(authKey, tagMask, data);
            toClean.push(tag);
            // NIST SP 800-38D §7.2 permits equivalent step orderings; verify the
            // tag before CTR so unauthenticated plaintext is never materialized.
            if (!equalBytes(tag, passedTag)) {
                clean(...toClean);
                throw new Error('aes/gcm: invalid ghash tag');
            }
            const out = ctr32(xk, false, counter, data);
            clean(...toClean);
            return out;
        },
    };
});
const limit = (name, min, max) => (value) => {
    // Current AES-SIV/GCM-SIV callers pass protocol limits from RFC 8452 / RFC 5297,
    // not arbitrary library-preference bounds.
    // Callers feed Uint8Array.length values here, so safe-integer rejection
    // does not exclude any representable input even when an RFC bound is larger.
    if (!Number.isSafeInteger(value) || min > value || value > max) {
        const minmax = '[' + min + '..' + max + ']';
        throw new Error('' + name + ': expected value in range ' + minmax + ', got ' + value);
    }
};
/**
 * **SIV** (Synthetic IV): GCM with nonce-misuse resistance.
 * Repeating nonces reveal only the fact plaintexts are identical.
 * Also suffers from GCM issues: key wear-out limits & MAC forging.
 * See {@link https://www.rfc-editor.org/rfc/rfc8452 | RFC 8452}.
 * RFC 8452 defines 16-byte and 32-byte AES keys for this mode.
 * This implementation also accepts 24-byte AES-192 keys as a local
 * extension; see the inline comment next to `validateKeyLength(key)` below
 * for the exact scope note.
 * @param key - AES key bytes.
 * @param nonce - 12-byte nonce.
 * @param AAD - Additional authenticated data.
 * @returns AEAD cipher instance.
 * @example
 * Encrypts and authenticates plaintext with a fresh key and nonce, while tolerating reuse.
 *
 * ```ts
 * import { gcmsiv } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const nonce = randomBytes(12);
 * const cipher = gcmsiv(key, nonce);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const gcmsiv = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 12, tagLength: 16, varSizeNonce: true }, function aessiv(key, nonce, AAD) {
    const tagLength = 16;
    // From RFC 8452: Section 6
    const AAD_LIMIT = limit('AAD', 0, 2 ** 36);
    const PLAIN_LIMIT = limit('plaintext', 0, 2 ** 36);
    const NONCE_LIMIT = limit('nonce', 12, 12);
    const CIPHER_LIMIT = limit('ciphertext', 16, 2 ** 36 + 16);
    abytes(key);
    // RFC 8452 only standardizes 16-byte and 32-byte key-generating keys.
    // The accepted 24-byte path is a local AES-192 extension outside the RFC-defined AEADs.
    validateKeyLength(key);
    NONCE_LIMIT(nonce.length);
    if (AAD !== undefined)
        AAD_LIMIT(AAD.length);
    function deriveKeys() {
        const xk = expandKeyLE$1(key);
        const encKey = new Uint8Array(key.length);
        const authKey = new Uint8Array(16);
        const toClean = [xk, encKey];
        let _nonce = nonce;
        // Copy on BE or misaligned nonce so u32()/swap32IfBE() normalization
        // never mutates caller nonce bytes before RFC 8452 key derivation.
        if (!isLE || !isAligned32(_nonce))
            toClean.push((_nonce = copyBytes(_nonce)));
        const n32 = u32(_nonce);
        swap32IfBE(n32);
        // prettier-ignore
        let s0 = 0, s1 = n32[0], s2 = n32[1], s3 = n32[2];
        let counter = 0;
        for (const derivedKey of [authKey, encKey].map(u32)) {
            const d32 = u32(derivedKey);
            for (let i = 0; i < d32.length; i += 2) {
                // aes(u32le(0) || nonce)[:8] || aes(u32le(1) || nonce)[:8] ...
                const { s0: o0, s1: o1 } = encrypt(xk, s0, s1, s2, s3);
                d32[i + 0] = o0;
                d32[i + 1] = o1;
                s0 = ++counter; // increment counter inside state
            }
            swap32IfBE(d32);
        }
        const res = { authKey, encKey: expandKeyLE$1(encKey) };
        // Cleanup
        clean(...toClean);
        return res;
    }
    function _computeTag(encKey, authKey, data) {
        const tag = computeTag$1(polyval, true, authKey, data, AAD);
        // Compute the expected tag by XORing S_s and the nonce, clearing the
        // most significant bit of the last byte and encrypting with the
        // message-encryption key.
        for (let i = 0; i < 12; i++)
            tag[i] ^= nonce[i];
        tag[15] &= 0x7f; // Clear the highest bit
        // encrypt tag as block
        const t32 = u32(tag);
        swap32IfBE(t32);
        // prettier-ignore
        let s0 = t32[0], s1 = t32[1], s2 = t32[2], s3 = t32[3];
        ({ s0, s1, s2, s3 } = encrypt(encKey, s0, s1, s2, s3));
        ((t32[0] = s0), (t32[1] = s1), (t32[2] = s2), (t32[3] = s3));
        swap32IfBE(t32);
        return tag;
    }
    // actual decrypt/encrypt of message.
    function processSiv(encKey, tag, input) {
        let block = copyBytes(tag);
        // RFC 8452 §4 / §5 use the tag with the highest bit of the last byte
        // forced to one as the initial AES-CTR counter block.
        block[15] |= 0x80; // Force highest bit
        const res = ctr32(encKey, true, block, input);
        // Cleanup
        clean(block);
        return res;
    }
    return {
        encrypt(plaintext) {
            PLAIN_LIMIT(plaintext.length);
            const { encKey, authKey } = deriveKeys();
            const tag = _computeTag(encKey, authKey, plaintext);
            const toClean = [encKey, authKey, tag];
            if (!isAligned32(plaintext))
                toClean.push((plaintext = copyBytes(plaintext)));
            const out = new Uint8Array(plaintext.length + tagLength);
            out.set(tag, plaintext.length);
            out.set(processSiv(encKey, tag, plaintext));
            // Cleanup
            clean(...toClean);
            return out;
        },
        decrypt(ciphertext) {
            CIPHER_LIMIT(ciphertext.length);
            const tag = ciphertext.subarray(-tagLength);
            const { encKey, authKey } = deriveKeys();
            const toClean = [encKey, authKey];
            if (!isAligned32(ciphertext))
                toClean.push((ciphertext = copyBytes(ciphertext)));
            const plaintext = processSiv(encKey, tag, ciphertext.subarray(0, -tagLength));
            const expectedTag = _computeTag(encKey, authKey, plaintext);
            toClean.push(expectedTag);
            // RFC 8452 §5: plaintext is unauthenticated here and MUST NOT be
            // returned until the expected-tag check completes successfully.
            if (!equalBytes(tag, expectedTag)) {
                clean(...toClean);
                throw new Error('invalid polyval tag');
            }
            // Cleanup
            clean(...toClean);
            return plaintext;
        },
    };
});
function isBytes32(a) {
    // Plain `instanceof Uint32Array` is too strict for cross-realm expanded-key views.
    // This is only a best-effort unsafe-export guard, not a provenance proof for `expandKeyLE`.
    return (a instanceof Uint32Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint32Array'));
}
// Unsafe single-block helpers: mutate `block` in place and require its 16-byte
// Uint8Array view to be 4-byte aligned because `u32(block)` reinterprets it.
function encryptBlock$1(xk, block) {
    abytes(block, 16, 'block');
    if (!isBytes32(xk))
        throw new Error('_encryptBlock accepts result of expandKeyLE');
    const b32 = u32(block);
    swap32IfBE(b32);
    let { s0, s1, s2, s3 } = encrypt(xk, b32[0], b32[1], b32[2], b32[3]);
    ((b32[0] = s0), (b32[1] = s1), (b32[2] = s2), (b32[3] = s3));
    swap32IfBE(b32);
    return block;
}
function decryptBlock(xk, block) {
    abytes(block, 16, 'block');
    if (!isBytes32(xk))
        throw new Error('_decryptBlock accepts result of expandKeyLE');
    const b32 = u32(block);
    swap32IfBE(b32);
    let { s0, s1, s2, s3 } = decrypt(xk, b32[0], b32[1], b32[2], b32[3]);
    ((b32[0] = s0), (b32[1] = s1), (b32[2] = s2), (b32[3] = s3));
    swap32IfBE(b32);
    return block;
}
/**
 * AES-W (base for AESKW/AESKWP).
 * Specs:
 * {@link https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf | SP800-38F},
 * {@link https://www.rfc-editor.org/rfc/rfc3394 | RFC 3394},
 * {@link https://www.rfc-editor.org/rfc/rfc5649 | RFC 5649}.
 * Shared core mutates `out` in place; callers are responsible for prepending
 * the right IV/AIV and checking the recovered value after decrypt.
 */
const AESW = {
    /*
    High-level pseudocode:
    ```
    A: u64 = IV
    out = []
    for (let i=0, ctr = 0; i<6; i++) {
      for (const chunk of chunks(plaintext, 8)) {
        A ^= swapEndianess(ctr++)
        [A, res] = chunks(encrypt(A || chunk), 8);
        out ||= res
      }
    }
    out = A || out
    ```
    Decrypt is the same, but reversed.
    */
    encrypt(kek, out) {
        // Current implementation keeps RFC 3394/5649 `t` in a u32-shaped counter,
        // so the shared core caps plaintext below 4 GiB even though the specs allow more.
        if (out.length >= 2 ** 32)
            throw new Error('plaintext should be less than 4gb');
        const xk = expandKeyLE$1(kek);
        // 16-byte `S = A || P[1]` is the RFC 5649 KWP special case for n=1;
        // KW callers never reach it because KW requires at least two plaintext semiblocks.
        if (out.length === 16)
            encryptBlock$1(xk, out);
        else {
            const o32 = u32(out);
            swap32IfBE(o32);
            // prettier-ignore
            let a0 = o32[0], a1 = o32[1]; // A
            for (let j = 0, ctr = 1; j < 6; j++) {
                for (let pos = 2; pos < o32.length; pos += 2, ctr++) {
                    const { s0, s1, s2, s3 } = encrypt(xk, a0, a1, o32[pos], o32[pos + 1]);
                    // A = MSB(64, B) ^ t where t = (n*j)+i. Under the 32-bit length cap
                    // above, `t` fits in the low half of `[t]_64`, so xor only the low
                    // 32 bits of A after converting `ctr` to network order.
                    ((a0 = s0), (a1 = s1 ^ byteSwap(ctr)), (o32[pos] = s2), (o32[pos + 1] = s3));
                }
            }
            ((o32[0] = a0), (o32[1] = a1)); // out = A || out
            swap32IfBE(o32);
        }
        xk.fill(0);
    },
    decrypt(kek, out) {
        // Same implementation cap on the recovered plaintext length after
        // removing the 8-byte A/IV prefix.
        if (out.length - 8 >= 2 ** 32)
            throw new Error('ciphertext should be less than 4gb');
        const xk = expandKeyDecLE(kek);
        const chunks = out.length / 8 - 1; // first chunk is IV
        // `n = 2` semiblocks is the RFC 5649 KWP special case; KW ciphertexts
        // always have at least three semiblocks and therefore use the W^-1 loop.
        if (chunks === 1)
            decryptBlock(xk, out);
        else {
            const o32 = u32(out);
            swap32IfBE(o32);
            // prettier-ignore
            let a0 = o32[0], a1 = o32[1]; // A
            for (let j = 0, ctr = chunks * 6; j < 6; j++) {
                for (let pos = chunks * 2; pos >= 1; pos -= 2, ctr--) {
                    a1 ^= byteSwap(ctr);
                    const { s0, s1, s2, s3 } = decrypt(xk, a0, a1, o32[pos], o32[pos + 1]);
                    ((a0 = s0), (a1 = s1), (o32[pos] = s2), (o32[pos + 1] = s3));
                }
            }
            ((o32[0] = a0), (o32[1] = a1));
            swap32IfBE(o32);
        }
        xk.fill(0);
    },
};
// RFC 3394 §2.2.3.1 / NIST SP 800-38F Algorithm 3 / Algorithm 4: KW prepends
// the default 64-bit ICV1 and unwrap must verify the same value.
const AESKW_IV = /* @__PURE__ */ new Uint8Array(8).fill(0xa6); // A6A6A6A6A6A6A6A6
/**
 * AES-KW (key-wrap). Injects static IV into plaintext, adds counter, encrypts 6 times.
 * Reduces block size from 16 to 8 bytes.
 * Plaintext must be a non-empty multiple of 8 bytes with minimum 16 bytes.
 * 8-byte inputs use aeskwp.
 * Wrapped ciphertext must be a multiple of 8 bytes with minimum 24 bytes.
 * For padded version, use aeskwp.
 * See {@link https://www.rfc-editor.org/rfc/rfc3394/ | RFC 3394} and
 * {@link https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf | NIST SP 800-38F}.
 * @param kek - AES key-encryption key.
 * @returns Key-wrap cipher instance.
 * As with other `wrapCipher(...)` wrappers, `encrypt()` is single-use per
 * instance.
 * @example
 * Wraps a 128-bit content-encryption key with a fresh key-encryption key.
 *
 * ```ts
 * import { aeskw } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const kek = randomBytes(16);
 * const cek = randomBytes(16);
 * const wrap = aeskw(kek);
 * wrap.encrypt(cek);
 * ```
 */
const aeskw = /* @__PURE__ */ wrapCipher({ blockSize: 8 }, (kek) => ({
    encrypt(plaintext) {
        if (!plaintext.length || plaintext.length % 8 !== 0)
            throw new Error('invalid plaintext length');
        // RFC 3394 / NIST SP 800-38F define KW only for >=2 plaintext
        // semiblocks; the 1-semiblock case belongs to RFC 5649 KWP.
        if (plaintext.length === 8)
            throw new Error('8-byte keys not allowed in AESKW, use AESKWP instead');
        const out = concatBytes(AESKW_IV, plaintext);
        AESW.encrypt(kek, out);
        return out;
    },
    decrypt(ciphertext) {
        // ciphertext must be at least 24 bytes and a multiple of 8 bytes
        // 24 because should have at least two block (1 iv + 2).
        // Replace with 16 to enable '8-byte keys'
        if (ciphertext.length % 8 !== 0 || ciphertext.length < 3 * 8)
            throw new Error('invalid ciphertext length');
        // AESW.decrypt() mutates its buffer in place, so keep caller ciphertext
        // immutable across the unwrap, ICV1 check, and IV scrubbing below.
        const out = copyBytes(ciphertext);
        AESW.decrypt(kek, out);
        if (!equalBytes(out.subarray(0, 8), AESKW_IV))
            throw new Error('integrity check failed');
        out.subarray(0, 8).fill(0); // ciphertext.subarray(0, 8) === IV, but we clean it anyway
        return out.subarray(8);
    },
}));
/*
We don't support 8-byte keys. The rabbit hole:

- Wycheproof says: "NIST SP 800-38F does not define the wrapping of 8 byte keys.
  RFC 3394 Section 2  on the other hand specifies that 8 byte keys are wrapped
  by directly encrypting one block with AES."
    - {@link https://github.com/C2SP/wycheproof/blob/master/doc/key_wrap.md | Wycheproof key-wrap note}
    - "RFC 3394 specifies in Section 2, that the input for the key wrap
      algorithm must be at least two blocks and otherwise the constant
      field and key are simply encrypted with ECB as a single block"
- What RFC 3394 actually says (in Section 2):
    - "Before being wrapped, the key data is parsed into n blocks of 64 bits.
      The only restriction the key wrap algorithm places on n is that n be
      at least two"
    - "For key data with length less than or equal to 64 bits, the constant
      field used in this specification and the key data form a single
      128-bit codebook input making this key wrap unnecessary."
- Which means "assert(n >= 2)" and "use something else for 8 byte keys"
- NIST SP800-38F actually prohibits 8-byte in "5.3.1 Mandatory Limits".
  It states that plaintext for KW should be "2 to 2^54 -1 semiblocks".
- So, where does "directly encrypt single block with AES" come from?
    - Not RFC 3394. Pseudocode of key wrap in 2.2 explicitly uses
      loop of 6 for any code path
    - There is a weird W3C spec:
      {@link https://www.w3.org/TR/2002/REC-xmlenc-core-20021210/Overview.html#kw-aes128 | XML Encryption AES key-wrap section}
    - This spec is outdated, as admitted by Wycheproof authors
    - There is RFC 5649 for padded key wrap, which is padding construction on
      top of AESKW. In '4.1.2' it says: "If the padded plaintext contains exactly
      eight octets, then prepend the AIV as defined in Section 3 above to P[1] and
      encrypt the resulting 128-bit block using AES in ECB mode [Modes] with key
      K (the KEK).  In this case, the output is two 64-bit blocks C[0] and C[1]:"
    - Browser subtle crypto is actually crashes on wrapping keys less than 16 bytes:
      `Error: error:1C8000E6:Provider routines::invalid input length]
       { opensslErrorStack: [ 'error:030000BD:digital envelope routines::update error' ]`

In the end, seems like a bug in Wycheproof.
The 8-byte check can be easily disabled inside of AES_W.
*/
// RFC 5649 §3 / NIST SP 800-38F Algorithm 5 / Algorithm 6: KWP uses ICV2 as
// the high 32 bits of the AIV; the low 32 bits carry the MLI in network order.
const AESKWP_IV = 0xa65959a6; // single u32le value
/**
 * AES-KW, but with padding and allows random keys.
 * Uses the RFC 5649 alternative initial value; the second u32 stores the
 * 32-bit MLI in network order.
 * Wrapped ciphertext must be at least 16 bytes; malformed lengths are
 * rejected during AIV/padding checks.
 * See {@link https://www.rfc-editor.org/rfc/rfc5649 | RFC 5649}.
 * @param kek - AES key-encryption key.
 * @returns Padded key-wrap cipher instance.
 * @example
 * Wraps a short key blob using the padded variant and a fresh key-encryption key.
 *
 * ```ts
 * import { aeskwp } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const kek = randomBytes(16);
 * const wrap = aeskwp(kek);
 * wrap.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const aeskwp = /* @__PURE__ */ wrapCipher({ blockSize: 8 }, (kek) => ({
    encrypt(plaintext) {
        if (!plaintext.length)
            throw new Error('invalid plaintext length');
        const padded = Math.ceil(plaintext.length / 8) * 8;
        const out = new Uint8Array(8 + padded);
        out.set(plaintext, 8);
        const out32 = u32(out);
        out32[0] = swap8IfBE(AESKWP_IV);
        // RFC 5649 §3: the low 32 bits of the AIV carry the octet-length MLI in
        // network order, even though this buffer is addressed through LE u32s.
        out32[1] = swap8IfBE(byteSwap(plaintext.length));
        AESW.encrypt(kek, out);
        return out;
    },
    decrypt(ciphertext) {
        // 16 because should have at least one block
        if (ciphertext.length < 16)
            throw new Error('invalid ciphertext length');
        // AESW.decrypt() mutates its buffer in place, so keep caller ciphertext
        // immutable across the unwrap, AIV checks, and IV scrubbing below.
        const out = copyBytes(ciphertext);
        const o32 = u32(out);
        AESW.decrypt(kek, out);
        const len = byteSwap(swap8IfBE(o32[1])) >>> 0;
        const padded = Math.ceil(len / 8) * 8;
        if (swap8IfBE(o32[0]) !== AESKWP_IV || out.length - 8 !== padded)
            throw new Error('integrity check failed');
        // RFC 5649 §3 / NIST SP 800-38F Algorithm 6: recovered padding length
        // must be in [0,7], and every recovered pad octet must be zero.
        for (let i = len; i < padded; i++)
            if (out[8 + i] !== 0)
                throw new Error('integrity check failed');
        out.subarray(0, 8).fill(0); // ciphertext.subarray(0, 8) === IV, but we clean it anyway
        return out.subarray(8, 8 + len);
    },
}));
//#region CMAC
/**
 * Left-shift by one bit and conditionally XOR with 0x87:
 * ```
 * if MSB(L) is equal to 0
 * then    K1 := L << 1;
 * else    K1 := (L << 1) XOR const_Rb;
 * ```
 *
 * Specs:
 * {@link https://www.rfc-editor.org/rfc/rfc4493.html#section-2.3 | RFC 4493 Section 2.3},
 * {@link https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.3 | RFC 5297 Section 2.3}
 *
 * @returns modified `block` (for chaining)
 */
function dbl(block) {
    let carry = 0;
    // Left shift by 1 bit
    for (let i = BLOCK_SIZE - 1; i >= 0; i--) {
        const newCarry = (block[i] & 0x80) >>> 7;
        block[i] = (block[i] << 1) | carry;
        carry = newCarry;
    }
    // XOR with 0x87 if there was a carry from the most significant bit
    if (carry) {
        // RFC 4493 §2.3 / RFC 5297 §2.1: 0x87 is const_Rb for doubling in the
        // CMAC/S2V finite field with primitive polynomial x^128 + x^7 + x^2 + x + 1.
        block[BLOCK_SIZE - 1] ^= 0x87;
    }
    return block;
}
/**
 * `a XOR b`, running in-place on `a`.
 * @param a left operand and output
 * @param b right operand
 * @returns `a` (for chaining)
 */
function xorBlock(a, b) {
    if (a.length !== b.length)
        throw new Error('xorBlock: blocks must have same length');
    for (let i = 0; i < a.length; i++) {
        a[i] = a[i] ^ b[i];
    }
    return a;
}
/**
 * xorend as defined in
 * {@link https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.1 | RFC 5297 Section 2.1}.
 *
 * ```
 * leftmost(A, len(A)-len(B)) || (rightmost(A, len(B)) xor B)
 * ```
 *
 * Mutates `a` in place so the left prefix stays untouched and only the
 * rightmost `len(B)` bytes are xored with `b`.
 */
function xorend(a, b) {
    if (b.length > a.length) {
        throw new Error('xorend: len(B) must be less than or equal to len(A)');
    }
    // keep leftmost part of `a` unchanged
    // and xor only the rightmost part:
    const offset = a.length - b.length;
    for (let i = 0; i < b.length; i++) {
        a[offset + i] = a[offset + i] ^ b[i];
    }
    return a;
}
/**
 * Internal CMAC class.
 */
class _CMAC {
    blockLen = BLOCK_SIZE;
    outputLen = BLOCK_SIZE;
    // CMAC can only decide between `K1` and `K2` once the true final block is known,
    // so updates process older blocks eagerly but keep one pending block buffered.
    buffer;
    pos;
    finished;
    destroyed;
    k1;
    k2;
    x;
    xk;
    constructor(key) {
        abytes(key);
        validateKeyLength(key);
        this.xk = expandKeyLE$1(key);
        this.buffer = new Uint8Array(BLOCK_SIZE);
        this.pos = 0;
        this.finished = false;
        this.destroyed = false;
        this.x = new Uint8Array(BLOCK_SIZE);
        // L = AES_encrypt(K, const_Zero)
        const L = new Uint8Array(BLOCK_SIZE);
        encryptBlock$1(this.xk, L);
        // Generate subkeys K1 and K2 from the main key according to
        // {@link https://www.rfc-editor.org/rfc/rfc4493.html#section-2.3 | RFC 4493 Section 2.3}
        // K1
        this.k1 = dbl(L);
        this.k2 = dbl(new Uint8Array(this.k1));
    }
    process(data) {
        // RFC 4493 §2.4 step 6 loop body: Y := X XOR M_i; X := AES-128(K, Y).
        xorBlock(this.x, data);
        encryptBlock$1(this.xk, this.x);
    }
    update(data) {
        if (this.destroyed)
            throw new Error('Hash instance has been destroyed');
        if (this.finished)
            throw new Error('Hash#digest() has already been called');
        abytes(data);
        let pos = 0;
        if (this.pos) {
            const take = Math.min(BLOCK_SIZE - this.pos, data.length);
            this.buffer.set(data.subarray(0, take), this.pos);
            this.pos += take;
            pos = take;
            if (this.pos === BLOCK_SIZE && pos < data.length) {
                this.process(this.buffer);
                this.pos = 0;
            }
        }
        // Keep one complete block buffered: an exact 16-byte tail may still be
        // M_n, and digestInto() must decide there whether RFC 4493 uses K1 or K2.
        while (pos + BLOCK_SIZE < data.length) {
            this.process(data.subarray(pos, pos + BLOCK_SIZE));
            pos += BLOCK_SIZE;
        }
        if (pos < data.length) {
            this.buffer.set(data.subarray(pos), 0);
            this.pos = data.length - pos;
        }
        return this;
    }
    // See {@link https://www.rfc-editor.org/rfc/rfc4493.html#section-2.4 | RFC 4493 Section 2.4}.
    digestInto(out) {
        if (this.destroyed)
            throw new Error('Hash instance has been destroyed');
        if (this.finished)
            throw new Error('Hash#digest() has already been called');
        // `digestInto(out)` is the no-allocation fast path, so AES block re-use below
        // requires a 32-bit-aligned caller buffer instead of hidden temp copies.
        aoutput(out, this, true);
        this.finished = true;
        // `digestInto()` accepts out.length >= outputLen, so only the first block stores the tag.
        const view = out.subarray(0, this.outputLen);
        let last = new Uint8Array(BLOCK_SIZE);
        if (this.pos === BLOCK_SIZE) {
            // M_last := M_n XOR K1;
            last.set(this.buffer);
            xorBlock(last, this.k1);
        }
        else {
            // M_last := padding(M_n) XOR K2;
            //
            // [...] padding(x) is the concatenation of x and a single '1',
            // followed by the minimum number of '0's, so that the total length is
            // equal to 128 bits.
            last.set(this.buffer.subarray(0, this.pos));
            last[this.pos] = 0x80; // single '1' bit
            xorBlock(last, this.k2);
        }
        view.set(this.x); // X := AES_CBC(K, M_1..M_{n-1})
        xorBlock(view, last); // Y := X XOR M_last
        encryptBlock$1(this.xk, view); // T := AES-128(K, Y)
        clean(last);
    }
    digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        // Copy out before destroy() wipes the internal digest buffer in place.
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
    }
    destroy() {
        const { buffer, destroyed, x, xk, k1, k2 } = this;
        if (destroyed)
            return;
        this.destroyed = true;
        // Wipe the buffered tail, chaining value, expanded AES key, and both CMAC subkeys.
        clean(buffer, x, xk, k1, k2);
    }
}
/**
 * AES-CMAC (Cipher-based Message Authentication Code).
 * Specs: {@link https://www.rfc-editor.org/rfc/rfc4493.html | RFC 4493}.
 * @param msg - Message bytes to authenticate.
 * @param key - AES key bytes.
 * @returns 16-byte authentication tag. `cmac.create(...)` follows the same incremental MAC shape as
 * the other keyed helpers in this repo, including `blockLen`,
 * `outputLen`, `digestInto()` and `destroy()`.
 * @example
 * Authenticates a message with AES-CMAC and a fresh key.
 *
 * ```ts
 * import { cmac } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * cmac(new Uint8Array(), key);
 * ```
 */
// The 16-byte probe key is only used to read static metadata; runtime CMAC
// still accepts AES-128/192/256 keys.
const cmac = /* @__PURE__ */ wrapMacConstructor(16, (key) => new _CMAC(key));
/**
 * S2V (Synthetic Initialization Vector) function as described in
 * {@link https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.4 | RFC 5297 Section 2.4}.
 *
 * ```
 * S2V(K, S1, ..., Sn) {
 *   if n = 0 then
 *     return V = AES-CMAC(K, <one>)
 *   fi
 *   D = AES-CMAC(K, <zero>)
 *   for i = 1 to n-1 do
 *     D = dbl(D) xor AES-CMAC(K, Si)
 *   done
 *   if len(Sn) >= 128 then
 *     T = Sn xorend D
 *   else
 *     T = dbl(D) xor pad(Sn)
 *   fi
 *   return V = AES-CMAC(K, T)
 * }
 * ```
 *
 * S2V takes a key and a vector of strings S1, S2, ..., Sn and returns a 128-bit string.
 * The S2V function is used to generate a synthetic IV for AES-SIV.
 *
 * @param key - AES key (128, 192, or 256 bits)
 * @param strings - Array of byte arrays to process
 * @returns 128-bit synthetic IV
 */
function s2v(key, strings) {
    validateKeyLength(key);
    const len = strings.length;
    if (len > 127) {
        // RFC 5297 §7 only proves S2V secure for at most 127 components; SIV
        // spends one of those on the plaintext, leaving at most 126 AAD inputs.
        throw new Error('s2v: number of input strings must be less than or equal to 127');
    }
    if (len === 0)
        return cmac(ONE_BLOCK, key);
    // D = AES-CMAC(K, <zero>)
    let d = cmac(EMPTY_BLOCK, key);
    // for i = 1 to n-1 do
    //   D = dbl(D) xor AES-CMAC(K, Si)
    for (let i = 0; i < len - 1; i++) {
        dbl(d);
        const cmacResult = cmac(strings[i], key);
        xorBlock(d, cmacResult);
        clean(cmacResult);
    }
    const s_n = strings[len - 1];
    // Earlier components are validated through cmac(...); validate the final one explicitly because
    // the Uint8Array.from()/set() paths below would otherwise coerce array-like inputs silently.
    abytes(s_n);
    let t;
    // if len(Sn) >= 128 then
    if (s_n.byteLength >= BLOCK_SIZE) {
        // T = Sn xorend D
        t = xorend(Uint8Array.from(s_n), d);
    }
    else {
        // pad(Sn):
        const paddedSn = new Uint8Array(BLOCK_SIZE);
        paddedSn.set(s_n);
        paddedSn[s_n.length] = 0x80; // padding: 0x80 followed by zeros
        // T = dbl(D) xor pad(Sn)
        t = xorBlock(dbl(d), paddedSn);
        clean(paddedSn);
    }
    // V = AES-CMAC(K, T)
    const result = cmac(t, key);
    clean(d, t);
    return result;
}
/**
 * **SIV**: Synthetic Initialization Vector (SIV) Authenticated Encryption
 * Nonce is derived from the plaintext and AAD using the S2V function.
 * Supports at most 126 AAD components. RFC 5297 nonce-based use is expressed by
 * passing the nonce as the final AAD component before the plaintext.
 * See {@link https://datatracker.ietf.org/doc/html/rfc5297.html | RFC 5297}.
 * @param key - 32-byte, 48-byte, or 64-byte key.
 * @param AAD - Additional authenticated data chunks (up to 126).
 * @returns AEAD cipher instance.
 * @example
 * Authenticates and encrypts plaintext with a fresh key without requiring unique nonces.
 *
 * ```ts
 * import { aessiv } from '@noble/ciphers/aes.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const cipher = aessiv(key);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const aessiv = /* @__PURE__ */ wrapCipher({ blockSize: 16, tagLength: 16 }, function aessiv(key, ...AAD) {
    // From RFC 5297: Section 6.1, 6.2, 6.3:
    const PLAIN_LIMIT = limit('plaintext', 0, 2 ** 132);
    const CIPHER_LIMIT = limit('ciphertext', 16, 2 ** 132 + 16);
    if (AAD.length > 126) {
        // RFC 5297 §2.6 / §2.7 / §7: SIV passes the plaintext as the last S2V
        // component, so callers only get 126 associated-data components.
        throw new Error('"AAD" number of elements must be less than or equal to 126');
    }
    AAD.forEach((aad) => abytes(aad));
    abytes(key);
    if (![32, 48, 64].includes(key.length))
        throw new Error('"aes key" expected Uint8Array of length 32/48/64, got length=' + key.length);
    // The key is split into equal halves, K1 = leftmost(K, len(K)/2) and
    // K2 = rightmost(K, len(K)/2).  K1 is used for S2V and K2 is used for CTR.
    // This borrows caller key/AAD buffers by reference; mutating them after
    // construction changes future encrypt/decrypt results.
    const k1 = key.subarray(0, key.length / 2);
    const k2 = key.subarray(key.length / 2);
    return {
        // {@link https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.6 | RFC 5297 Section 2.6}
        encrypt(plaintext) {
            PLAIN_LIMIT(plaintext.length);
            const v = s2v(k1, [...AAD, plaintext]);
            // clear out the 31st and 63rd (rightmost) bit:
            const q = Uint8Array.from(v);
            q[8] &= 0x7f;
            q[12] &= 0x7f;
            // encrypt:
            const c = ctr(k2, q).encrypt(plaintext);
            return concatBytes(v, c);
        },
        // {@link https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.7 | RFC 5297 Section 2.7}
        decrypt(ciphertext) {
            CIPHER_LIMIT(ciphertext.length);
            const v = ciphertext.subarray(0, BLOCK_SIZE);
            const c = ciphertext.subarray(BLOCK_SIZE);
            // clear out the 31st and 63rd (rightmost) bit:
            const q = Uint8Array.from(v);
            q[8] &= 0x7f;
            q[12] &= 0x7f;
            // decrypt:
            const p = ctr(k2, q).decrypt(c);
            // verify tag:
            const t = s2v(k1, [...AAD, p]);
            if (equalBytes(t, v)) {
                return p;
            }
            else {
                throw new Error('invalid siv tag');
            }
        },
    };
});
//#endregion
/**
 * Unsafe low-level internal methods. May change at any time.
 * Callers are expected to use reviewed expanded-key outputs, pass mutable and
 * aligned 16-byte blocks where required, and treat several helpers as in-place
 * mutations of their input buffers or counters.
 */
const unsafe = /* @__PURE__ */ Object.freeze({
    expandKeyLE: expandKeyLE$1,
    expandKeyDecLE,
    encrypt,
    decrypt,
    encryptBlock: encryptBlock$1,
    decryptBlock,
    ctrCounter,
    ctr32,
    dbl,
    xorBlock,
    xorend,
    s2v,
});

/**
 * Basic utils for ARX (add-rotate-xor) salsa and chacha ciphers.

RFC8439 requires multi-step cipher stream, where
authKey starts with counter: 0, actual msg with counter: 1.

For this, we need a way to re-use nonce / counter:

    const counter = new Uint8Array(4);
    chacha(..., counter, ...); // counter is now 1
    chacha(..., counter, ...); // counter is now 2

This is complicated:

- 32-bit counters are enough, no need for 64-bit: max ArrayBuffer size in JS is 4GB
- Original papers don't allow mutating counters
- Counter overflow is undefined [^1]
- Idea A: allow providing (nonce | counter) instead of just nonce, re-use it
- Caveat: Cannot be re-used through all cases:
- * chacha has (counter | nonce)
- * xchacha has (nonce16 | counter | nonce16)
- Idea B: separate nonce / counter and provide separate API for counter re-use
- Caveat: there are different counter sizes depending on an algorithm.
- salsa & chacha also differ in structures of key & sigma:
  salsa20:      s[0] | k(4) | s[1] | nonce(2) | cnt(2) | s[2] | k(4) | s[3]
  chacha:       s(4) | k(8) | cnt(1) | nonce(3)
  chacha20orig: s(4) | k(8) | cnt(2) | nonce(2)
- Idea C: helper method such as `setSalsaState(key, nonce, sigma, data)`
- Caveat: we can't re-use counter array

xchacha uses the subkey and remaining 8 byte nonce with ChaCha20 as normal
(prefixed by 4 NUL bytes, since RFC8439 specifies a 12-byte nonce).
Counter overflow is undefined; see {@link https://mailarchive.ietf.org/arch/msg/cfrg/gsOnTJzcbgG6OqD8Sc0GO5aR_tU/ | the CFRG thread}.
Current noble policy is strict non-wrap for the shared 32-bit counter path:
exported ARX ciphers reject initial `0xffffffff` and stop before any implicit
wrap back to zero.
See {@link https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha#appendix-A.2 | the XChaCha appendix} for the extended-nonce construction.

 * @module
 */
// Replaces `TextEncoder` for ASCII literals, which is enough for sigma constants.
// Non-ASCII input would not match UTF-8 `TextEncoder` output.
const encodeStr = (str) => Uint8Array.from(str.split(''), (c) => c.charCodeAt(0));
// Raw `createCipher(...)` exports consume these native-endian `u32(...)` views directly.
// Public `wrapCipher(...)` APIs reject non-little-endian platforms before reaching this path.
// RFC 8439 §2.3 / RFC 7539 §2.3 only define the 256-bit-key constants; this 16-byte sigma is
// kept for legacy allowShortKeys Salsa/ChaCha variants.
const sigma16_32 = /* @__PURE__ */ (() => swap32IfBE(u32(encodeStr('expand 16-byte k'))))();
// RFC 8439 §2.3 / RFC 7539 §2.3 define words 0-3 as
// `0x61707865 0x3320646e 0x79622d32 0x6b206574`, i.e. `expand 32-byte k`.
const sigma32_32 = /* @__PURE__ */ (() => swap32IfBE(u32(encodeStr('expand 32-byte k'))))();
/**
 * Rotates a 32-bit word left.
 * @param a - Input word.
 * @param b - Rotation count in bits.
 * @returns Rotated 32-bit word.
 * @example
 * Moves the top byte of `0x12345678` into the low byte position.
 * ```ts
 * rotl(0x12345678, 8);
 * ```
 */
function rotl(a, b) {
    return (a << b) | (a >>> (32 - b));
}
// Salsa and Chacha block length is always 512-bit
const BLOCK_LEN$1 = 64;
// RFC 8439 §2.2 / RFC 7539 §2.2: the ChaCha state has 16 32-bit words.
const BLOCK_LEN32 = 16;
// Counter policy for the shared public `counter` argument:
// - RFC/IETF ChaCha20 uses a 32-bit counter.
// - OpenSSL/Node `chacha20` instead treat the full 16-byte IV as a 128-bit
//   counter state and carry into the next word.
// - Raw `chacha20orig`, `salsa20`, `xsalsa20`, and `xchacha20` use 64-bit counters in libsodium
//   and libtomcrypt, while some libs (for example libtomcrypt's RFC/IETF path) reject the max
//   boundary instead of carrying.
// - AEAD wrappers diverge too: libsodium `xchacha20poly1305` uses the IETF payload counter from
//   block 1, while `secretstream_xchacha20poly1305` is a different protocol with rekey/reset.
// Noble intentionally throws instead of silently picking one wrap model for users. In the default
// path, even a 32-bit boundary would take 2^32 blocks * 64 bytes = 256 GiB, which is practically
// unreachable for normal JS callers; advanced users who pass `counter` explicitly can implement
// whatever wider carry / wrap policy they need on top.
const MAX_COUNTER = /* @__PURE__ */ (() => 2 ** 32 - 1)();
const U32_EMPTY = /* @__PURE__ */ Uint32Array.of();
function runCipher(core, sigma, key, nonce, data, output, counter, rounds) {
    const len = data.length;
    const block = new Uint8Array(BLOCK_LEN$1);
    const b32 = u32(block);
    // Make sure that buffers aligned to 4 bytes
    const isAligned = isLE && isAligned32(data) && isAligned32(output);
    const d32 = isAligned ? u32(data) : U32_EMPTY;
    const o32 = isAligned ? u32(output) : U32_EMPTY;
    // RFC 8439 §2.4.1 / RFC 7539 §2.4.1 allow XORing one keystream block at a time and
    // truncating the final partial block instead of materializing the whole keystream.
    if (!isLE) {
        for (let pos = 0; pos < len; counter++) {
            core(sigma, key, nonce, b32, counter, rounds);
            // RFC 8439 §2.4 / RFC 7539 §2.4 serialize keystream words in little-endian order.
            swap32IfBE(b32);
            if (counter >= MAX_COUNTER)
                throw new Error('arx: counter overflow');
            const take = Math.min(BLOCK_LEN$1, len - pos);
            for (let j = 0, posj; j < take; j++) {
                posj = pos + j;
                output[posj] = data[posj] ^ block[j];
            }
            pos += take;
        }
        return;
    }
    for (let pos = 0; pos < len; counter++) {
        core(sigma, key, nonce, b32, counter, rounds);
        // See MAX_COUNTER policy note above: never silently wrap the shared public counter.
        if (counter >= MAX_COUNTER)
            throw new Error('arx: counter overflow');
        const take = Math.min(BLOCK_LEN$1, len - pos);
        // aligned to 4 bytes
        if (isAligned && take === BLOCK_LEN$1) {
            const pos32 = pos / 4;
            if (pos % 4 !== 0)
                throw new Error('arx: invalid block position');
            for (let j = 0, posj; j < BLOCK_LEN32; j++) {
                posj = pos32 + j;
                o32[posj] = d32[posj] ^ b32[j];
            }
            pos += BLOCK_LEN$1;
            continue;
        }
        for (let j = 0, posj; j < take; j++) {
            posj = pos + j;
            output[posj] = data[posj] ^ block[j];
        }
        pos += take;
    }
}
/**
 * Creates an ARX stream cipher from a 32-bit core permutation.
 * Used internally to build the exported Salsa and ChaCha stream ciphers.
 * @param core - Core function that fills one keystream block.
 * @param opts - Cipher layout and nonce-extension options. See {@link CipherOpts}.
 * @returns Stream cipher function over byte arrays.
 * @throws If the core callback, key size, counter, or output sizing is invalid. {@link Error}
 */
function createCipher(core, opts) {
    const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts);
    if (typeof core !== 'function')
        throw new Error('core must be a function');
    anumber(counterLength);
    anumber(rounds);
    abool(counterRight);
    abool(allowShortKeys);
    return (key, nonce, data, output, counter = 0) => {
        abytes(key, undefined, 'key');
        abytes(nonce, undefined, 'nonce');
        abytes(data, undefined, 'data');
        const len = data.length;
        // Raw XorStream APIs return ciphertext/plaintext bytes directly, so caller-provided outputs
        // must match the logical result length exactly instead of returning an oversized workspace.
        output = getOutput(len, output, false);
        anumber(counter);
        // See MAX_COUNTER policy note above: reject advanced explicit-counter requests before any wrap.
        if (counter < 0 || counter >= MAX_COUNTER)
            throw new Error('arx: counter overflow');
        const toClean = [];
        // Key & sigma
        // key=16 -> sigma16, k=key|key
        // key=32 -> sigma32, k=key
        let l = key.length;
        let k;
        let sigma;
        if (l === 32) {
            // Copy caller keys too: big-endian normalization, extended-nonce subkey derivation, and
            // final clean(...) all mutate or wipe the temporary buffer in place.
            toClean.push((k = copyBytes(key)));
            sigma = sigma32_32;
        }
        else if (l === 16 && allowShortKeys) {
            k = new Uint8Array(32);
            k.set(key);
            k.set(key, 16);
            sigma = sigma16_32;
            toClean.push(k);
        }
        else {
            abytes(key, 32, 'arx key');
            throw new Error('invalid key size');
            // throw new Error(`"arx key" expected Uint8Array of length 32, got length=${l}`);
        }
        // Nonce
        // salsa20:      8   (8-byte counter)
        // chacha20orig: 8   (8-byte counter)
        // chacha20:     12  (4-byte counter)
        // xsalsa20:     24  (16 -> hsalsa,  8 -> old nonce)
        // xchacha20:    24  (16 -> hchacha, 8 -> old nonce)
        // Copy before taking u32(...) views on misaligned inputs, and on big-endian so later
        // swap32IfBE(...) never mutates caller nonce bytes in place.
        if (!isLE || !isAligned32(nonce))
            toClean.push((nonce = copyBytes(nonce)));
        let k32 = u32(k);
        // hsalsa & hchacha: handle extended nonce
        if (extendNonceFn) {
            if (nonce.length !== 24)
                throw new Error(`arx: extended nonce must be 24 bytes`);
            const n16 = nonce.subarray(0, 16);
            if (isLE)
                extendNonceFn(sigma, k32, u32(n16), k32);
            else {
                const sigmaRaw = swap32IfBE(Uint32Array.from(sigma));
                extendNonceFn(sigmaRaw, k32, u32(n16), k32);
                clean(sigmaRaw);
                swap32IfBE(k32);
            }
            nonce = nonce.subarray(16);
        }
        else if (!isLE)
            swap32IfBE(k32);
        // Handle nonce counter
        const nonceNcLen = 16 - counterLength;
        if (nonceNcLen !== nonce.length)
            throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
        // Normalize 64-bit-nonce layouts to the 12-byte core input: ChaCha/XChaCha prefix 4 zero
        // counter bytes, while Salsa/XSalsa append them after the nonce words.
        if (nonceNcLen !== 12) {
            const nc = new Uint8Array(12);
            nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
            nonce = nc;
            toClean.push(nonce);
        }
        const n32 = swap32IfBE(u32(nonce));
        // Ensure temporary key/nonce copies are wiped even if the remaining
        // runtime guard in runCipher(...) throws on counter overflow.
        try {
            runCipher(core, sigma, k32, n32, data, output, counter, rounds);
            return output;
        }
        finally {
            clean(...toClean);
        }
    };
}

/**
 * Poly1305 ({@link https://cr.yp.to/mac/poly1305-20050329.pdf | PDF},
 * {@link https://en.wikipedia.org/wiki/Poly1305 | wiki})
 * is a fast and parallel secret-key message-authentication code suitable for
 * a wide variety of applications. It was standardized in
 * {@link https://www.rfc-editor.org/rfc/rfc8439 | RFC 8439} and is now used in TLS 1.3.
 *
 * Polynomial MACs are not perfect for every situation:
 * they lack Random Key Robustness: the MAC can be forged, and can't be used in PAKE schemes.
 * See {@link https://keymaterial.net/2020/09/07/invisible-salamanders-in-aes-gcm-siv/ | the invisible salamanders attack writeup}.
 * To combat invisible salamanders, `hash(key)` can be included in ciphertext,
 * however, this would violate ciphertext indistinguishability:
 * an attacker would know which key was used - so `HKDF(key, i)`
 * could be used instead.
 *
 * Check out the {@link https://cr.yp.to/mac.html | original website}.
 * Based on public-domain {@link https://github.com/floodyberry/poly1305-donna | poly1305-donna}.
 * @module
 */
// prettier-ignore
// Little-endian 2-byte load used by the Poly1305 limb decomposition.
function u8to16(a, i) {
    return (a[i++] & 0xff) | ((a[i++] & 0xff) << 8);
}
/**
 * Incremental Poly1305 MAC state.
 * Prefer `poly1305()` for one-shot use.
 * @param key - 32-byte Poly1305 one-time key.
 * @example
 * Feeds one chunk into an incremental Poly1305 state with a fresh one-time key.
 *
 * ```ts
 * import { Poly1305 } from '@noble/ciphers/_poly1305.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const mac = new Poly1305(key);
 * mac.update(new Uint8Array([1, 2, 3]));
 * mac.digest();
 * ```
 */
class Poly1305 {
    blockLen = 16;
    outputLen = 16;
    buffer = new Uint8Array(16);
    r = new Uint16Array(10); // Allocating 1 array with .subarray() here is slower than 3
    h = new Uint16Array(10);
    pad = new Uint16Array(8);
    pos = 0;
    finished = false;
    destroyed = false;
    // Can be speed-up using BigUint64Array, at the cost of complexity
    constructor(key) {
        key = copyBytes(abytes(key, 32, 'key'));
        const t0 = u8to16(key, 0);
        const t1 = u8to16(key, 2);
        const t2 = u8to16(key, 4);
        const t3 = u8to16(key, 6);
        const t4 = u8to16(key, 8);
        const t5 = u8to16(key, 10);
        const t6 = u8to16(key, 12);
        const t7 = u8to16(key, 14);
        // RFC 8439 §2.5.1 / RFC 7539 §2.5.1 clamp r before multiplication.
        // These masks unpack that clamped value into 13-bit limbs, while pad
        // keeps the raw s half for finalize().
        // {@link https://github.com/floodyberry/poly1305-donna/blob/e6ad6e091d30d7f4ec2d4f978be1fcfcbce72781/poly1305-donna-16.h#L47 | poly1305-donna reference}
        this.r[0] = t0 & 0x1fff;
        this.r[1] = ((t0 >>> 13) | (t1 << 3)) & 0x1fff;
        this.r[2] = ((t1 >>> 10) | (t2 << 6)) & 0x1f03;
        this.r[3] = ((t2 >>> 7) | (t3 << 9)) & 0x1fff;
        this.r[4] = ((t3 >>> 4) | (t4 << 12)) & 0x00ff;
        this.r[5] = (t4 >>> 1) & 0x1ffe;
        this.r[6] = ((t4 >>> 14) | (t5 << 2)) & 0x1fff;
        this.r[7] = ((t5 >>> 11) | (t6 << 5)) & 0x1f81;
        this.r[8] = ((t6 >>> 8) | (t7 << 8)) & 0x1fff;
        this.r[9] = (t7 >>> 5) & 0x007f;
        for (let i = 0; i < 8; i++)
            this.pad[i] = u8to16(key, 16 + 2 * i);
    }
    process(data, offset, isLast = false) {
        // RFC 8439 §2.5 / §2.5.1 and RFC 7539 §2.5 / §2.5.1 add an extra high
        // bit to every full 16-byte block. The final partial block gets its
        // explicit `1` byte during digestInto(), so `hibit` stays zero there.
        const hibit = isLast ? 0 : 1 << 11;
        const { h, r } = this;
        const r0 = r[0];
        const r1 = r[1];
        const r2 = r[2];
        const r3 = r[3];
        const r4 = r[4];
        const r5 = r[5];
        const r6 = r[6];
        const r7 = r[7];
        const r8 = r[8];
        const r9 = r[9];
        const t0 = u8to16(data, offset + 0);
        const t1 = u8to16(data, offset + 2);
        const t2 = u8to16(data, offset + 4);
        const t3 = u8to16(data, offset + 6);
        const t4 = u8to16(data, offset + 8);
        const t5 = u8to16(data, offset + 10);
        const t6 = u8to16(data, offset + 12);
        const t7 = u8to16(data, offset + 14);
        let h0 = h[0] + (t0 & 0x1fff);
        let h1 = h[1] + (((t0 >>> 13) | (t1 << 3)) & 0x1fff);
        let h2 = h[2] + (((t1 >>> 10) | (t2 << 6)) & 0x1fff);
        let h3 = h[3] + (((t2 >>> 7) | (t3 << 9)) & 0x1fff);
        let h4 = h[4] + (((t3 >>> 4) | (t4 << 12)) & 0x1fff);
        let h5 = h[5] + ((t4 >>> 1) & 0x1fff);
        let h6 = h[6] + (((t4 >>> 14) | (t5 << 2)) & 0x1fff);
        let h7 = h[7] + (((t5 >>> 11) | (t6 << 5)) & 0x1fff);
        let h8 = h[8] + (((t6 >>> 8) | (t7 << 8)) & 0x1fff);
        let h9 = h[9] + ((t7 >>> 5) | hibit);
        let c = 0;
        let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
        c = d0 >>> 13;
        d0 &= 0x1fff;
        d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
        c += d0 >>> 13;
        d0 &= 0x1fff;
        let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
        c = d1 >>> 13;
        d1 &= 0x1fff;
        d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
        c += d1 >>> 13;
        d1 &= 0x1fff;
        let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
        c = d2 >>> 13;
        d2 &= 0x1fff;
        d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
        c += d2 >>> 13;
        d2 &= 0x1fff;
        let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
        c = d3 >>> 13;
        d3 &= 0x1fff;
        d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
        c += d3 >>> 13;
        d3 &= 0x1fff;
        let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
        c = d4 >>> 13;
        d4 &= 0x1fff;
        d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
        c += d4 >>> 13;
        d4 &= 0x1fff;
        let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
        c = d5 >>> 13;
        d5 &= 0x1fff;
        d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
        c += d5 >>> 13;
        d5 &= 0x1fff;
        let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
        c = d6 >>> 13;
        d6 &= 0x1fff;
        d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
        c += d6 >>> 13;
        d6 &= 0x1fff;
        let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
        c = d7 >>> 13;
        d7 &= 0x1fff;
        d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
        c += d7 >>> 13;
        d7 &= 0x1fff;
        let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
        c = d8 >>> 13;
        d8 &= 0x1fff;
        d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
        c += d8 >>> 13;
        d8 &= 0x1fff;
        let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
        c = d9 >>> 13;
        d9 &= 0x1fff;
        d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
        c += d9 >>> 13;
        d9 &= 0x1fff;
        c = ((c << 2) + c) | 0;
        c = (c + d0) | 0;
        d0 = c & 0x1fff;
        c = c >>> 13;
        d1 += c;
        h[0] = d0;
        h[1] = d1;
        h[2] = d2;
        h[3] = d3;
        h[4] = d4;
        h[5] = d5;
        h[6] = d6;
        h[7] = d7;
        h[8] = d8;
        h[9] = d9;
    }
    finalize() {
        const { h, pad } = this;
        const g = new Uint16Array(10);
        let c = h[1] >>> 13;
        h[1] &= 0x1fff;
        for (let i = 2; i < 10; i++) {
            h[i] += c;
            c = h[i] >>> 13;
            h[i] &= 0x1fff;
        }
        h[0] += c * 5;
        c = h[0] >>> 13;
        h[0] &= 0x1fff;
        h[1] += c;
        c = h[1] >>> 13;
        h[1] &= 0x1fff;
        h[2] += c;
        // RFC 8439 §2.5 / RFC 7539 §2.5 reduce modulo 2^130-5 before repacking
        // to 16-bit words and adding the raw s half.
        g[0] = h[0] + 5;
        c = g[0] >>> 13;
        g[0] &= 0x1fff;
        for (let i = 1; i < 10; i++) {
            g[i] = h[i] + c;
            c = g[i] >>> 13;
            g[i] &= 0x1fff;
        }
        g[9] -= 1 << 13;
        let mask = (c ^ 1) - 1;
        for (let i = 0; i < 10; i++)
            g[i] &= mask;
        mask = ~mask;
        for (let i = 0; i < 10; i++)
            h[i] = (h[i] & mask) | g[i];
        h[0] = (h[0] | (h[1] << 13)) & 0xffff;
        h[1] = ((h[1] >>> 3) | (h[2] << 10)) & 0xffff;
        h[2] = ((h[2] >>> 6) | (h[3] << 7)) & 0xffff;
        h[3] = ((h[3] >>> 9) | (h[4] << 4)) & 0xffff;
        h[4] = ((h[4] >>> 12) | (h[5] << 1) | (h[6] << 14)) & 0xffff;
        h[5] = ((h[6] >>> 2) | (h[7] << 11)) & 0xffff;
        h[6] = ((h[7] >>> 5) | (h[8] << 8)) & 0xffff;
        h[7] = ((h[8] >>> 8) | (h[9] << 5)) & 0xffff;
        let f = h[0] + pad[0];
        h[0] = f & 0xffff;
        for (let i = 1; i < 8; i++) {
            f = (((h[i] + pad[i]) | 0) + (f >>> 16)) | 0;
            h[i] = f & 0xffff;
        }
        clean(g);
    }
    update(data) {
        aexists(this);
        abytes(data);
        data = copyBytes(data);
        const { buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            // Fast path: we have at least one block in input
            if (take === blockLen) {
                for (; blockLen <= len - pos; pos += blockLen)
                    this.process(data, pos);
                continue;
            }
            buffer.set(data.subarray(pos, pos + take), this.pos);
            this.pos += take;
            pos += take;
            if (this.pos === blockLen) {
                this.process(buffer, 0, false);
                this.pos = 0;
            }
        }
        return this;
    }
    destroy() {
        // `aexists(this)` guards update/digest paths, so destroy must mark the instance unusable too.
        this.destroyed = true;
        clean(this.h, this.r, this.buffer, this.pad);
    }
    digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        const { buffer, h } = this;
        let { pos } = this;
        if (pos) {
            // RFC 8439 §2.5 / RFC 7539 §2.5: the final short block appends a
            // single `0x01` byte and zero-fills the remaining bytes before the
            // last multiplication step.
            buffer[pos++] = 1;
            for (; pos < 16; pos++)
                buffer[pos] = 0;
            this.process(buffer, 0, true);
        }
        this.finalize();
        let opos = 0;
        for (let i = 0; i < 8; i++) {
            out[opos++] = h[i] >>> 0;
            out[opos++] = h[i] >>> 8;
        }
    }
    digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        // Copy out before destroy() zeroes the internal buffer.
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
    }
}
/**
 * Poly1305 MAC from RFC 8439.
 * @param msg - Message bytes to authenticate.
 * @param key - 32-byte Poly1305 one-time key.
 * @returns 16-byte authentication tag.
 * @example
 * Authenticates one message with a one-shot Poly1305 call and a fresh key.
 *
 * ```ts
 * import { poly1305 } from '@noble/ciphers/_poly1305.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * poly1305(new Uint8Array(), key);
 * ```
 */
const poly1305 = /* @__PURE__ */ wrapMacConstructor(32, (key) => new Poly1305(key));

/**
 * ChaCha stream cipher, released
 * in 2008. Developed after Salsa20, ChaCha aims to increase diffusion per round.
 * It was standardized in
 * {@link https://www.rfc-editor.org/rfc/rfc8439 | RFC 8439} and
 * is now used in TLS 1.3.
 *
 * {@link https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha | XChaCha20}
 * extended-nonce variant is also provided. Similar to XSalsa, it's safe to use with
 * randomly-generated nonces.
 *
 * Check out
 * {@link http://cr.yp.to/chacha/chacha-20080128.pdf | PDF},
 * {@link https://en.wikipedia.org/wiki/Salsa20 | wiki}, and
 * {@link https://cr.yp.to/chacha.html | website}.
 *
 * @module
 */
/** RFC 8439 §2.3 block core for `state = constants | key | counter | nonce`. */
// prettier-ignore
function chachaCore(s, k, n, out, cnt, rounds = 20) {
    let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], // "expa"   "nd 3"  "2-by"  "te k"
    y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], // Key      Key     Key     Key
    y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], // Key      Key     Key     Key
    y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2]; // Counter  Nonce   Nonce   Nonce
    // Save state to temporary variables
    let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
    for (let r = 0; r < rounds; r += 2) {
        x00 = (x00 + x04) | 0;
        x12 = rotl(x12 ^ x00, 16);
        x08 = (x08 + x12) | 0;
        x04 = rotl(x04 ^ x08, 12);
        x00 = (x00 + x04) | 0;
        x12 = rotl(x12 ^ x00, 8);
        x08 = (x08 + x12) | 0;
        x04 = rotl(x04 ^ x08, 7);
        x01 = (x01 + x05) | 0;
        x13 = rotl(x13 ^ x01, 16);
        x09 = (x09 + x13) | 0;
        x05 = rotl(x05 ^ x09, 12);
        x01 = (x01 + x05) | 0;
        x13 = rotl(x13 ^ x01, 8);
        x09 = (x09 + x13) | 0;
        x05 = rotl(x05 ^ x09, 7);
        x02 = (x02 + x06) | 0;
        x14 = rotl(x14 ^ x02, 16);
        x10 = (x10 + x14) | 0;
        x06 = rotl(x06 ^ x10, 12);
        x02 = (x02 + x06) | 0;
        x14 = rotl(x14 ^ x02, 8);
        x10 = (x10 + x14) | 0;
        x06 = rotl(x06 ^ x10, 7);
        x03 = (x03 + x07) | 0;
        x15 = rotl(x15 ^ x03, 16);
        x11 = (x11 + x15) | 0;
        x07 = rotl(x07 ^ x11, 12);
        x03 = (x03 + x07) | 0;
        x15 = rotl(x15 ^ x03, 8);
        x11 = (x11 + x15) | 0;
        x07 = rotl(x07 ^ x11, 7);
        x00 = (x00 + x05) | 0;
        x15 = rotl(x15 ^ x00, 16);
        x10 = (x10 + x15) | 0;
        x05 = rotl(x05 ^ x10, 12);
        x00 = (x00 + x05) | 0;
        x15 = rotl(x15 ^ x00, 8);
        x10 = (x10 + x15) | 0;
        x05 = rotl(x05 ^ x10, 7);
        x01 = (x01 + x06) | 0;
        x12 = rotl(x12 ^ x01, 16);
        x11 = (x11 + x12) | 0;
        x06 = rotl(x06 ^ x11, 12);
        x01 = (x01 + x06) | 0;
        x12 = rotl(x12 ^ x01, 8);
        x11 = (x11 + x12) | 0;
        x06 = rotl(x06 ^ x11, 7);
        x02 = (x02 + x07) | 0;
        x13 = rotl(x13 ^ x02, 16);
        x08 = (x08 + x13) | 0;
        x07 = rotl(x07 ^ x08, 12);
        x02 = (x02 + x07) | 0;
        x13 = rotl(x13 ^ x02, 8);
        x08 = (x08 + x13) | 0;
        x07 = rotl(x07 ^ x08, 7);
        x03 = (x03 + x04) | 0;
        x14 = rotl(x14 ^ x03, 16);
        x09 = (x09 + x14) | 0;
        x04 = rotl(x04 ^ x09, 12);
        x03 = (x03 + x04) | 0;
        x14 = rotl(x14 ^ x03, 8);
        x09 = (x09 + x14) | 0;
        x04 = rotl(x04 ^ x09, 7);
    }
    // RFC 8439 §2.3 / §2.3.1: add the original state words back in state order.
    let oi = 0;
    out[oi++] = (y00 + x00) | 0;
    out[oi++] = (y01 + x01) | 0;
    out[oi++] = (y02 + x02) | 0;
    out[oi++] = (y03 + x03) | 0;
    out[oi++] = (y04 + x04) | 0;
    out[oi++] = (y05 + x05) | 0;
    out[oi++] = (y06 + x06) | 0;
    out[oi++] = (y07 + x07) | 0;
    out[oi++] = (y08 + x08) | 0;
    out[oi++] = (y09 + x09) | 0;
    out[oi++] = (y10 + x10) | 0;
    out[oi++] = (y11 + x11) | 0;
    out[oi++] = (y12 + x12) | 0;
    out[oi++] = (y13 + x13) | 0;
    out[oi++] = (y14 + x14) | 0;
    out[oi++] = (y15 + x15) | 0;
}
/**
 * hchacha hashes key and nonce into key' and nonce' for xchacha20.
 * Algorithmically identical to `hchacha_small`, but this exported path
 * normalizes word order on big-endian hosts.
 * Need to find a way to merge it with `chachaCore` without 25% performance hit.
 * @param s - Sigma constants as 32-bit words.
 * @param k - Key words.
 * @param i - Nonce-prefix words.
 * @param out - Output buffer for the derived subkey.
 * @example
 * Derives the XChaCha subkey from sigma, key, and nonce-prefix words.
 *
 * ```ts
 * const sigma = new Uint32Array(4);
 * const key = new Uint32Array(8);
 * const nonce = new Uint32Array(4);
 * const out = new Uint32Array(8);
 * hchacha(sigma, key, nonce, out);
 * ```
 */
// prettier-ignore
function hchacha(s, k, i, out) {
    let x00 = swap8IfBE(s[0]), x01 = swap8IfBE(s[1]), x02 = swap8IfBE(s[2]), x03 = swap8IfBE(s[3]), x04 = swap8IfBE(k[0]), x05 = swap8IfBE(k[1]), x06 = swap8IfBE(k[2]), x07 = swap8IfBE(k[3]), x08 = swap8IfBE(k[4]), x09 = swap8IfBE(k[5]), x10 = swap8IfBE(k[6]), x11 = swap8IfBE(k[7]), x12 = swap8IfBE(i[0]), x13 = swap8IfBE(i[1]), x14 = swap8IfBE(i[2]), x15 = swap8IfBE(i[3]);
    for (let r = 0; r < 20; r += 2) {
        x00 = (x00 + x04) | 0;
        x12 = rotl(x12 ^ x00, 16);
        x08 = (x08 + x12) | 0;
        x04 = rotl(x04 ^ x08, 12);
        x00 = (x00 + x04) | 0;
        x12 = rotl(x12 ^ x00, 8);
        x08 = (x08 + x12) | 0;
        x04 = rotl(x04 ^ x08, 7);
        x01 = (x01 + x05) | 0;
        x13 = rotl(x13 ^ x01, 16);
        x09 = (x09 + x13) | 0;
        x05 = rotl(x05 ^ x09, 12);
        x01 = (x01 + x05) | 0;
        x13 = rotl(x13 ^ x01, 8);
        x09 = (x09 + x13) | 0;
        x05 = rotl(x05 ^ x09, 7);
        x02 = (x02 + x06) | 0;
        x14 = rotl(x14 ^ x02, 16);
        x10 = (x10 + x14) | 0;
        x06 = rotl(x06 ^ x10, 12);
        x02 = (x02 + x06) | 0;
        x14 = rotl(x14 ^ x02, 8);
        x10 = (x10 + x14) | 0;
        x06 = rotl(x06 ^ x10, 7);
        x03 = (x03 + x07) | 0;
        x15 = rotl(x15 ^ x03, 16);
        x11 = (x11 + x15) | 0;
        x07 = rotl(x07 ^ x11, 12);
        x03 = (x03 + x07) | 0;
        x15 = rotl(x15 ^ x03, 8);
        x11 = (x11 + x15) | 0;
        x07 = rotl(x07 ^ x11, 7);
        x00 = (x00 + x05) | 0;
        x15 = rotl(x15 ^ x00, 16);
        x10 = (x10 + x15) | 0;
        x05 = rotl(x05 ^ x10, 12);
        x00 = (x00 + x05) | 0;
        x15 = rotl(x15 ^ x00, 8);
        x10 = (x10 + x15) | 0;
        x05 = rotl(x05 ^ x10, 7);
        x01 = (x01 + x06) | 0;
        x12 = rotl(x12 ^ x01, 16);
        x11 = (x11 + x12) | 0;
        x06 = rotl(x06 ^ x11, 12);
        x01 = (x01 + x06) | 0;
        x12 = rotl(x12 ^ x01, 8);
        x11 = (x11 + x12) | 0;
        x06 = rotl(x06 ^ x11, 7);
        x02 = (x02 + x07) | 0;
        x13 = rotl(x13 ^ x02, 16);
        x08 = (x08 + x13) | 0;
        x07 = rotl(x07 ^ x08, 12);
        x02 = (x02 + x07) | 0;
        x13 = rotl(x13 ^ x02, 8);
        x08 = (x08 + x13) | 0;
        x07 = rotl(x07 ^ x08, 7);
        x03 = (x03 + x04) | 0;
        x14 = rotl(x14 ^ x03, 16);
        x09 = (x09 + x14) | 0;
        x04 = rotl(x04 ^ x09, 12);
        x03 = (x03 + x04) | 0;
        x14 = rotl(x14 ^ x03, 8);
        x09 = (x09 + x14) | 0;
        x04 = rotl(x04 ^ x09, 7);
    }
    // HChaCha derives the subkey from state words 0..3 and 12..15 after 20 rounds.
    let oi = 0;
    out[oi++] = x00;
    out[oi++] = x01;
    out[oi++] = x02;
    out[oi++] = x03;
    out[oi++] = x12;
    out[oi++] = x13;
    out[oi++] = x14;
    out[oi++] = x15;
    swap32IfBE(out);
}
/**
 * Original, non-RFC chacha20 from DJB. 8-byte nonce, 8-byte counter.
 * The nonce/counter layout still reserves 8 counter bytes internally, but the shared public
 * `counter` argument follows noble's strict non-wrapping 32-bit policy. See `src/_arx.ts`
 * near `MAX_COUNTER` for the full counter-policy rationale.
 * @param key - 16-byte or 32-byte key.
 * @param nonce - 8-byte nonce.
 * @param data - Input bytes to xor with the keystream.
 * @param output - Optional destination buffer.
 * @param counter - Initial block counter.
 * @returns Encrypted or decrypted bytes.
 * @example
 * Encrypts bytes with the original 8-byte-nonce ChaCha variant and a fresh key/nonce.
 *
 * ```ts
 * import { chacha20orig } from '@noble/ciphers/chacha.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(8);
 * chacha20orig(key, nonce, new Uint8Array(4));
 * ```
 */
const chacha20orig = /* @__PURE__ */ createCipher(chachaCore, {
    counterRight: false,
    counterLength: 8,
    allowShortKeys: true,
});
/**
 * ChaCha stream cipher. Conforms to RFC 8439 (IETF, TLS). 12-byte nonce, 4-byte counter.
 * With smaller nonce, it's not safe to make it random (CSPRNG), due to collision chance.
 * @param key - 32-byte key.
 * @param nonce - 12-byte nonce.
 * @param data - Input bytes to xor with the keystream.
 * @param output - Optional destination buffer.
 * @param counter - Initial block counter.
 * @returns Encrypted or decrypted bytes.
 * @example
 * Encrypts bytes with the RFC 8439 ChaCha20 stream cipher and a fresh key/nonce.
 *
 * ```ts
 * import { chacha20 } from '@noble/ciphers/chacha.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(12);
 * chacha20(key, nonce, new Uint8Array(4));
 * ```
 */
const chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
    counterRight: false,
    counterLength: 4,
    allowShortKeys: false,
});
/**
 * XChaCha eXtended-nonce ChaCha. With 24-byte nonce, it's safe to make it random (CSPRNG).
 * See {@link https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha | the IRTF draft}.
 * The nonce/counter layout still reserves 8 counter bytes internally, but the shared public
 * `counter` argument follows noble's strict non-wrapping 32-bit policy. See `src/_arx.ts`
 * near `MAX_COUNTER` for the full counter-policy rationale.
 * @param key - 32-byte key.
 * @param nonce - 24-byte extended nonce.
 * @param data - Input bytes to xor with the keystream.
 * @param output - Optional destination buffer.
 * @param counter - Initial block counter.
 * @returns Encrypted or decrypted bytes.
 * @example
 * Encrypts bytes with XChaCha20 using a fresh key and random 24-byte nonce.
 *
 * ```ts
 * import { xchacha20 } from '@noble/ciphers/chacha.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(24);
 * xchacha20(key, nonce, new Uint8Array(4));
 * ```
 */
const xchacha20 = /* @__PURE__ */ createCipher(chachaCore, {
    counterRight: false,
    counterLength: 8,
    extendNonceFn: hchacha,
    allowShortKeys: false,
});
/**
 * Reduced 8-round chacha, described in original paper.
 * @param key - 32-byte key.
 * @param nonce - 12-byte nonce.
 * @param data - Input bytes to xor with the keystream.
 * @param output - Optional destination buffer.
 * @param counter - Initial block counter.
 * @returns Encrypted or decrypted bytes.
 * @example
 * Uses the reduced 8-round variant for non-critical workloads with a fresh key/nonce.
 *
 * ```ts
 * import { chacha8 } from '@noble/ciphers/chacha.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(12);
 * chacha8(key, nonce, new Uint8Array(4));
 * ```
 */
const chacha8 = /* @__PURE__ */ createCipher(chachaCore, {
    counterRight: false,
    counterLength: 4,
    rounds: 8,
});
/**
 * Reduced 12-round chacha, described in original paper.
 * @param key - 32-byte key.
 * @param nonce - 12-byte nonce.
 * @param data - Input bytes to xor with the keystream.
 * @param output - Optional destination buffer.
 * @param counter - Initial block counter.
 * @returns Encrypted or decrypted bytes.
 * @example
 * Uses the reduced 12-round variant for non-critical workloads with a fresh key/nonce.
 *
 * ```ts
 * import { chacha12 } from '@noble/ciphers/chacha.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(12);
 * chacha12(key, nonce, new Uint8Array(4));
 * ```
 */
const chacha12 = /* @__PURE__ */ createCipher(chachaCore, {
    counterRight: false,
    counterLength: 4,
    rounds: 12,
});
// RFC 8439 §2.8.1 pad16(x): shared zero block for AAD/ciphertext padding.
const ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
// RFC 8439 §2.8 / §2.8.1: aligned inputs add nothing, otherwise append 16-(len%16) zero bytes.
const updatePadded = (h, msg) => {
    h.update(msg);
    const leftover = msg.length % 16;
    if (leftover)
        h.update(ZEROS16.subarray(leftover));
};
// RFC 8439 §2.6.1 poly1305_key_gen returns `block[0..31]`, so AEAD key
// generation only needs 32 zero bytes.
const ZEROS32 = /* @__PURE__ */ new Uint8Array(32);
function computeTag(fn, key, nonce, ciphertext, AAD) {
    if (AAD !== undefined)
        abytes(AAD, undefined, 'AAD');
    // RFC 8439 §2.6 / §2.8: derive the Poly1305 one-time key from counter 0,
    // then MAC AAD || pad16(AAD) || ciphertext || pad16(ciphertext) || len(AAD) || len(ciphertext).
    const authKey = fn(key, nonce, ZEROS32);
    const lengths = u64Lengths(ciphertext.length, AAD ? AAD.length : 0, true);
    // Methods below can be replaced with
    // return poly1305_computeTag_small(authKey, lengths, ciphertext, AAD)
    const h = poly1305.create(authKey);
    if (AAD)
        updatePadded(h, AAD);
    updatePadded(h, ciphertext);
    h.update(lengths);
    const res = h.digest();
    clean(authKey, lengths);
    return res;
}
/**
 * AEAD algorithm from RFC 8439.
 * Salsa20 and chacha (RFC 8439) use poly1305 differently.
 * We could have composed them, but it's hard because of authKey:
 * In salsa20, authKey changes position in salsa stream.
 * In chacha, authKey can't be computed inside computeTag, it modifies the counter.
 */
const _poly1305_aead = (xorStream) => (key, nonce, AAD) => {
    // This borrows caller key/nonce/AAD buffers by reference; mutating them after construction
    // changes future encrypt/decrypt results.
    const tagLength = 16;
    return {
        encrypt(plaintext, output) {
            const plength = plaintext.length;
            output = getOutput(plength + tagLength, output, false);
            output.set(plaintext);
            const oPlain = output.subarray(0, -tagLength);
            // RFC 8439 §2.8: payload encryption starts at counter 1 because counter 0 produced the OTK.
            xorStream(key, nonce, oPlain, oPlain, 1);
            const tag = computeTag(xorStream, key, nonce, oPlain, AAD);
            output.set(tag, plength); // append tag
            clean(tag);
            return output;
        },
        decrypt(ciphertext, output) {
            output = getOutput(ciphertext.length - tagLength, output, false);
            const data = ciphertext.subarray(0, -tagLength);
            const passedTag = ciphertext.subarray(-tagLength);
            const tag = computeTag(xorStream, key, nonce, data, AAD);
            // RFC 8439 §2.8 / §4: authenticate ciphertext before decrypting it, and compare tags with
            // the constant-time equalBytes() helper rather than decrypting speculative plaintext first.
            if (!equalBytes(passedTag, tag)) {
                clean(tag);
                throw new Error('invalid tag');
            }
            output.set(ciphertext.subarray(0, -tagLength));
            // Actual decryption
            xorStream(key, nonce, output, output, 1); // start stream with i=1
            clean(tag);
            return output;
        },
    };
};
/**
 * ChaCha20-Poly1305 from RFC 8439.
 *
 * Unsafe to use random nonces under the same key, due to collision chance.
 * Prefer XChaCha instead.
 * @param key - 32-byte key.
 * @param nonce - 12-byte nonce.
 * @param AAD - Additional authenticated data.
 * @returns AEAD cipher instance.
 * @example
 * Encrypts and authenticates plaintext with a fresh key and nonce.
 *
 * ```ts
 * import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(12);
 * const cipher = chacha20poly1305(key, nonce);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const chacha20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 12, tagLength: 16 }, 
/* @__PURE__ */ _poly1305_aead(chacha20));
/**
 * XChaCha20-Poly1305 extended-nonce chacha.
 *
 * Can be safely used with random nonces (CSPRNG).
 * See {@link https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha | the IRTF draft}.
 * @param key - 32-byte key.
 * @param nonce - 24-byte nonce.
 * @param AAD - Additional authenticated data.
 * @returns AEAD cipher instance.
 * @example
 * Encrypts and authenticates plaintext with a fresh key and random 24-byte nonce.
 *
 * ```ts
 * import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(24);
 * const cipher = xchacha20poly1305(key, nonce);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const xchacha20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 24, tagLength: 16 }, 
/* @__PURE__ */ _poly1305_aead(xchacha20));

/**
 * FPE-FF1 (Format-preserving encryption algorithm) specified in
 * {@link https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf | NIST 800-38G}.
 * @module
 */
// NIST SP 800-38G §4.3 / §5.1 Algorithm 7: FF1's designated CIPH_K here is AES, so this file
// reuses the reviewed AES key schedule and single-block encryption helpers.
// NOTE: no point in inlining encrypt instead of encryptBlock, since BigInt stuff will be slow
const { expandKeyLE, encryptBlock } = unsafe;
// Format-preserving encryption algorithm (FPE-FF1) specified in
// {@link https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf | NIST Special Publication 800-38G}.
const BLOCK_LEN = 16;
function mod(a, b) {
    const result = a % b;
    return result >= 0 ? result : b + result;
}
function NUMradix(radix, data) {
    let res = BigInt(0);
    for (let i of data)
        res = res * BigInt(radix) + BigInt(i);
    return res;
}
function getRound(radix, key, tweak, x) {
    if (radix > 2 ** 16 - 1)
        throw new Error('invalid radix ' + radix);
    // radix**minlen ≥ 100
    const minLen = Math.ceil(Math.log(100) / Math.log(radix));
    const maxLen = 2 ** 32 - 1;
    // 2 ≤ minlen ≤ maxlen < 2**32
    if (2 > minLen || minLen > maxLen || maxLen >= 2 ** 32)
        throw new Error('Invalid radix: 2 ≤ minlen ≤ maxlen < 2**32');
    if (!Array.isArray(x))
        throw new Error('invalid X');
    if (x.length < minLen || x.length > maxLen)
        throw new Error('X is outside minLen..maxLen bounds');
    // SP 800-38G defines FF1 over numeral strings in base `radix`; out-of-range digits must fail
    // before NUMradix(...) or round splitting can reinterpret them as a different numeral string.
    for (const i of x) {
        if (!Number.isSafeInteger(i) || i < 0 || i >= radix)
            throw new Error('invalid X: digit outside radix');
    }
    const u = Math.floor(x.length / 2);
    const v = x.length - u;
    const b = Math.ceil(Math.ceil(v * Math.log2(radix)) / 8);
    const d = 4 * Math.ceil(b / 4) + 4;
    const padding = mod(-tweak.length - b - 1, 16);
    // P = [1]1 || [2]1 || [1]1 || [radix]3 || [10]1 || [u mod 256]1 || [n]4 || [t]4.
    const P = Uint8Array.from([1, 2, 1, 0, 0, 0, 10, u, 0, 0, 0, 0, 0, 0, 0, 0]);
    const view = new DataView(P.buffer);
    // NIST SP 800-38G §5.1 bounds radix <= 2^16, so the 24-bit [radix]3 field is encoded here as
    // 0x00 || uint16_be(radix).
    view.setUint16(4, radix, false);
    view.setUint32(8, x.length, false);
    view.setUint32(12, tweak.length, false);
    // Q = T || [0](−t−b−1) mod 16 || [i]1 || [NUMradix(B)]b.
    const PQ = new Uint8Array(P.length + tweak.length + padding + 1 + b);
    PQ.set(P);
    clean(P);
    PQ.set(tweak, P.length);
    const xk = expandKeyLE(key);
    const round = (A, B, i, decrypt = false) => {
        // Q = ... || [i]1 || [NUMradix(B)]b.
        PQ[PQ.length - b - 1] = i;
        if (b)
            PQ.set(numberToBytesBE(NUMradix(radix, B), b), PQ.length - b);
        // NIST SP 800-38G Algorithm 6 PRF: Y_j = CIPH_K(Y_(j-1) xor X_j) starting from Y_0 = 0^128.
        let r = new Uint8Array(16);
        for (let j = 0; j < PQ.length / BLOCK_LEN; j++) {
            for (let i = 0; i < BLOCK_LEN; i++)
                r[i] ^= PQ[j * BLOCK_LEN + i];
            encryptBlock(xk, r);
        }
        // Let S be the first d bytes of the following string of ⎡d/16⎤ blocks:
        // R || CIPHK(R ⊕[1]16) || CIPHK(R ⊕[2]16) ...CIPHK(R ⊕[⎡d / 16⎤ – 1]16).
        let s = Array.from(r);
        for (let j = 1; s.length < d; j++) {
            const block = numberToBytesBE(BigInt(j), 16);
            for (let k = 0; k < BLOCK_LEN; k++)
                block[k] ^= r[k];
            s.push(...Array.from(encryptBlock(xk, block)));
        }
        let y = bytesToNumberBE(Uint8Array.from(s.slice(0, d)));
        s.fill(0);
        if (decrypt)
            y = -y;
        const m = i % 2 === 0 ? u : v;
        let c = mod(NUMradix(radix, A) + y, BigInt(radix) ** BigInt(m));
        // STR(radix, m, c)
        const C = Array(m).fill(0);
        for (let i = 0; i < m; i++, c /= BigInt(radix))
            C[m - 1 - i] = Number(c % BigInt(radix));
        A.fill(0);
        A = B;
        B = C;
        return [A, B];
    };
    const destroy = () => {
        clean(xk, PQ);
    };
    return { u, round, destroy };
}
const EMPTY_BUF = /* @__PURE__ */ Uint8Array.of();
/**
 * FPE-FF1 format-preserving encryption.
 * @param radix - Alphabet size for each input digit.
 * @param key - AES key bytes.
 * @param tweak - Optional tweak bytes.
 * @returns Encrypt/decrypt helpers over digit arrays.
 * @example
 * Encrypts decimal digits without changing their format, using a fresh AES key.
 *
 * ```ts
 * import { FF1 } from '@noble/ciphers/ff1.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const ff1 = FF1(10, key);
 * ff1.encrypt([1, 2, 3]);
 * ```
 */
function FF1(radix, key, tweak = EMPTY_BUF) {
    anumber(radix);
    abytes(key);
    abytes(tweak);
    // This borrows caller key/tweak buffers by reference through the bound closure; mutating them
    // after construction changes later encrypt/decrypt outputs.
    const PQ = getRound.bind(null, radix, key, tweak);
    return {
        encrypt(x) {
            const { u, round, destroy } = PQ(x);
            let [A, B] = [x.slice(0, u), x.slice(u)];
            for (let i = 0; i < 10; i++)
                [A, B] = round(A, B, i);
            destroy();
            const res = A.concat(B);
            A.fill(0);
            B.fill(0);
            return res;
        },
        decrypt(x) {
            const { u, round, destroy } = PQ(x);
            // The FF1.Decrypt algorithm is similar to the FF1.Encrypt algorithm;
            // the differences are in Step 6, where:
            // 1) the order of the indices is reversed,
            // 2) the roles of A and B are swapped
            // 3) modular addition is replaced by modular subtraction, in Step 6vi.
            let [B, A] = [x.slice(0, u), x.slice(u)];
            for (let i = 9; i >= 0; i--)
                [A, B] = round(A, B, i, true);
            destroy();
            const res = B.concat(A);
            A.fill(0);
            B.fill(0);
            return res;
        },
    };
}
// Binary wrapper uses little-endian bit order within each byte so bit 0 stays
// in the first numeral slot for this library-defined byte-array surface.
const binLE = {
    encode(bytes) {
        const x = [];
        for (let i = 0; i < bytes.length; i++) {
            for (let j = 0, tmp = bytes[i]; j < 8; j++, tmp >>= 1)
                x.push(tmp & 1);
        }
        return x;
    },
    decode(b) {
        if (!Array.isArray(b) || b.length % 8)
            throw new Error('Invalid binary string');
        const res = new Uint8Array(b.length / 8);
        for (let i = 0, j = 0; i < res.length; i++) {
            res[i] = b[j++] | (b[j++] << 1) | (b[j++] << 2) | (b[j++] << 3);
            res[i] |= (b[j++] << 4) | (b[j++] << 5) | (b[j++] << 6) | (b[j++] << 7);
        }
        return res;
    },
};
/**
 * Binary FPE-FF1 wrapper over byte arrays.
 * @param key - AES key bytes.
 * @param tweak - Optional tweak bytes.
 * @returns Encrypt/decrypt helpers over byte arrays.
 * @example
 * Encrypts raw bytes through FF1's binary alphabet wrapper with a fresh AES key.
 *
 * ```ts
 * import { BinaryFF1 } from '@noble/ciphers/ff1.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(16);
 * const ff1 = BinaryFF1(key);
 * ff1.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
function BinaryFF1(key, tweak = EMPTY_BUF) {
    const ff1 = FF1(2, key, tweak);
    return {
        encrypt: (x) => binLE.decode(ff1.encrypt(binLE.encode(x))),
        decrypt: (x) => binLE.decode(ff1.decrypt(binLE.encode(x))),
    };
}

/**
 * Salsa20 stream cipher, released in 2005.
 * Salsa's goal was to implement AES replacement that does not rely on S-Boxes,
 * which are hard to implement in a constant-time manner.
 * Salsa20 is usually faster than AES, a big deal on slow, budget mobile phones.
 *
 * - {@link https://cr.yp.to/snuffle/xsalsa-20110204.pdf | XSalsa20},
 *   extended-nonce
 *   variant was released in 2008. It extends Salsa20's 64-bit nonce to 192 bits,
 *   and became safe to be picked at random.
 * - Nacl / Libsodium popularized term "secretbox", - which is just xsalsa20poly1305.
 *   We provide the alias and corresponding seal / open methods.
 *   "crypto_box" and "sealedbox" are available in package
 *   {@link https://github.com/serenity-kit/noble-sodium | noble-sodium}.
 * - Check out
 *   {@link https://cr.yp.to/snuffle/salsafamily-20071225.pdf | PDF}
 *   and {@link https://cr.yp.to/snuffle.html | website}.
 * @module
 */
/** Identical to `salsaCore_small`. Uses only the low 32 bits of Salsa20's 64-bit counter state. */
// prettier-ignore
function salsaCore(s, k, n, out, cnt, rounds = 20) {
    // Public wrappers expose only the low 32 bits of Salsa20's 64-bit counter; y09 stays zero.
    // Based on {@link https://cr.yp.to/salsa20.html | the Salsa20 reference page}.
    let y00 = s[0], y01 = k[0], y02 = k[1], y03 = k[2], // "expa" Key     Key     Key
    y04 = k[3], y05 = s[1], y06 = n[0], y07 = n[1], // Key    "nd 3"  Nonce   Nonce
    y08 = cnt, y09 = 0, y10 = s[2], y11 = k[4], // Pos.   Pos.    "2-by"	Key
    y12 = k[5], y13 = k[6], y14 = k[7], y15 = s[3]; // Key    Key     Key     "te k"
    // Save state to temporary variables
    let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
    for (let r = 0; r < rounds; r += 2) {
        x04 ^= rotl(x00 + x12 | 0, 7);
        x08 ^= rotl(x04 + x00 | 0, 9);
        x12 ^= rotl(x08 + x04 | 0, 13);
        x00 ^= rotl(x12 + x08 | 0, 18);
        x09 ^= rotl(x05 + x01 | 0, 7);
        x13 ^= rotl(x09 + x05 | 0, 9);
        x01 ^= rotl(x13 + x09 | 0, 13);
        x05 ^= rotl(x01 + x13 | 0, 18);
        x14 ^= rotl(x10 + x06 | 0, 7);
        x02 ^= rotl(x14 + x10 | 0, 9);
        x06 ^= rotl(x02 + x14 | 0, 13);
        x10 ^= rotl(x06 + x02 | 0, 18);
        x03 ^= rotl(x15 + x11 | 0, 7);
        x07 ^= rotl(x03 + x15 | 0, 9);
        x11 ^= rotl(x07 + x03 | 0, 13);
        x15 ^= rotl(x11 + x07 | 0, 18);
        x01 ^= rotl(x00 + x03 | 0, 7);
        x02 ^= rotl(x01 + x00 | 0, 9);
        x03 ^= rotl(x02 + x01 | 0, 13);
        x00 ^= rotl(x03 + x02 | 0, 18);
        x06 ^= rotl(x05 + x04 | 0, 7);
        x07 ^= rotl(x06 + x05 | 0, 9);
        x04 ^= rotl(x07 + x06 | 0, 13);
        x05 ^= rotl(x04 + x07 | 0, 18);
        x11 ^= rotl(x10 + x09 | 0, 7);
        x08 ^= rotl(x11 + x10 | 0, 9);
        x09 ^= rotl(x08 + x11 | 0, 13);
        x10 ^= rotl(x09 + x08 | 0, 18);
        x12 ^= rotl(x15 + x14 | 0, 7);
        x13 ^= rotl(x12 + x15 | 0, 9);
        x14 ^= rotl(x13 + x12 | 0, 13);
        x15 ^= rotl(x14 + x13 | 0, 18);
    }
    // Write output
    let oi = 0;
    out[oi++] = (y00 + x00) | 0;
    out[oi++] = (y01 + x01) | 0;
    out[oi++] = (y02 + x02) | 0;
    out[oi++] = (y03 + x03) | 0;
    out[oi++] = (y04 + x04) | 0;
    out[oi++] = (y05 + x05) | 0;
    out[oi++] = (y06 + x06) | 0;
    out[oi++] = (y07 + x07) | 0;
    out[oi++] = (y08 + x08) | 0;
    out[oi++] = (y09 + x09) | 0;
    out[oi++] = (y10 + x10) | 0;
    out[oi++] = (y11 + x11) | 0;
    out[oi++] = (y12 + x12) | 0;
    out[oi++] = (y13 + x13) | 0;
    out[oi++] = (y14 + x14) | 0;
    out[oi++] = (y15 + x15) | 0;
}
/**
 * hsalsa hashes key and nonce-prefix words into the 32-byte subkey used by XSalsa20.
 * Identical to `hsalsa_small`.
 * Need to find a way to merge it with `salsaCore` without 25% performance hit.
 * @param s - Sigma constants as 32-bit words.
 * @param k - Key words.
 * @param i - Nonce-prefix words.
 * @param out - Output buffer for the derived subkey.
 * @example
 * Derives the XSalsa20 subkey from sigma, key, and nonce-prefix words.
 *
 * ```ts
 * const sigma = new Uint32Array(4);
 * const key = new Uint32Array(8);
 * const nonce = new Uint32Array(4);
 * const out = new Uint32Array(8);
 * hsalsa(sigma, key, nonce, out);
 * ```
 */
// prettier-ignore
function hsalsa(s, k, i, out) {
    let x00 = swap8IfBE(s[0]), x01 = swap8IfBE(k[0]), x02 = swap8IfBE(k[1]), x03 = swap8IfBE(k[2]), x04 = swap8IfBE(k[3]), x05 = swap8IfBE(s[1]), x06 = swap8IfBE(i[0]), x07 = swap8IfBE(i[1]), x08 = swap8IfBE(i[2]), x09 = swap8IfBE(i[3]), x10 = swap8IfBE(s[2]), x11 = swap8IfBE(k[4]), x12 = swap8IfBE(k[5]), x13 = swap8IfBE(k[6]), x14 = swap8IfBE(k[7]), x15 = swap8IfBE(s[3]);
    for (let r = 0; r < 20; r += 2) {
        x04 ^= rotl(x00 + x12 | 0, 7);
        x08 ^= rotl(x04 + x00 | 0, 9);
        x12 ^= rotl(x08 + x04 | 0, 13);
        x00 ^= rotl(x12 + x08 | 0, 18);
        x09 ^= rotl(x05 + x01 | 0, 7);
        x13 ^= rotl(x09 + x05 | 0, 9);
        x01 ^= rotl(x13 + x09 | 0, 13);
        x05 ^= rotl(x01 + x13 | 0, 18);
        x14 ^= rotl(x10 + x06 | 0, 7);
        x02 ^= rotl(x14 + x10 | 0, 9);
        x06 ^= rotl(x02 + x14 | 0, 13);
        x10 ^= rotl(x06 + x02 | 0, 18);
        x03 ^= rotl(x15 + x11 | 0, 7);
        x07 ^= rotl(x03 + x15 | 0, 9);
        x11 ^= rotl(x07 + x03 | 0, 13);
        x15 ^= rotl(x11 + x07 | 0, 18);
        x01 ^= rotl(x00 + x03 | 0, 7);
        x02 ^= rotl(x01 + x00 | 0, 9);
        x03 ^= rotl(x02 + x01 | 0, 13);
        x00 ^= rotl(x03 + x02 | 0, 18);
        x06 ^= rotl(x05 + x04 | 0, 7);
        x07 ^= rotl(x06 + x05 | 0, 9);
        x04 ^= rotl(x07 + x06 | 0, 13);
        x05 ^= rotl(x04 + x07 | 0, 18);
        x11 ^= rotl(x10 + x09 | 0, 7);
        x08 ^= rotl(x11 + x10 | 0, 9);
        x09 ^= rotl(x08 + x11 | 0, 13);
        x10 ^= rotl(x09 + x08 | 0, 18);
        x12 ^= rotl(x15 + x14 | 0, 7);
        x13 ^= rotl(x12 + x15 | 0, 9);
        x14 ^= rotl(x13 + x12 | 0, 13);
        x15 ^= rotl(x14 + x13 | 0, 18);
    }
    let oi = 0;
    // XSalsa20 takes words 0,5,10,15 and 6,7,8,9 as the 32-byte subkey material.
    out[oi++] = x00;
    out[oi++] = x05;
    out[oi++] = x10;
    out[oi++] = x15;
    out[oi++] = x06;
    out[oi++] = x07;
    out[oi++] = x08;
    out[oi++] = x09;
    swap32IfBE(out);
}
/**
 * Salsa20 from original paper. 8-byte nonce.
 * With smaller nonce, it's not safe to make it random (CSPRNG), due to collision chance.
 * @param key - 16-byte or 32-byte key.
 * @param nonce - 8-byte nonce.
 * @param data - Input bytes to xor with the keystream.
 * @param output - Optional destination buffer.
 * @param counter - Initial block counter.
 * Only the low 32 bits of Salsa20's 64-bit counter state are exposed here;
 * the high word stays zero and the implementation still caps the public
 * value to 32 bits.
 * @returns Encrypted or decrypted bytes.
 * @example
 * Encrypts bytes with the original 8-byte-nonce Salsa20 stream cipher.
 *
 * ```ts
 * import { salsa20 } from '@noble/ciphers/salsa.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(8);
 * salsa20(key, nonce, new Uint8Array([1, 2, 3, 4]));
 * ```
 */
const salsa20 = /* @__PURE__ */ createCipher(salsaCore, {
    allowShortKeys: true,
    counterRight: true,
});
/**
 * XSalsa20 extended-nonce salsa.
 * With 24-byte nonce, it's safe to make it random (CSPRNG).
 * @param key - 32-byte key.
 * This XSalsa20 wrapper does not enable Salsa20's 16-byte legacy key mode.
 * @param nonce - 24-byte nonce.
 * @param data - Input bytes to xor with the keystream.
 * @param output - Optional destination buffer.
 * @param counter - Initial block counter.
 * @returns Encrypted or decrypted bytes.
 * @example
 * Encrypts bytes with XSalsa20 and a random 24-byte nonce.
 *
 * ```ts
 * import { xsalsa20 } from '@noble/ciphers/salsa.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(24);
 * xsalsa20(key, nonce, new Uint8Array([1, 2, 3, 4]));
 * ```
 */
const xsalsa20 = /* @__PURE__ */ createCipher(salsaCore, {
    counterRight: true,
    extendNonceFn: hsalsa,
});
/**
 * xsalsa20-poly1305 eXtended-nonce (24 bytes) salsa.
 * With 24-byte nonce, it's safe to make it random (CSPRNG).
 * Also known as `secretbox` from libsodium / nacl.
 * No AAD input is supported here. Caller-provided `output` buffers for
 * `encrypt()` / `decrypt()` must be `input.length + 32` bytes because the
 * implementation uses a 32-byte leading scratch area before returning `+16`.
 * @param key - 32-byte key.
 * @param nonce - 24-byte nonce.
 * @param AAD - Must be omitted; XSalsa20-Poly1305 secretbox does not support associated data.
 * @returns AEAD cipher instance.
 * @example
 * Encrypts and authenticates plaintext with XSalsa20-Poly1305.
 *
 * ```ts
 * import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js';
 * import { randomBytes } from '@noble/ciphers/utils.js';
 * const key = randomBytes(32);
 * const nonce = randomBytes(24);
 * const cipher = xsalsa20poly1305(key, nonce);
 * cipher.encrypt(new Uint8Array([1, 2, 3]));
 * ```
 */
const xsalsa20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 24, tagLength: 16 }, (key, nonce) => {
    // This borrows caller key/nonce buffers by reference; mutating them after construction changes
    // later encrypt/decrypt outputs.
    return {
        encrypt(plaintext, output) {
            // xsalsa20poly1305 optimizes by calculating auth key during the same call as encryption.
            // Unfortunately, makes it hard to separate tag calculation & encryption itself,
            // because 32 bytes is half-block of 64-byte salsa.
            // Need 32 extra bytes up front for the auth-key scratch area described above.
            output = getOutput(plaintext.length + 32, output, false);
            // output[0..32] = Poly1305 auth key, output[32..] = plaintext then ciphertext.
            const authKey = output.subarray(0, 32);
            const ciphPlaintext = output.subarray(32);
            output.set(plaintext, 32);
            // authKey is produced by xoring the first 32 bytes with zeros.
            clean(authKey);
            // output = stream ^ output; authKey = stream ^ zeros(32)
            xsalsa20(key, nonce, output, output);
            const tag = poly1305(ciphPlaintext, authKey);
            output.set(tag, 16);
            // Clean up auth-key remnants and the temporary tag copy.
            clean(output.subarray(0, 16), tag);
            // Return output[16..].
            return output.subarray(16);
        },
        decrypt(ciphertext, output) {
            // tmp part     passed tag    ciphertext
            // [0..32]      [32..48]      [48..]
            // Authenticate the ciphertext before decrypting it; on tag failure the scratch/output
            // buffer may already contain copied ciphertext and derived auth-key material.
            abytes(ciphertext);
            output = getOutput(ciphertext.length + 32, output, false);
            // output[0..32] is auth-key scratch, output[32..48] is passed tag,
            // output[48..] is ciphertext then plaintext.
            const tmp = output.subarray(0, 32);
            const passedTag = output.subarray(32, 48);
            const ciphPlaintext = output.subarray(48);
            output.set(ciphertext, 32);
            // authKey is produced by xoring the scratch area with zeros.
            clean(tmp);
            const authKey = xsalsa20(key, nonce, tmp, tmp);
            const tag = poly1305(ciphPlaintext, authKey);
            if (!equalBytes(passedTag, tag)) {
                clean(output);
                throw new Error('invalid tag');
            }
            // output = stream ^ output[16..]
            xsalsa20(key, nonce, output.subarray(16), output.subarray(16));
            clean(tmp, passedTag, tag);
            // Return output[48..], skipping zeroized output[0..48].
            return ciphPlaintext;
        },
    };
});

export { BinaryFF1, aeskw, aeskwp, aessiv, cbc, cfb, chacha12, chacha20, chacha20orig, chacha20poly1305, chacha8, ctr, ecb, gcm, gcmsiv, salsa20, xchacha20, xchacha20poly1305, xsalsa20, xsalsa20poly1305 };

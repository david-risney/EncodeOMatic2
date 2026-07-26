function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function getAugmentedNamespace(n) {
  if (Object.prototype.hasOwnProperty.call(n, '__esModule')) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			var isInstance = false;
      try {
        isInstance = this instanceof a;
      } catch (e) {}
			if (isInstance) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

const unsupported$2 = new Proxy({}, {
  get(_target, property) {
    throw new Error(
      'Node built-in module ' + "fs" +
      ' is unavailable in browsers; attempted to access "' + String(property) + '".'
    );
  },
});

var _browserBuiltinShim_fs = /*#__PURE__*/Object.freeze({
	__proto__: null,
	default: unsupported$2
});

var require$$1$1 = /*@__PURE__*/getAugmentedNamespace(_browserBuiltinShim_fs);

var buffer = {};

var base64Js = {};

var hasRequiredBase64Js;

function requireBase64Js () {
	if (hasRequiredBase64Js) return base64Js;
	hasRequiredBase64Js = 1;

	base64Js.byteLength = byteLength;
	base64Js.toByteArray = toByteArray;
	base64Js.fromByteArray = fromByteArray;

	var lookup = [];
	var revLookup = [];
	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

	var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	for (var i = 0, len = code.length; i < len; ++i) {
	  lookup[i] = code[i];
	  revLookup[code.charCodeAt(i)] = i;
	}

	// Support decoding URL-safe base64 strings, as Node.js does.
	// See: https://en.wikipedia.org/wiki/Base64#URL_applications
	revLookup['-'.charCodeAt(0)] = 62;
	revLookup['_'.charCodeAt(0)] = 63;

	function getLens (b64) {
	  var len = b64.length;

	  if (len % 4 > 0) {
	    throw new Error('Invalid string. Length must be a multiple of 4')
	  }

	  // Trim off extra bytes after placeholder bytes are found
	  // See: https://github.com/beatgammit/base64-js/issues/42
	  var validLen = b64.indexOf('=');
	  if (validLen === -1) validLen = len;

	  var placeHoldersLen = validLen === len
	    ? 0
	    : 4 - (validLen % 4);

	  return [validLen, placeHoldersLen]
	}

	// base64 is 4/3 + up to two characters of the original data
	function byteLength (b64) {
	  var lens = getLens(b64);
	  var validLen = lens[0];
	  var placeHoldersLen = lens[1];
	  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
	}

	function _byteLength (b64, validLen, placeHoldersLen) {
	  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
	}

	function toByteArray (b64) {
	  var tmp;
	  var lens = getLens(b64);
	  var validLen = lens[0];
	  var placeHoldersLen = lens[1];

	  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

	  var curByte = 0;

	  // if there are placeholders, only get up to the last complete 4 chars
	  var len = placeHoldersLen > 0
	    ? validLen - 4
	    : validLen;

	  var i;
	  for (i = 0; i < len; i += 4) {
	    tmp =
	      (revLookup[b64.charCodeAt(i)] << 18) |
	      (revLookup[b64.charCodeAt(i + 1)] << 12) |
	      (revLookup[b64.charCodeAt(i + 2)] << 6) |
	      revLookup[b64.charCodeAt(i + 3)];
	    arr[curByte++] = (tmp >> 16) & 0xFF;
	    arr[curByte++] = (tmp >> 8) & 0xFF;
	    arr[curByte++] = tmp & 0xFF;
	  }

	  if (placeHoldersLen === 2) {
	    tmp =
	      (revLookup[b64.charCodeAt(i)] << 2) |
	      (revLookup[b64.charCodeAt(i + 1)] >> 4);
	    arr[curByte++] = tmp & 0xFF;
	  }

	  if (placeHoldersLen === 1) {
	    tmp =
	      (revLookup[b64.charCodeAt(i)] << 10) |
	      (revLookup[b64.charCodeAt(i + 1)] << 4) |
	      (revLookup[b64.charCodeAt(i + 2)] >> 2);
	    arr[curByte++] = (tmp >> 8) & 0xFF;
	    arr[curByte++] = tmp & 0xFF;
	  }

	  return arr
	}

	function tripletToBase64 (num) {
	  return lookup[num >> 18 & 0x3F] +
	    lookup[num >> 12 & 0x3F] +
	    lookup[num >> 6 & 0x3F] +
	    lookup[num & 0x3F]
	}

	function encodeChunk (uint8, start, end) {
	  var tmp;
	  var output = [];
	  for (var i = start; i < end; i += 3) {
	    tmp =
	      ((uint8[i] << 16) & 0xFF0000) +
	      ((uint8[i + 1] << 8) & 0xFF00) +
	      (uint8[i + 2] & 0xFF);
	    output.push(tripletToBase64(tmp));
	  }
	  return output.join('')
	}

	function fromByteArray (uint8) {
	  var tmp;
	  var len = uint8.length;
	  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
	  var parts = [];
	  var maxChunkLength = 16383; // must be multiple of 3

	  // go through the array every three bytes, we'll deal with trailing stuff later
	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
	    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
	  }

	  // pad the end with zeros, but make sure to not forget the extra bytes
	  if (extraBytes === 1) {
	    tmp = uint8[len - 1];
	    parts.push(
	      lookup[tmp >> 2] +
	      lookup[(tmp << 4) & 0x3F] +
	      '=='
	    );
	  } else if (extraBytes === 2) {
	    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
	    parts.push(
	      lookup[tmp >> 10] +
	      lookup[(tmp >> 4) & 0x3F] +
	      lookup[(tmp << 2) & 0x3F] +
	      '='
	    );
	  }

	  return parts.join('')
	}
	return base64Js;
}

var ieee754 = {};

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */

var hasRequiredIeee754;

function requireIeee754 () {
	if (hasRequiredIeee754) return ieee754;
	hasRequiredIeee754 = 1;
	ieee754.read = function (buffer, offset, isLE, mLen, nBytes) {
	  var e, m;
	  var eLen = (nBytes * 8) - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var nBits = -7;
	  var i = isLE ? (nBytes - 1) : 0;
	  var d = isLE ? -1 : 1;
	  var s = buffer[offset + i];

	  i += d;

	  e = s & ((1 << (-nBits)) - 1);
	  s >>= (-nBits);
	  nBits += eLen;
	  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

	  m = e & ((1 << (-nBits)) - 1);
	  e >>= (-nBits);
	  nBits += mLen;
	  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

	  if (e === 0) {
	    e = 1 - eBias;
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen);
	    e = e - eBias;
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	};

	ieee754.write = function (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c;
	  var eLen = (nBytes * 8) - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
	  var i = isLE ? 0 : (nBytes - 1);
	  var d = isLE ? 1 : -1;
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

	  value = Math.abs(value);

	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0;
	    e = eMax;
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2);
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--;
	      c *= 2;
	    }
	    if (e + eBias >= 1) {
	      value += rt / c;
	    } else {
	      value += rt * Math.pow(2, 1 - eBias);
	    }
	    if (value * c >= 2) {
	      e++;
	      c /= 2;
	    }

	    if (e + eBias >= eMax) {
	      m = 0;
	      e = eMax;
	    } else if (e + eBias >= 1) {
	      m = ((value * c) - 1) * Math.pow(2, mLen);
	      e = e + eBias;
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
	      e = 0;
	    }
	  }

	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

	  e = (e << mLen) | m;
	  eLen += mLen;
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

	  buffer[offset + i - d] |= s * 128;
	};
	return ieee754;
}

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

var hasRequiredBuffer;

function requireBuffer () {
	if (hasRequiredBuffer) return buffer;
	hasRequiredBuffer = 1;
	(function (exports) {

		const base64 = requireBase64Js();
		const ieee754 = requireIeee754();
		const customInspectSymbol =
		  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
		    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
		    : null;

		exports.Buffer = Buffer;
		exports.SlowBuffer = SlowBuffer;
		exports.INSPECT_MAX_BYTES = 50;

		const K_MAX_LENGTH = 0x7fffffff;
		exports.kMaxLength = K_MAX_LENGTH;

		/**
		 * If `Buffer.TYPED_ARRAY_SUPPORT`:
		 *   === true    Use Uint8Array implementation (fastest)
		 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
		 *               implementation (most compatible, even IE6)
		 *
		 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
		 * Opera 11.6+, iOS 4.2+.
		 *
		 * We report that the browser does not support typed arrays if the are not subclassable
		 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
		 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
		 * for __proto__ and has a buggy typed array implementation.
		 */
		Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();

		if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
		    typeof console.error === 'function') {
		  console.error(
		    'This browser lacks typed array (Uint8Array) support which is required by ' +
		    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
		  );
		}

		function typedArraySupport () {
		  // Can typed array instances can be augmented?
		  try {
		    const arr = new Uint8Array(1);
		    const proto = { foo: function () { return 42 } };
		    Object.setPrototypeOf(proto, Uint8Array.prototype);
		    Object.setPrototypeOf(arr, proto);
		    return arr.foo() === 42
		  } catch (e) {
		    return false
		  }
		}

		Object.defineProperty(Buffer.prototype, 'parent', {
		  enumerable: true,
		  get: function () {
		    if (!Buffer.isBuffer(this)) return undefined
		    return this.buffer
		  }
		});

		Object.defineProperty(Buffer.prototype, 'offset', {
		  enumerable: true,
		  get: function () {
		    if (!Buffer.isBuffer(this)) return undefined
		    return this.byteOffset
		  }
		});

		function createBuffer (length) {
		  if (length > K_MAX_LENGTH) {
		    throw new RangeError('The value "' + length + '" is invalid for option "size"')
		  }
		  // Return an augmented `Uint8Array` instance
		  const buf = new Uint8Array(length);
		  Object.setPrototypeOf(buf, Buffer.prototype);
		  return buf
		}

		/**
		 * The Buffer constructor returns instances of `Uint8Array` that have their
		 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
		 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
		 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
		 * returns a single octet.
		 *
		 * The `Uint8Array` prototype remains unmodified.
		 */

		function Buffer (arg, encodingOrOffset, length) {
		  // Common case.
		  if (typeof arg === 'number') {
		    if (typeof encodingOrOffset === 'string') {
		      throw new TypeError(
		        'The "string" argument must be of type string. Received type number'
		      )
		    }
		    return allocUnsafe(arg)
		  }
		  return from(arg, encodingOrOffset, length)
		}

		Buffer.poolSize = 8192; // not used by this implementation

		function from (value, encodingOrOffset, length) {
		  if (typeof value === 'string') {
		    return fromString(value, encodingOrOffset)
		  }

		  if (ArrayBuffer.isView(value)) {
		    return fromArrayView(value)
		  }

		  if (value == null) {
		    throw new TypeError(
		      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
		      'or Array-like Object. Received type ' + (typeof value)
		    )
		  }

		  if (isInstance(value, ArrayBuffer) ||
		      (value && isInstance(value.buffer, ArrayBuffer))) {
		    return fromArrayBuffer(value, encodingOrOffset, length)
		  }

		  if (typeof SharedArrayBuffer !== 'undefined' &&
		      (isInstance(value, SharedArrayBuffer) ||
		      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
		    return fromArrayBuffer(value, encodingOrOffset, length)
		  }

		  if (typeof value === 'number') {
		    throw new TypeError(
		      'The "value" argument must not be of type number. Received type number'
		    )
		  }

		  const valueOf = value.valueOf && value.valueOf();
		  if (valueOf != null && valueOf !== value) {
		    return Buffer.from(valueOf, encodingOrOffset, length)
		  }

		  const b = fromObject(value);
		  if (b) return b

		  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
		      typeof value[Symbol.toPrimitive] === 'function') {
		    return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length)
		  }

		  throw new TypeError(
		    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
		    'or Array-like Object. Received type ' + (typeof value)
		  )
		}

		/**
		 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
		 * if value is a number.
		 * Buffer.from(str[, encoding])
		 * Buffer.from(array)
		 * Buffer.from(buffer)
		 * Buffer.from(arrayBuffer[, byteOffset[, length]])
		 **/
		Buffer.from = function (value, encodingOrOffset, length) {
		  return from(value, encodingOrOffset, length)
		};

		// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
		// https://github.com/feross/buffer/pull/148
		Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
		Object.setPrototypeOf(Buffer, Uint8Array);

		function assertSize (size) {
		  if (typeof size !== 'number') {
		    throw new TypeError('"size" argument must be of type number')
		  } else if (size < 0) {
		    throw new RangeError('The value "' + size + '" is invalid for option "size"')
		  }
		}

		function alloc (size, fill, encoding) {
		  assertSize(size);
		  if (size <= 0) {
		    return createBuffer(size)
		  }
		  if (fill !== undefined) {
		    // Only pay attention to encoding if it's a string. This
		    // prevents accidentally sending in a number that would
		    // be interpreted as a start offset.
		    return typeof encoding === 'string'
		      ? createBuffer(size).fill(fill, encoding)
		      : createBuffer(size).fill(fill)
		  }
		  return createBuffer(size)
		}

		/**
		 * Creates a new filled Buffer instance.
		 * alloc(size[, fill[, encoding]])
		 **/
		Buffer.alloc = function (size, fill, encoding) {
		  return alloc(size, fill, encoding)
		};

		function allocUnsafe (size) {
		  assertSize(size);
		  return createBuffer(size < 0 ? 0 : checked(size) | 0)
		}

		/**
		 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
		 * */
		Buffer.allocUnsafe = function (size) {
		  return allocUnsafe(size)
		};
		/**
		 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
		 */
		Buffer.allocUnsafeSlow = function (size) {
		  return allocUnsafe(size)
		};

		function fromString (string, encoding) {
		  if (typeof encoding !== 'string' || encoding === '') {
		    encoding = 'utf8';
		  }

		  if (!Buffer.isEncoding(encoding)) {
		    throw new TypeError('Unknown encoding: ' + encoding)
		  }

		  const length = byteLength(string, encoding) | 0;
		  let buf = createBuffer(length);

		  const actual = buf.write(string, encoding);

		  if (actual !== length) {
		    // Writing a hex string, for example, that contains invalid characters will
		    // cause everything after the first invalid character to be ignored. (e.g.
		    // 'abxxcd' will be treated as 'ab')
		    buf = buf.slice(0, actual);
		  }

		  return buf
		}

		function fromArrayLike (array) {
		  const length = array.length < 0 ? 0 : checked(array.length) | 0;
		  const buf = createBuffer(length);
		  for (let i = 0; i < length; i += 1) {
		    buf[i] = array[i] & 255;
		  }
		  return buf
		}

		function fromArrayView (arrayView) {
		  if (isInstance(arrayView, Uint8Array)) {
		    const copy = new Uint8Array(arrayView);
		    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
		  }
		  return fromArrayLike(arrayView)
		}

		function fromArrayBuffer (array, byteOffset, length) {
		  if (byteOffset < 0 || array.byteLength < byteOffset) {
		    throw new RangeError('"offset" is outside of buffer bounds')
		  }

		  if (array.byteLength < byteOffset + (length || 0)) {
		    throw new RangeError('"length" is outside of buffer bounds')
		  }

		  let buf;
		  if (byteOffset === undefined && length === undefined) {
		    buf = new Uint8Array(array);
		  } else if (length === undefined) {
		    buf = new Uint8Array(array, byteOffset);
		  } else {
		    buf = new Uint8Array(array, byteOffset, length);
		  }

		  // Return an augmented `Uint8Array` instance
		  Object.setPrototypeOf(buf, Buffer.prototype);

		  return buf
		}

		function fromObject (obj) {
		  if (Buffer.isBuffer(obj)) {
		    const len = checked(obj.length) | 0;
		    const buf = createBuffer(len);

		    if (buf.length === 0) {
		      return buf
		    }

		    obj.copy(buf, 0, 0, len);
		    return buf
		  }

		  if (obj.length !== undefined) {
		    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
		      return createBuffer(0)
		    }
		    return fromArrayLike(obj)
		  }

		  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
		    return fromArrayLike(obj.data)
		  }
		}

		function checked (length) {
		  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
		  // length is NaN (which is otherwise coerced to zero.)
		  if (length >= K_MAX_LENGTH) {
		    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
		                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
		  }
		  return length | 0
		}

		function SlowBuffer (length) {
		  if (+length != length) { // eslint-disable-line eqeqeq
		    length = 0;
		  }
		  return Buffer.alloc(+length)
		}

		Buffer.isBuffer = function isBuffer (b) {
		  return b != null && b._isBuffer === true &&
		    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
		};

		Buffer.compare = function compare (a, b) {
		  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
		  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
		  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
		    throw new TypeError(
		      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
		    )
		  }

		  if (a === b) return 0

		  let x = a.length;
		  let y = b.length;

		  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
		    if (a[i] !== b[i]) {
		      x = a[i];
		      y = b[i];
		      break
		    }
		  }

		  if (x < y) return -1
		  if (y < x) return 1
		  return 0
		};

		Buffer.isEncoding = function isEncoding (encoding) {
		  switch (String(encoding).toLowerCase()) {
		    case 'hex':
		    case 'utf8':
		    case 'utf-8':
		    case 'ascii':
		    case 'latin1':
		    case 'binary':
		    case 'base64':
		    case 'ucs2':
		    case 'ucs-2':
		    case 'utf16le':
		    case 'utf-16le':
		      return true
		    default:
		      return false
		  }
		};

		Buffer.concat = function concat (list, length) {
		  if (!Array.isArray(list)) {
		    throw new TypeError('"list" argument must be an Array of Buffers')
		  }

		  if (list.length === 0) {
		    return Buffer.alloc(0)
		  }

		  let i;
		  if (length === undefined) {
		    length = 0;
		    for (i = 0; i < list.length; ++i) {
		      length += list[i].length;
		    }
		  }

		  const buffer = Buffer.allocUnsafe(length);
		  let pos = 0;
		  for (i = 0; i < list.length; ++i) {
		    let buf = list[i];
		    if (isInstance(buf, Uint8Array)) {
		      if (pos + buf.length > buffer.length) {
		        if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
		        buf.copy(buffer, pos);
		      } else {
		        Uint8Array.prototype.set.call(
		          buffer,
		          buf,
		          pos
		        );
		      }
		    } else if (!Buffer.isBuffer(buf)) {
		      throw new TypeError('"list" argument must be an Array of Buffers')
		    } else {
		      buf.copy(buffer, pos);
		    }
		    pos += buf.length;
		  }
		  return buffer
		};

		function byteLength (string, encoding) {
		  if (Buffer.isBuffer(string)) {
		    return string.length
		  }
		  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
		    return string.byteLength
		  }
		  if (typeof string !== 'string') {
		    throw new TypeError(
		      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
		      'Received type ' + typeof string
		    )
		  }

		  const len = string.length;
		  const mustMatch = (arguments.length > 2 && arguments[2] === true);
		  if (!mustMatch && len === 0) return 0

		  // Use a for loop to avoid recursion
		  let loweredCase = false;
		  for (;;) {
		    switch (encoding) {
		      case 'ascii':
		      case 'latin1':
		      case 'binary':
		        return len
		      case 'utf8':
		      case 'utf-8':
		        return utf8ToBytes(string).length
		      case 'ucs2':
		      case 'ucs-2':
		      case 'utf16le':
		      case 'utf-16le':
		        return len * 2
		      case 'hex':
		        return len >>> 1
		      case 'base64':
		        return base64ToBytes(string).length
		      default:
		        if (loweredCase) {
		          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
		        }
		        encoding = ('' + encoding).toLowerCase();
		        loweredCase = true;
		    }
		  }
		}
		Buffer.byteLength = byteLength;

		function slowToString (encoding, start, end) {
		  let loweredCase = false;

		  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
		  // property of a typed array.

		  // This behaves neither like String nor Uint8Array in that we set start/end
		  // to their upper/lower bounds if the value passed is out of range.
		  // undefined is handled specially as per ECMA-262 6th Edition,
		  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
		  if (start === undefined || start < 0) {
		    start = 0;
		  }
		  // Return early if start > this.length. Done here to prevent potential uint32
		  // coercion fail below.
		  if (start > this.length) {
		    return ''
		  }

		  if (end === undefined || end > this.length) {
		    end = this.length;
		  }

		  if (end <= 0) {
		    return ''
		  }

		  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
		  end >>>= 0;
		  start >>>= 0;

		  if (end <= start) {
		    return ''
		  }

		  if (!encoding) encoding = 'utf8';

		  while (true) {
		    switch (encoding) {
		      case 'hex':
		        return hexSlice(this, start, end)

		      case 'utf8':
		      case 'utf-8':
		        return utf8Slice(this, start, end)

		      case 'ascii':
		        return asciiSlice(this, start, end)

		      case 'latin1':
		      case 'binary':
		        return latin1Slice(this, start, end)

		      case 'base64':
		        return base64Slice(this, start, end)

		      case 'ucs2':
		      case 'ucs-2':
		      case 'utf16le':
		      case 'utf-16le':
		        return utf16leSlice(this, start, end)

		      default:
		        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
		        encoding = (encoding + '').toLowerCase();
		        loweredCase = true;
		    }
		  }
		}

		// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
		// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
		// reliably in a browserify context because there could be multiple different
		// copies of the 'buffer' package in use. This method works even for Buffer
		// instances that were created from another copy of the `buffer` package.
		// See: https://github.com/feross/buffer/issues/154
		Buffer.prototype._isBuffer = true;

		function swap (b, n, m) {
		  const i = b[n];
		  b[n] = b[m];
		  b[m] = i;
		}

		Buffer.prototype.swap16 = function swap16 () {
		  const len = this.length;
		  if (len % 2 !== 0) {
		    throw new RangeError('Buffer size must be a multiple of 16-bits')
		  }
		  for (let i = 0; i < len; i += 2) {
		    swap(this, i, i + 1);
		  }
		  return this
		};

		Buffer.prototype.swap32 = function swap32 () {
		  const len = this.length;
		  if (len % 4 !== 0) {
		    throw new RangeError('Buffer size must be a multiple of 32-bits')
		  }
		  for (let i = 0; i < len; i += 4) {
		    swap(this, i, i + 3);
		    swap(this, i + 1, i + 2);
		  }
		  return this
		};

		Buffer.prototype.swap64 = function swap64 () {
		  const len = this.length;
		  if (len % 8 !== 0) {
		    throw new RangeError('Buffer size must be a multiple of 64-bits')
		  }
		  for (let i = 0; i < len; i += 8) {
		    swap(this, i, i + 7);
		    swap(this, i + 1, i + 6);
		    swap(this, i + 2, i + 5);
		    swap(this, i + 3, i + 4);
		  }
		  return this
		};

		Buffer.prototype.toString = function toString () {
		  const length = this.length;
		  if (length === 0) return ''
		  if (arguments.length === 0) return utf8Slice(this, 0, length)
		  return slowToString.apply(this, arguments)
		};

		Buffer.prototype.toLocaleString = Buffer.prototype.toString;

		Buffer.prototype.equals = function equals (b) {
		  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
		  if (this === b) return true
		  return Buffer.compare(this, b) === 0
		};

		Buffer.prototype.inspect = function inspect () {
		  let str = '';
		  const max = exports.INSPECT_MAX_BYTES;
		  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim();
		  if (this.length > max) str += ' ... ';
		  return '<Buffer ' + str + '>'
		};
		if (customInspectSymbol) {
		  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
		}

		Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
		  if (isInstance(target, Uint8Array)) {
		    target = Buffer.from(target, target.offset, target.byteLength);
		  }
		  if (!Buffer.isBuffer(target)) {
		    throw new TypeError(
		      'The "target" argument must be one of type Buffer or Uint8Array. ' +
		      'Received type ' + (typeof target)
		    )
		  }

		  if (start === undefined) {
		    start = 0;
		  }
		  if (end === undefined) {
		    end = target ? target.length : 0;
		  }
		  if (thisStart === undefined) {
		    thisStart = 0;
		  }
		  if (thisEnd === undefined) {
		    thisEnd = this.length;
		  }

		  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
		    throw new RangeError('out of range index')
		  }

		  if (thisStart >= thisEnd && start >= end) {
		    return 0
		  }
		  if (thisStart >= thisEnd) {
		    return -1
		  }
		  if (start >= end) {
		    return 1
		  }

		  start >>>= 0;
		  end >>>= 0;
		  thisStart >>>= 0;
		  thisEnd >>>= 0;

		  if (this === target) return 0

		  let x = thisEnd - thisStart;
		  let y = end - start;
		  const len = Math.min(x, y);

		  const thisCopy = this.slice(thisStart, thisEnd);
		  const targetCopy = target.slice(start, end);

		  for (let i = 0; i < len; ++i) {
		    if (thisCopy[i] !== targetCopy[i]) {
		      x = thisCopy[i];
		      y = targetCopy[i];
		      break
		    }
		  }

		  if (x < y) return -1
		  if (y < x) return 1
		  return 0
		};

		// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
		// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
		//
		// Arguments:
		// - buffer - a Buffer to search
		// - val - a string, Buffer, or number
		// - byteOffset - an index into `buffer`; will be clamped to an int32
		// - encoding - an optional encoding, relevant is val is a string
		// - dir - true for indexOf, false for lastIndexOf
		function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
		  // Empty buffer means no match
		  if (buffer.length === 0) return -1

		  // Normalize byteOffset
		  if (typeof byteOffset === 'string') {
		    encoding = byteOffset;
		    byteOffset = 0;
		  } else if (byteOffset > 0x7fffffff) {
		    byteOffset = 0x7fffffff;
		  } else if (byteOffset < -2147483648) {
		    byteOffset = -2147483648;
		  }
		  byteOffset = +byteOffset; // Coerce to Number.
		  if (numberIsNaN(byteOffset)) {
		    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
		    byteOffset = dir ? 0 : (buffer.length - 1);
		  }

		  // Normalize byteOffset: negative offsets start from the end of the buffer
		  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
		  if (byteOffset >= buffer.length) {
		    if (dir) return -1
		    else byteOffset = buffer.length - 1;
		  } else if (byteOffset < 0) {
		    if (dir) byteOffset = 0;
		    else return -1
		  }

		  // Normalize val
		  if (typeof val === 'string') {
		    val = Buffer.from(val, encoding);
		  }

		  // Finally, search either indexOf (if dir is true) or lastIndexOf
		  if (Buffer.isBuffer(val)) {
		    // Special case: looking for empty string/buffer always fails
		    if (val.length === 0) {
		      return -1
		    }
		    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
		  } else if (typeof val === 'number') {
		    val = val & 0xFF; // Search for a byte value [0-255]
		    if (typeof Uint8Array.prototype.indexOf === 'function') {
		      if (dir) {
		        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
		      } else {
		        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
		      }
		    }
		    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
		  }

		  throw new TypeError('val must be string, number or Buffer')
		}

		function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
		  let indexSize = 1;
		  let arrLength = arr.length;
		  let valLength = val.length;

		  if (encoding !== undefined) {
		    encoding = String(encoding).toLowerCase();
		    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
		        encoding === 'utf16le' || encoding === 'utf-16le') {
		      if (arr.length < 2 || val.length < 2) {
		        return -1
		      }
		      indexSize = 2;
		      arrLength /= 2;
		      valLength /= 2;
		      byteOffset /= 2;
		    }
		  }

		  function read (buf, i) {
		    if (indexSize === 1) {
		      return buf[i]
		    } else {
		      return buf.readUInt16BE(i * indexSize)
		    }
		  }

		  let i;
		  if (dir) {
		    let foundIndex = -1;
		    for (i = byteOffset; i < arrLength; i++) {
		      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
		        if (foundIndex === -1) foundIndex = i;
		        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
		      } else {
		        if (foundIndex !== -1) i -= i - foundIndex;
		        foundIndex = -1;
		      }
		    }
		  } else {
		    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
		    for (i = byteOffset; i >= 0; i--) {
		      let found = true;
		      for (let j = 0; j < valLength; j++) {
		        if (read(arr, i + j) !== read(val, j)) {
		          found = false;
		          break
		        }
		      }
		      if (found) return i
		    }
		  }

		  return -1
		}

		Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
		  return this.indexOf(val, byteOffset, encoding) !== -1
		};

		Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
		  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
		};

		Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
		  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
		};

		function hexWrite (buf, string, offset, length) {
		  offset = Number(offset) || 0;
		  const remaining = buf.length - offset;
		  if (!length) {
		    length = remaining;
		  } else {
		    length = Number(length);
		    if (length > remaining) {
		      length = remaining;
		    }
		  }

		  const strLen = string.length;

		  if (length > strLen / 2) {
		    length = strLen / 2;
		  }
		  let i;
		  for (i = 0; i < length; ++i) {
		    const parsed = parseInt(string.substr(i * 2, 2), 16);
		    if (numberIsNaN(parsed)) return i
		    buf[offset + i] = parsed;
		  }
		  return i
		}

		function utf8Write (buf, string, offset, length) {
		  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
		}

		function asciiWrite (buf, string, offset, length) {
		  return blitBuffer(asciiToBytes(string), buf, offset, length)
		}

		function base64Write (buf, string, offset, length) {
		  return blitBuffer(base64ToBytes(string), buf, offset, length)
		}

		function ucs2Write (buf, string, offset, length) {
		  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
		}

		Buffer.prototype.write = function write (string, offset, length, encoding) {
		  // Buffer#write(string)
		  if (offset === undefined) {
		    encoding = 'utf8';
		    length = this.length;
		    offset = 0;
		  // Buffer#write(string, encoding)
		  } else if (length === undefined && typeof offset === 'string') {
		    encoding = offset;
		    length = this.length;
		    offset = 0;
		  // Buffer#write(string, offset[, length][, encoding])
		  } else if (isFinite(offset)) {
		    offset = offset >>> 0;
		    if (isFinite(length)) {
		      length = length >>> 0;
		      if (encoding === undefined) encoding = 'utf8';
		    } else {
		      encoding = length;
		      length = undefined;
		    }
		  } else {
		    throw new Error(
		      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
		    )
		  }

		  const remaining = this.length - offset;
		  if (length === undefined || length > remaining) length = remaining;

		  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
		    throw new RangeError('Attempt to write outside buffer bounds')
		  }

		  if (!encoding) encoding = 'utf8';

		  let loweredCase = false;
		  for (;;) {
		    switch (encoding) {
		      case 'hex':
		        return hexWrite(this, string, offset, length)

		      case 'utf8':
		      case 'utf-8':
		        return utf8Write(this, string, offset, length)

		      case 'ascii':
		      case 'latin1':
		      case 'binary':
		        return asciiWrite(this, string, offset, length)

		      case 'base64':
		        // Warning: maxLength not taken into account in base64Write
		        return base64Write(this, string, offset, length)

		      case 'ucs2':
		      case 'ucs-2':
		      case 'utf16le':
		      case 'utf-16le':
		        return ucs2Write(this, string, offset, length)

		      default:
		        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
		        encoding = ('' + encoding).toLowerCase();
		        loweredCase = true;
		    }
		  }
		};

		Buffer.prototype.toJSON = function toJSON () {
		  return {
		    type: 'Buffer',
		    data: Array.prototype.slice.call(this._arr || this, 0)
		  }
		};

		function base64Slice (buf, start, end) {
		  if (start === 0 && end === buf.length) {
		    return base64.fromByteArray(buf)
		  } else {
		    return base64.fromByteArray(buf.slice(start, end))
		  }
		}

		function utf8Slice (buf, start, end) {
		  end = Math.min(buf.length, end);
		  const res = [];

		  let i = start;
		  while (i < end) {
		    const firstByte = buf[i];
		    let codePoint = null;
		    let bytesPerSequence = (firstByte > 0xEF)
		      ? 4
		      : (firstByte > 0xDF)
		          ? 3
		          : (firstByte > 0xBF)
		              ? 2
		              : 1;

		    if (i + bytesPerSequence <= end) {
		      let secondByte, thirdByte, fourthByte, tempCodePoint;

		      switch (bytesPerSequence) {
		        case 1:
		          if (firstByte < 0x80) {
		            codePoint = firstByte;
		          }
		          break
		        case 2:
		          secondByte = buf[i + 1];
		          if ((secondByte & 0xC0) === 0x80) {
		            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
		            if (tempCodePoint > 0x7F) {
		              codePoint = tempCodePoint;
		            }
		          }
		          break
		        case 3:
		          secondByte = buf[i + 1];
		          thirdByte = buf[i + 2];
		          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
		            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
		            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
		              codePoint = tempCodePoint;
		            }
		          }
		          break
		        case 4:
		          secondByte = buf[i + 1];
		          thirdByte = buf[i + 2];
		          fourthByte = buf[i + 3];
		          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
		            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
		            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
		              codePoint = tempCodePoint;
		            }
		          }
		      }
		    }

		    if (codePoint === null) {
		      // we did not generate a valid codePoint so insert a
		      // replacement char (U+FFFD) and advance only 1 byte
		      codePoint = 0xFFFD;
		      bytesPerSequence = 1;
		    } else if (codePoint > 0xFFFF) {
		      // encode to utf16 (surrogate pair dance)
		      codePoint -= 0x10000;
		      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
		      codePoint = 0xDC00 | codePoint & 0x3FF;
		    }

		    res.push(codePoint);
		    i += bytesPerSequence;
		  }

		  return decodeCodePointsArray(res)
		}

		// Based on http://stackoverflow.com/a/22747272/680742, the browser with
		// the lowest limit is Chrome, with 0x10000 args.
		// We go 1 magnitude less, for safety
		const MAX_ARGUMENTS_LENGTH = 0x1000;

		function decodeCodePointsArray (codePoints) {
		  const len = codePoints.length;
		  if (len <= MAX_ARGUMENTS_LENGTH) {
		    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
		  }

		  // Decode in chunks to avoid "call stack size exceeded".
		  let res = '';
		  let i = 0;
		  while (i < len) {
		    res += String.fromCharCode.apply(
		      String,
		      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
		    );
		  }
		  return res
		}

		function asciiSlice (buf, start, end) {
		  let ret = '';
		  end = Math.min(buf.length, end);

		  for (let i = start; i < end; ++i) {
		    ret += String.fromCharCode(buf[i] & 0x7F);
		  }
		  return ret
		}

		function latin1Slice (buf, start, end) {
		  let ret = '';
		  end = Math.min(buf.length, end);

		  for (let i = start; i < end; ++i) {
		    ret += String.fromCharCode(buf[i]);
		  }
		  return ret
		}

		function hexSlice (buf, start, end) {
		  const len = buf.length;

		  if (!start || start < 0) start = 0;
		  if (!end || end < 0 || end > len) end = len;

		  let out = '';
		  for (let i = start; i < end; ++i) {
		    out += hexSliceLookupTable[buf[i]];
		  }
		  return out
		}

		function utf16leSlice (buf, start, end) {
		  const bytes = buf.slice(start, end);
		  let res = '';
		  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
		  for (let i = 0; i < bytes.length - 1; i += 2) {
		    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256));
		  }
		  return res
		}

		Buffer.prototype.slice = function slice (start, end) {
		  const len = this.length;
		  start = ~~start;
		  end = end === undefined ? len : ~~end;

		  if (start < 0) {
		    start += len;
		    if (start < 0) start = 0;
		  } else if (start > len) {
		    start = len;
		  }

		  if (end < 0) {
		    end += len;
		    if (end < 0) end = 0;
		  } else if (end > len) {
		    end = len;
		  }

		  if (end < start) end = start;

		  const newBuf = this.subarray(start, end);
		  // Return an augmented `Uint8Array` instance
		  Object.setPrototypeOf(newBuf, Buffer.prototype);

		  return newBuf
		};

		/*
		 * Need to make sure that buffer isn't trying to write out of bounds.
		 */
		function checkOffset (offset, ext, length) {
		  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
		  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
		}

		Buffer.prototype.readUintLE =
		Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
		  offset = offset >>> 0;
		  byteLength = byteLength >>> 0;
		  if (!noAssert) checkOffset(offset, byteLength, this.length);

		  let val = this[offset];
		  let mul = 1;
		  let i = 0;
		  while (++i < byteLength && (mul *= 0x100)) {
		    val += this[offset + i] * mul;
		  }

		  return val
		};

		Buffer.prototype.readUintBE =
		Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
		  offset = offset >>> 0;
		  byteLength = byteLength >>> 0;
		  if (!noAssert) {
		    checkOffset(offset, byteLength, this.length);
		  }

		  let val = this[offset + --byteLength];
		  let mul = 1;
		  while (byteLength > 0 && (mul *= 0x100)) {
		    val += this[offset + --byteLength] * mul;
		  }

		  return val
		};

		Buffer.prototype.readUint8 =
		Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 1, this.length);
		  return this[offset]
		};

		Buffer.prototype.readUint16LE =
		Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 2, this.length);
		  return this[offset] | (this[offset + 1] << 8)
		};

		Buffer.prototype.readUint16BE =
		Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 2, this.length);
		  return (this[offset] << 8) | this[offset + 1]
		};

		Buffer.prototype.readUint32LE =
		Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 4, this.length);

		  return ((this[offset]) |
		      (this[offset + 1] << 8) |
		      (this[offset + 2] << 16)) +
		      (this[offset + 3] * 0x1000000)
		};

		Buffer.prototype.readUint32BE =
		Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 4, this.length);

		  return (this[offset] * 0x1000000) +
		    ((this[offset + 1] << 16) |
		    (this[offset + 2] << 8) |
		    this[offset + 3])
		};

		Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE (offset) {
		  offset = offset >>> 0;
		  validateNumber(offset, 'offset');
		  const first = this[offset];
		  const last = this[offset + 7];
		  if (first === undefined || last === undefined) {
		    boundsError(offset, this.length - 8);
		  }

		  const lo = first +
		    this[++offset] * 2 ** 8 +
		    this[++offset] * 2 ** 16 +
		    this[++offset] * 2 ** 24;

		  const hi = this[++offset] +
		    this[++offset] * 2 ** 8 +
		    this[++offset] * 2 ** 16 +
		    last * 2 ** 24;

		  return BigInt(lo) + (BigInt(hi) << BigInt(32))
		});

		Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE (offset) {
		  offset = offset >>> 0;
		  validateNumber(offset, 'offset');
		  const first = this[offset];
		  const last = this[offset + 7];
		  if (first === undefined || last === undefined) {
		    boundsError(offset, this.length - 8);
		  }

		  const hi = first * 2 ** 24 +
		    this[++offset] * 2 ** 16 +
		    this[++offset] * 2 ** 8 +
		    this[++offset];

		  const lo = this[++offset] * 2 ** 24 +
		    this[++offset] * 2 ** 16 +
		    this[++offset] * 2 ** 8 +
		    last;

		  return (BigInt(hi) << BigInt(32)) + BigInt(lo)
		});

		Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
		  offset = offset >>> 0;
		  byteLength = byteLength >>> 0;
		  if (!noAssert) checkOffset(offset, byteLength, this.length);

		  let val = this[offset];
		  let mul = 1;
		  let i = 0;
		  while (++i < byteLength && (mul *= 0x100)) {
		    val += this[offset + i] * mul;
		  }
		  mul *= 0x80;

		  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

		  return val
		};

		Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
		  offset = offset >>> 0;
		  byteLength = byteLength >>> 0;
		  if (!noAssert) checkOffset(offset, byteLength, this.length);

		  let i = byteLength;
		  let mul = 1;
		  let val = this[offset + --i];
		  while (i > 0 && (mul *= 0x100)) {
		    val += this[offset + --i] * mul;
		  }
		  mul *= 0x80;

		  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

		  return val
		};

		Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 1, this.length);
		  if (!(this[offset] & 0x80)) return (this[offset])
		  return ((0xff - this[offset] + 1) * -1)
		};

		Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 2, this.length);
		  const val = this[offset] | (this[offset + 1] << 8);
		  return (val & 0x8000) ? val | 0xFFFF0000 : val
		};

		Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 2, this.length);
		  const val = this[offset + 1] | (this[offset] << 8);
		  return (val & 0x8000) ? val | 0xFFFF0000 : val
		};

		Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 4, this.length);

		  return (this[offset]) |
		    (this[offset + 1] << 8) |
		    (this[offset + 2] << 16) |
		    (this[offset + 3] << 24)
		};

		Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 4, this.length);

		  return (this[offset] << 24) |
		    (this[offset + 1] << 16) |
		    (this[offset + 2] << 8) |
		    (this[offset + 3])
		};

		Buffer.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE (offset) {
		  offset = offset >>> 0;
		  validateNumber(offset, 'offset');
		  const first = this[offset];
		  const last = this[offset + 7];
		  if (first === undefined || last === undefined) {
		    boundsError(offset, this.length - 8);
		  }

		  const val = this[offset + 4] +
		    this[offset + 5] * 2 ** 8 +
		    this[offset + 6] * 2 ** 16 +
		    (last << 24); // Overflow

		  return (BigInt(val) << BigInt(32)) +
		    BigInt(first +
		    this[++offset] * 2 ** 8 +
		    this[++offset] * 2 ** 16 +
		    this[++offset] * 2 ** 24)
		});

		Buffer.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE (offset) {
		  offset = offset >>> 0;
		  validateNumber(offset, 'offset');
		  const first = this[offset];
		  const last = this[offset + 7];
		  if (first === undefined || last === undefined) {
		    boundsError(offset, this.length - 8);
		  }

		  const val = (first << 24) + // Overflow
		    this[++offset] * 2 ** 16 +
		    this[++offset] * 2 ** 8 +
		    this[++offset];

		  return (BigInt(val) << BigInt(32)) +
		    BigInt(this[++offset] * 2 ** 24 +
		    this[++offset] * 2 ** 16 +
		    this[++offset] * 2 ** 8 +
		    last)
		});

		Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 4, this.length);
		  return ieee754.read(this, offset, true, 23, 4)
		};

		Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 4, this.length);
		  return ieee754.read(this, offset, false, 23, 4)
		};

		Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 8, this.length);
		  return ieee754.read(this, offset, true, 52, 8)
		};

		Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
		  offset = offset >>> 0;
		  if (!noAssert) checkOffset(offset, 8, this.length);
		  return ieee754.read(this, offset, false, 52, 8)
		};

		function checkInt (buf, value, offset, ext, max, min) {
		  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
		  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
		  if (offset + ext > buf.length) throw new RangeError('Index out of range')
		}

		Buffer.prototype.writeUintLE =
		Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  byteLength = byteLength >>> 0;
		  if (!noAssert) {
		    const maxBytes = Math.pow(2, 8 * byteLength) - 1;
		    checkInt(this, value, offset, byteLength, maxBytes, 0);
		  }

		  let mul = 1;
		  let i = 0;
		  this[offset] = value & 0xFF;
		  while (++i < byteLength && (mul *= 0x100)) {
		    this[offset + i] = (value / mul) & 0xFF;
		  }

		  return offset + byteLength
		};

		Buffer.prototype.writeUintBE =
		Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  byteLength = byteLength >>> 0;
		  if (!noAssert) {
		    const maxBytes = Math.pow(2, 8 * byteLength) - 1;
		    checkInt(this, value, offset, byteLength, maxBytes, 0);
		  }

		  let i = byteLength - 1;
		  let mul = 1;
		  this[offset + i] = value & 0xFF;
		  while (--i >= 0 && (mul *= 0x100)) {
		    this[offset + i] = (value / mul) & 0xFF;
		  }

		  return offset + byteLength
		};

		Buffer.prototype.writeUint8 =
		Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
		  this[offset] = (value & 0xff);
		  return offset + 1
		};

		Buffer.prototype.writeUint16LE =
		Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
		  this[offset] = (value & 0xff);
		  this[offset + 1] = (value >>> 8);
		  return offset + 2
		};

		Buffer.prototype.writeUint16BE =
		Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
		  this[offset] = (value >>> 8);
		  this[offset + 1] = (value & 0xff);
		  return offset + 2
		};

		Buffer.prototype.writeUint32LE =
		Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
		  this[offset + 3] = (value >>> 24);
		  this[offset + 2] = (value >>> 16);
		  this[offset + 1] = (value >>> 8);
		  this[offset] = (value & 0xff);
		  return offset + 4
		};

		Buffer.prototype.writeUint32BE =
		Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
		  this[offset] = (value >>> 24);
		  this[offset + 1] = (value >>> 16);
		  this[offset + 2] = (value >>> 8);
		  this[offset + 3] = (value & 0xff);
		  return offset + 4
		};

		function wrtBigUInt64LE (buf, value, offset, min, max) {
		  checkIntBI(value, min, max, buf, offset, 7);

		  let lo = Number(value & BigInt(0xffffffff));
		  buf[offset++] = lo;
		  lo = lo >> 8;
		  buf[offset++] = lo;
		  lo = lo >> 8;
		  buf[offset++] = lo;
		  lo = lo >> 8;
		  buf[offset++] = lo;
		  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff));
		  buf[offset++] = hi;
		  hi = hi >> 8;
		  buf[offset++] = hi;
		  hi = hi >> 8;
		  buf[offset++] = hi;
		  hi = hi >> 8;
		  buf[offset++] = hi;
		  return offset
		}

		function wrtBigUInt64BE (buf, value, offset, min, max) {
		  checkIntBI(value, min, max, buf, offset, 7);

		  let lo = Number(value & BigInt(0xffffffff));
		  buf[offset + 7] = lo;
		  lo = lo >> 8;
		  buf[offset + 6] = lo;
		  lo = lo >> 8;
		  buf[offset + 5] = lo;
		  lo = lo >> 8;
		  buf[offset + 4] = lo;
		  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff));
		  buf[offset + 3] = hi;
		  hi = hi >> 8;
		  buf[offset + 2] = hi;
		  hi = hi >> 8;
		  buf[offset + 1] = hi;
		  hi = hi >> 8;
		  buf[offset] = hi;
		  return offset + 8
		}

		Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE (value, offset = 0) {
		  return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
		});

		Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE (value, offset = 0) {
		  return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
		});

		Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) {
		    const limit = Math.pow(2, (8 * byteLength) - 1);

		    checkInt(this, value, offset, byteLength, limit - 1, -limit);
		  }

		  let i = 0;
		  let mul = 1;
		  let sub = 0;
		  this[offset] = value & 0xFF;
		  while (++i < byteLength && (mul *= 0x100)) {
		    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
		      sub = 1;
		    }
		    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
		  }

		  return offset + byteLength
		};

		Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) {
		    const limit = Math.pow(2, (8 * byteLength) - 1);

		    checkInt(this, value, offset, byteLength, limit - 1, -limit);
		  }

		  let i = byteLength - 1;
		  let mul = 1;
		  let sub = 0;
		  this[offset + i] = value & 0xFF;
		  while (--i >= 0 && (mul *= 0x100)) {
		    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
		      sub = 1;
		    }
		    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
		  }

		  return offset + byteLength
		};

		Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -128);
		  if (value < 0) value = 0xff + value + 1;
		  this[offset] = (value & 0xff);
		  return offset + 1
		};

		Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -32768);
		  this[offset] = (value & 0xff);
		  this[offset + 1] = (value >>> 8);
		  return offset + 2
		};

		Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -32768);
		  this[offset] = (value >>> 8);
		  this[offset + 1] = (value & 0xff);
		  return offset + 2
		};

		Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -2147483648);
		  this[offset] = (value & 0xff);
		  this[offset + 1] = (value >>> 8);
		  this[offset + 2] = (value >>> 16);
		  this[offset + 3] = (value >>> 24);
		  return offset + 4
		};

		Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -2147483648);
		  if (value < 0) value = 0xffffffff + value + 1;
		  this[offset] = (value >>> 24);
		  this[offset + 1] = (value >>> 16);
		  this[offset + 2] = (value >>> 8);
		  this[offset + 3] = (value & 0xff);
		  return offset + 4
		};

		Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE (value, offset = 0) {
		  return wrtBigUInt64LE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
		});

		Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE (value, offset = 0) {
		  return wrtBigUInt64BE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
		});

		function checkIEEE754 (buf, value, offset, ext, max, min) {
		  if (offset + ext > buf.length) throw new RangeError('Index out of range')
		  if (offset < 0) throw new RangeError('Index out of range')
		}

		function writeFloat (buf, value, offset, littleEndian, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) {
		    checkIEEE754(buf, value, offset, 4);
		  }
		  ieee754.write(buf, value, offset, littleEndian, 23, 4);
		  return offset + 4
		}

		Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
		  return writeFloat(this, value, offset, true, noAssert)
		};

		Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
		  return writeFloat(this, value, offset, false, noAssert)
		};

		function writeDouble (buf, value, offset, littleEndian, noAssert) {
		  value = +value;
		  offset = offset >>> 0;
		  if (!noAssert) {
		    checkIEEE754(buf, value, offset, 8);
		  }
		  ieee754.write(buf, value, offset, littleEndian, 52, 8);
		  return offset + 8
		}

		Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
		  return writeDouble(this, value, offset, true, noAssert)
		};

		Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
		  return writeDouble(this, value, offset, false, noAssert)
		};

		// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
		Buffer.prototype.copy = function copy (target, targetStart, start, end) {
		  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
		  if (!start) start = 0;
		  if (!end && end !== 0) end = this.length;
		  if (targetStart >= target.length) targetStart = target.length;
		  if (!targetStart) targetStart = 0;
		  if (end > 0 && end < start) end = start;

		  // Copy 0 bytes; we're done
		  if (end === start) return 0
		  if (target.length === 0 || this.length === 0) return 0

		  // Fatal error conditions
		  if (targetStart < 0) {
		    throw new RangeError('targetStart out of bounds')
		  }
		  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
		  if (end < 0) throw new RangeError('sourceEnd out of bounds')

		  // Are we oob?
		  if (end > this.length) end = this.length;
		  if (target.length - targetStart < end - start) {
		    end = target.length - targetStart + start;
		  }

		  const len = end - start;

		  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
		    // Use built-in when available, missing from IE11
		    this.copyWithin(targetStart, start, end);
		  } else {
		    Uint8Array.prototype.set.call(
		      target,
		      this.subarray(start, end),
		      targetStart
		    );
		  }

		  return len
		};

		// Usage:
		//    buffer.fill(number[, offset[, end]])
		//    buffer.fill(buffer[, offset[, end]])
		//    buffer.fill(string[, offset[, end]][, encoding])
		Buffer.prototype.fill = function fill (val, start, end, encoding) {
		  // Handle string cases:
		  if (typeof val === 'string') {
		    if (typeof start === 'string') {
		      encoding = start;
		      start = 0;
		      end = this.length;
		    } else if (typeof end === 'string') {
		      encoding = end;
		      end = this.length;
		    }
		    if (encoding !== undefined && typeof encoding !== 'string') {
		      throw new TypeError('encoding must be a string')
		    }
		    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
		      throw new TypeError('Unknown encoding: ' + encoding)
		    }
		    if (val.length === 1) {
		      const code = val.charCodeAt(0);
		      if ((encoding === 'utf8' && code < 128) ||
		          encoding === 'latin1') {
		        // Fast path: If `val` fits into a single byte, use that numeric value.
		        val = code;
		      }
		    }
		  } else if (typeof val === 'number') {
		    val = val & 255;
		  } else if (typeof val === 'boolean') {
		    val = Number(val);
		  }

		  // Invalid ranges are not set to a default, so can range check early.
		  if (start < 0 || this.length < start || this.length < end) {
		    throw new RangeError('Out of range index')
		  }

		  if (end <= start) {
		    return this
		  }

		  start = start >>> 0;
		  end = end === undefined ? this.length : end >>> 0;

		  if (!val) val = 0;

		  let i;
		  if (typeof val === 'number') {
		    for (i = start; i < end; ++i) {
		      this[i] = val;
		    }
		  } else {
		    const bytes = Buffer.isBuffer(val)
		      ? val
		      : Buffer.from(val, encoding);
		    const len = bytes.length;
		    if (len === 0) {
		      throw new TypeError('The value "' + val +
		        '" is invalid for argument "value"')
		    }
		    for (i = 0; i < end - start; ++i) {
		      this[i + start] = bytes[i % len];
		    }
		  }

		  return this
		};

		// CUSTOM ERRORS
		// =============

		// Simplified versions from Node, changed for Buffer-only usage
		const errors = {};
		function E (sym, getMessage, Base) {
		  errors[sym] = class NodeError extends Base {
		    constructor () {
		      super();

		      Object.defineProperty(this, 'message', {
		        value: getMessage.apply(this, arguments),
		        writable: true,
		        configurable: true
		      });

		      // Add the error code to the name to include it in the stack trace.
		      this.name = `${this.name} [${sym}]`;
		      // Access the stack to generate the error message including the error code
		      // from the name.
		      this.stack; // eslint-disable-line no-unused-expressions
		      // Reset the name to the actual name.
		      delete this.name;
		    }

		    get code () {
		      return sym
		    }

		    set code (value) {
		      Object.defineProperty(this, 'code', {
		        configurable: true,
		        enumerable: true,
		        value,
		        writable: true
		      });
		    }

		    toString () {
		      return `${this.name} [${sym}]: ${this.message}`
		    }
		  };
		}

		E('ERR_BUFFER_OUT_OF_BOUNDS',
		  function (name) {
		    if (name) {
		      return `${name} is outside of buffer bounds`
		    }

		    return 'Attempt to access memory outside buffer bounds'
		  }, RangeError);
		E('ERR_INVALID_ARG_TYPE',
		  function (name, actual) {
		    return `The "${name}" argument must be of type number. Received type ${typeof actual}`
		  }, TypeError);
		E('ERR_OUT_OF_RANGE',
		  function (str, range, input) {
		    let msg = `The value of "${str}" is out of range.`;
		    let received = input;
		    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
		      received = addNumericalSeparator(String(input));
		    } else if (typeof input === 'bigint') {
		      received = String(input);
		      if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
		        received = addNumericalSeparator(received);
		      }
		      received += 'n';
		    }
		    msg += ` It must be ${range}. Received ${received}`;
		    return msg
		  }, RangeError);

		function addNumericalSeparator (val) {
		  let res = '';
		  let i = val.length;
		  const start = val[0] === '-' ? 1 : 0;
		  for (; i >= start + 4; i -= 3) {
		    res = `_${val.slice(i - 3, i)}${res}`;
		  }
		  return `${val.slice(0, i)}${res}`
		}

		// CHECK FUNCTIONS
		// ===============

		function checkBounds (buf, offset, byteLength) {
		  validateNumber(offset, 'offset');
		  if (buf[offset] === undefined || buf[offset + byteLength] === undefined) {
		    boundsError(offset, buf.length - (byteLength + 1));
		  }
		}

		function checkIntBI (value, min, max, buf, offset, byteLength) {
		  if (value > max || value < min) {
		    const n = typeof min === 'bigint' ? 'n' : '';
		    let range;
		    {
		      if (min === 0 || min === BigInt(0)) {
		        range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`;
		      } else {
		        range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
		                `${(byteLength + 1) * 8 - 1}${n}`;
		      }
		    }
		    throw new errors.ERR_OUT_OF_RANGE('value', range, value)
		  }
		  checkBounds(buf, offset, byteLength);
		}

		function validateNumber (value, name) {
		  if (typeof value !== 'number') {
		    throw new errors.ERR_INVALID_ARG_TYPE(name, 'number', value)
		  }
		}

		function boundsError (value, length, type) {
		  if (Math.floor(value) !== value) {
		    validateNumber(value, type);
		    throw new errors.ERR_OUT_OF_RANGE('offset', 'an integer', value)
		  }

		  if (length < 0) {
		    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS()
		  }

		  throw new errors.ERR_OUT_OF_RANGE('offset',
		                                    `>= ${0} and <= ${length}`,
		                                    value)
		}

		// HELPER FUNCTIONS
		// ================

		const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

		function base64clean (str) {
		  // Node takes equal signs as end of the Base64 encoding
		  str = str.split('=')[0];
		  // Node strips out invalid characters like \n and \t from the string, base64-js does not
		  str = str.trim().replace(INVALID_BASE64_RE, '');
		  // Node converts strings with length < 2 to ''
		  if (str.length < 2) return ''
		  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
		  while (str.length % 4 !== 0) {
		    str = str + '=';
		  }
		  return str
		}

		function utf8ToBytes (string, units) {
		  units = units || Infinity;
		  let codePoint;
		  const length = string.length;
		  let leadSurrogate = null;
		  const bytes = [];

		  for (let i = 0; i < length; ++i) {
		    codePoint = string.charCodeAt(i);

		    // is surrogate component
		    if (codePoint > 0xD7FF && codePoint < 0xE000) {
		      // last char was a lead
		      if (!leadSurrogate) {
		        // no lead yet
		        if (codePoint > 0xDBFF) {
		          // unexpected trail
		          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
		          continue
		        } else if (i + 1 === length) {
		          // unpaired lead
		          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
		          continue
		        }

		        // valid lead
		        leadSurrogate = codePoint;

		        continue
		      }

		      // 2 leads in a row
		      if (codePoint < 0xDC00) {
		        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
		        leadSurrogate = codePoint;
		        continue
		      }

		      // valid surrogate pair
		      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
		    } else if (leadSurrogate) {
		      // valid bmp char, but last char was a lead
		      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
		    }

		    leadSurrogate = null;

		    // encode utf8
		    if (codePoint < 0x80) {
		      if ((units -= 1) < 0) break
		      bytes.push(codePoint);
		    } else if (codePoint < 0x800) {
		      if ((units -= 2) < 0) break
		      bytes.push(
		        codePoint >> 0x6 | 0xC0,
		        codePoint & 0x3F | 0x80
		      );
		    } else if (codePoint < 0x10000) {
		      if ((units -= 3) < 0) break
		      bytes.push(
		        codePoint >> 0xC | 0xE0,
		        codePoint >> 0x6 & 0x3F | 0x80,
		        codePoint & 0x3F | 0x80
		      );
		    } else if (codePoint < 0x110000) {
		      if ((units -= 4) < 0) break
		      bytes.push(
		        codePoint >> 0x12 | 0xF0,
		        codePoint >> 0xC & 0x3F | 0x80,
		        codePoint >> 0x6 & 0x3F | 0x80,
		        codePoint & 0x3F | 0x80
		      );
		    } else {
		      throw new Error('Invalid code point')
		    }
		  }

		  return bytes
		}

		function asciiToBytes (str) {
		  const byteArray = [];
		  for (let i = 0; i < str.length; ++i) {
		    // Node's code seems to be doing this and not & 0x7F..
		    byteArray.push(str.charCodeAt(i) & 0xFF);
		  }
		  return byteArray
		}

		function utf16leToBytes (str, units) {
		  let c, hi, lo;
		  const byteArray = [];
		  for (let i = 0; i < str.length; ++i) {
		    if ((units -= 2) < 0) break

		    c = str.charCodeAt(i);
		    hi = c >> 8;
		    lo = c % 256;
		    byteArray.push(lo);
		    byteArray.push(hi);
		  }

		  return byteArray
		}

		function base64ToBytes (str) {
		  return base64.toByteArray(base64clean(str))
		}

		function blitBuffer (src, dst, offset, length) {
		  let i;
		  for (i = 0; i < length; ++i) {
		    if ((i + offset >= dst.length) || (i >= src.length)) break
		    dst[i + offset] = src[i];
		  }
		  return i
		}

		// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
		// the `instanceof` check but they should be treated as of that type.
		// See: https://github.com/feross/buffer/issues/166
		function isInstance (obj, type) {
		  return obj instanceof type ||
		    (obj != null && obj.constructor != null && obj.constructor.name != null &&
		      obj.constructor.name === type.name)
		}
		function numberIsNaN (obj) {
		  // For IE11 support
		  return obj !== obj // eslint-disable-line no-self-compare
		}

		// Create lookup table for `toString('hex')`
		// See: https://github.com/feross/buffer/issues/219
		const hexSliceLookupTable = (function () {
		  const alphabet = '0123456789abcdef';
		  const table = new Array(256);
		  for (let i = 0; i < 16; ++i) {
		    const i16 = i * 16;
		    for (let j = 0; j < 16; ++j) {
		      table[i16 + j] = alphabet[i] + alphabet[j];
		    }
		  }
		  return table
		})();

		// Return not function with Error if BigInt not supported
		function defineBigIntMethod (fn) {
		  return typeof BigInt === 'undefined' ? BufferBigIntNotDefined : fn
		}

		function BufferBigIntNotDefined () {
		  throw new Error('BigInt not supported')
		} 
	} (buffer));
	return buffer;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var identifiers;
var hasRequiredIdentifiers;

function requireIdentifiers () {
	if (hasRequiredIdentifiers) return identifiers;
	hasRequiredIdentifiers = 1;
	// This module exposes a list of named identifiers, shared across the parser generator
	// and the parsers that are generated.

	identifiers = {
	  // Identifies the operator type. Used by the generator
	  // to indicate operator types in the grammar object.
	  // Used by the [parser](./parser.html) when interpreting the grammar object.
	  /* the original ABNF operators */
	  ALT: 1 /* alternation */,
	  CAT: 2 /* concatenation */,
	  REP: 3 /* repetition */,
	  RNM: 4 /* rule name */,
	  TRG: 5 /* terminal range */,
	  TBS: 6 /* terminal binary string, case sensitive */,
	  TLS: 7 /* terminal literal string, case insensitive */,
	  /* the super set, SABNF operators */
	  UDT: 11 /* user-defined terminal */,
	  AND: 12 /* positive look ahead */,
	  NOT: 13 /* negative look ahead */,
	  BKR: 14 /* back reference to a previously matched rule name */,
	  BKA: 15 /* positive look behind */,
	  BKN: 16 /* negative look behind */,
	  ABG: 17 /* anchor - begin of string */,
	  AEN: 18 /* anchor - end of string */,
	  // Used by the parser and the user's `RNM` and `UDT` callback functions.
	  // Identifies the parser state as it traverses the parse tree nodes.
	  // - *ACTIVE* - indicates the downward direction through the parse tree node.
	  // - *MATCH* - indicates the upward direction and a phrase, of length \> 0, has been successfully matched
	  // - *EMPTY* - indicates the upward direction and a phrase, of length = 0, has been successfully matched
	  // - *NOMATCH* - indicates the upward direction and the parser failed to match any phrase at all
	  ACTIVE: 100,
	  MATCH: 101,
	  EMPTY: 102,
	  NOMATCH: 103,
	  // Used by [`AST` translator](./ast.html) (semantic analysis) and the user's callback functions
	  // to indicate the direction of flow through the `AST` nodes.
	  // - *SEM_PRE* - indicates the downward (pre-branch) direction through the `AST` node.
	  // - *SEM_POST* - indicates the upward (post-branch) direction through the `AST` node.
	  SEM_PRE: 200,
	  SEM_POST: 201,
	  // Used by the user's callback functions to indicate to the `AST` translator (semantic analysis) how to proceed.
	  // - *SEM_OK* - normal return value
	  // - *SEM_SKIP* - if a callback function returns this value from the SEM_PRE state,
	  // the translator will skip processing all `AST` nodes in the branch below the current node.
	  // Ignored if returned from the SEM_POST state.
	  SEM_OK: 300,
	  SEM_SKIP: 301,
	  // Used in attribute generation to distinguish the necessary attribute categories.
	  // - *ATTR_N* - non-recursive
	  // - *ATTR_R* - recursive
	  // - *ATTR_MR* - belongs to a mutually-recursive set
	  ATTR_N: 400,
	  ATTR_R: 401,
	  ATTR_MR: 402,
	  // Look around values indicate whether the parser is in look ahead or look behind mode.
	  // Used by the tracing facility to indicate the look around mode in the trace records display.
	  // - *LOOKAROUND_NONE* - the parser is in normal parsing mode
	  // - *LOOKAROUND_AHEAD* - the parse is in look-ahead mode, phrase matching for operator `AND(&)` or `NOT(!)`
	  // - *LOOKAROUND_BEHIND* - the parse is in look-behind mode, phrase matching for operator `BKA(&&)` or `BKN(!!)`
	  LOOKAROUND_NONE: 500,
	  LOOKAROUND_AHEAD: 501,
	  LOOKAROUND_BEHIND: 502,
	  // Back reference rule mode indicators
	  // - *BKR_MODE_UM* - the back reference is using universal mode
	  // - *BKR_MODE_PM* - the back reference is using parent frame mode
	  // - *BKR_MODE_CS* - the back reference is using case-sensitive phrase matching
	  // - *BKR_MODE_CI* - the back reference is using case-insensitive phrase matching
	  BKR_MODE_UM: 601,
	  BKR_MODE_PM: 602,
	  BKR_MODE_CS: 603,
	  BKR_MODE_CI: 604,
	};
	return identifiers;
}

var utilities = {};

var style;
var hasRequiredStyle;

function requireStyle () {
	if (hasRequiredStyle) return style;
	hasRequiredStyle = 1;
	style = {

	  // Generated by apglib/style.js 
	  CLASS_MONOSPACE: 'apg-mono',
	  CLASS_ACTIVE: 'apg-active',
	  CLASS_EMPTY: 'apg-empty',
	  CLASS_MATCH: 'apg-match',
	  CLASS_NOMATCH: 'apg-nomatch',
	  CLASS_LOOKAHEAD: 'apg-lh-match',
	  CLASS_LOOKBEHIND: 'apg-lb-match',
	  CLASS_REMAINDER: 'apg-remainder',
	  CLASS_CTRLCHAR: 'apg-ctrl-char',
	  CLASS_LINEEND: 'apg-line-end',
	  CLASS_ERROR: 'apg-error',
	  CLASS_PHRASE: 'apg-phrase',
	  CLASS_EMPTYPHRASE: 'apg-empty-phrase',
	  CLASS_STATE: 'apg-state',
	  CLASS_STATS: 'apg-stats',
	  CLASS_TRACE: 'apg-trace',
	  CLASS_GRAMMAR: 'apg-grammar',
	  CLASS_RULES: 'apg-rules',
	  CLASS_RULESLINK: 'apg-rules-link',
	  CLASS_ATTRIBUTES: 'apg-attrs',
	};
	return style;
}

var converter = {};

var transformers = {};

/* eslint-disable prefer-destructuring */

var hasRequiredTransformers;

function requireTransformers () {
	if (hasRequiredTransformers) return transformers;
	hasRequiredTransformers = 1;
	(function (exports) {
		/* eslint-disable no-plusplus */
		/* eslint-disable no-bitwise */
		/*  *************************************************************************************
		 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
		 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
		 *   ********************************************************************************* */
		// This module contains the actual encoding and decoding algorithms.
		// Throws "RangeError" exceptions on characters or bytes out of range for the given encoding.

		'use strict;';

		const { Buffer } = requireBuffer();

		/* decoding error codes */
		const NON_SHORTEST = 0xfffffffc;
		const TRAILING = 0xfffffffd;
		const RANGE = 0xfffffffe;
		const ILL_FORMED = 0xffffffff;

		/* mask[n] = 2**n - 1, ie. mask[n] = n bits on. e.g. mask[6] = %b111111 */
		const mask = [0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023];

		/* ascii[n] = 'HH', where 0xHH = n, eg. ascii[254] = 'FE' */
		const ascii = [
		  '00',
		  '01',
		  '02',
		  '03',
		  '04',
		  '05',
		  '06',
		  '07',
		  '08',
		  '09',
		  '0A',
		  '0B',
		  '0C',
		  '0D',
		  '0E',
		  '0F',
		  '10',
		  '11',
		  '12',
		  '13',
		  '14',
		  '15',
		  '16',
		  '17',
		  '18',
		  '19',
		  '1A',
		  '1B',
		  '1C',
		  '1D',
		  '1E',
		  '1F',
		  '20',
		  '21',
		  '22',
		  '23',
		  '24',
		  '25',
		  '26',
		  '27',
		  '28',
		  '29',
		  '2A',
		  '2B',
		  '2C',
		  '2D',
		  '2E',
		  '2F',
		  '30',
		  '31',
		  '32',
		  '33',
		  '34',
		  '35',
		  '36',
		  '37',
		  '38',
		  '39',
		  '3A',
		  '3B',
		  '3C',
		  '3D',
		  '3E',
		  '3F',
		  '40',
		  '41',
		  '42',
		  '43',
		  '44',
		  '45',
		  '46',
		  '47',
		  '48',
		  '49',
		  '4A',
		  '4B',
		  '4C',
		  '4D',
		  '4E',
		  '4F',
		  '50',
		  '51',
		  '52',
		  '53',
		  '54',
		  '55',
		  '56',
		  '57',
		  '58',
		  '59',
		  '5A',
		  '5B',
		  '5C',
		  '5D',
		  '5E',
		  '5F',
		  '60',
		  '61',
		  '62',
		  '63',
		  '64',
		  '65',
		  '66',
		  '67',
		  '68',
		  '69',
		  '6A',
		  '6B',
		  '6C',
		  '6D',
		  '6E',
		  '6F',
		  '70',
		  '71',
		  '72',
		  '73',
		  '74',
		  '75',
		  '76',
		  '77',
		  '78',
		  '79',
		  '7A',
		  '7B',
		  '7C',
		  '7D',
		  '7E',
		  '7F',
		  '80',
		  '81',
		  '82',
		  '83',
		  '84',
		  '85',
		  '86',
		  '87',
		  '88',
		  '89',
		  '8A',
		  '8B',
		  '8C',
		  '8D',
		  '8E',
		  '8F',
		  '90',
		  '91',
		  '92',
		  '93',
		  '94',
		  '95',
		  '96',
		  '97',
		  '98',
		  '99',
		  '9A',
		  '9B',
		  '9C',
		  '9D',
		  '9E',
		  '9F',
		  'A0',
		  'A1',
		  'A2',
		  'A3',
		  'A4',
		  'A5',
		  'A6',
		  'A7',
		  'A8',
		  'A9',
		  'AA',
		  'AB',
		  'AC',
		  'AD',
		  'AE',
		  'AF',
		  'B0',
		  'B1',
		  'B2',
		  'B3',
		  'B4',
		  'B5',
		  'B6',
		  'B7',
		  'B8',
		  'B9',
		  'BA',
		  'BB',
		  'BC',
		  'BD',
		  'BE',
		  'BF',
		  'C0',
		  'C1',
		  'C2',
		  'C3',
		  'C4',
		  'C5',
		  'C6',
		  'C7',
		  'C8',
		  'C9',
		  'CA',
		  'CB',
		  'CC',
		  'CD',
		  'CE',
		  'CF',
		  'D0',
		  'D1',
		  'D2',
		  'D3',
		  'D4',
		  'D5',
		  'D6',
		  'D7',
		  'D8',
		  'D9',
		  'DA',
		  'DB',
		  'DC',
		  'DD',
		  'DE',
		  'DF',
		  'E0',
		  'E1',
		  'E2',
		  'E3',
		  'E4',
		  'E5',
		  'E6',
		  'E7',
		  'E8',
		  'E9',
		  'EA',
		  'EB',
		  'EC',
		  'ED',
		  'EE',
		  'EF',
		  'F0',
		  'F1',
		  'F2',
		  'F3',
		  'F4',
		  'F5',
		  'F6',
		  'F7',
		  'F8',
		  'F9',
		  'FA',
		  'FB',
		  'FC',
		  'FD',
		  'FE',
		  'FF',
		];

		/* vector of base 64 characters */
		const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split('');

		/* vector of base 64 character codes */
		const base64codes = [];
		base64chars.forEach((char) => {
		  base64codes.push(char.charCodeAt(0));
		});

		// The UTF8 algorithms.
		exports.utf8 = {
		  encode(chars) {
		    const bytes = [];
		    chars.forEach((char) => {
		      if (char >= 0 && char <= 0x7f) {
		        bytes.push(char);
		      } else if (char <= 0x7ff) {
		        bytes.push(0xc0 + ((char >> 6) & mask[5]));
		        bytes.push(0x80 + (char & mask[6]));
		      } else if (char < 0xd800 || (char > 0xdfff && char <= 0xffff)) {
		        bytes.push(0xe0 + ((char >> 12) & mask[4]));
		        bytes.push(0x80 + ((char >> 6) & mask[6]));
		        bytes.push(0x80 + (char & mask[6]));
		      } else if (char >= 0x10000 && char <= 0x10ffff) {
		        const u = (char >> 16) & mask[5];
		        bytes.push(0xf0 + (u >> 2));
		        bytes.push(0x80 + ((u & mask[2]) << 4) + ((char >> 12) & mask[4]));
		        bytes.push(0x80 + ((char >> 6) & mask[6]));
		        bytes.push(0x80 + (char & mask[6]));
		      } else {
		        throw new RangeError(`utf8.encode: character out of range: char: ${char}`);
		      }
		    });
		    return Buffer.from(bytes);
		  },
		  decode(buf, bom) {
		    /* bytes functions return error for non-shortest forms & values out of range */
		    function bytes2(b1, b2) {
		      /* U+0080..U+07FF */
		      /* 00000000 00000yyy yyxxxxxx | 110yyyyy 10xxxxxx */
		      if ((b2 & 0xc0) !== 0x80) {
		        return TRAILING;
		      }
		      const x = ((b1 & mask[5]) << 6) + (b2 & mask[6]);
		      if (x < 0x80) {
		        return NON_SHORTEST;
		      }
		      return x;
		    }
		    function bytes3(b1, b2, b3) {
		      /* U+0800..U+FFFF */
		      /* 00000000 zzzzyyyy yyxxxxxx | 1110zzzz 10yyyyyy 10xxxxxx */
		      if ((b3 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) {
		        return TRAILING;
		      }
		      const x = ((b1 & mask[4]) << 12) + ((b2 & mask[6]) << 6) + (b3 & mask[6]);
		      if (x < 0x800) {
		        return NON_SHORTEST;
		      }
		      if (x >= 0xd800 && x <= 0xdfff) {
		        return RANGE;
		      }
		      return x;
		    }
		    function bytes4(b1, b2, b3, b4) {
		      /* U+10000..U+10FFFF */
		      /* 000uuuuu zzzzyyyy yyxxxxxx | 11110uuu 10uuzzzz 10yyyyyy 10xxxxxx */
		      if ((b4 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) {
		        return TRAILING;
		      }
		      const x =
		        ((((b1 & mask[3]) << 2) + ((b2 >> 4) & mask[2])) << 16) +
		        ((b2 & mask[4]) << 12) +
		        ((b3 & mask[6]) << 6) +
		        (b4 & mask[6]);
		      if (x < 0x10000) {
		        return NON_SHORTEST;
		      }
		      if (x > 0x10ffff) {
		        return RANGE;
		      }
		      return x;
		    }
		    let c;
		    let b1;
		    let i1;
		    let i2;
		    let i3;
		    let inc;
		    const len = buf.length;
		    let i = bom ? 3 : 0;
		    const chars = [];
		    while (i < len) {
		      b1 = buf[i];
		      c = ILL_FORMED;
		      const TRUE = true;
		      while (TRUE) {
		        if (b1 >= 0 && b1 <= 0x7f) {
		          /* U+0000..U+007F 00..7F */
		          c = b1;
		          inc = 1;
		          break;
		        }
		        i1 = i + 1;
		        if (i1 < len && b1 >= 0xc2 && b1 <= 0xdf) {
		          /* U+0080..U+07FF C2..DF 80..BF */
		          c = bytes2(b1, buf[i1]);
		          inc = 2;
		          break;
		        }
		        i2 = i + 2;
		        if (i2 < len && b1 >= 0xe0 && b1 <= 0xef) {
		          /* U+0800..U+FFFF */
		          c = bytes3(b1, buf[i1], buf[i2]);
		          inc = 3;
		          break;
		        }
		        i3 = i + 3;
		        if (i3 < len && b1 >= 0xf0 && b1 <= 0xf4) {
		          /* U+10000..U+10FFFF */
		          c = bytes4(b1, buf[i1], buf[i2], buf[i3]);
		          inc = 4;
		          break;
		        }
		        /* if we fall through to here, it is an ill-formed sequence */
		        break;
		      }
		      if (c > 0x10ffff) {
		        const at = `byte[${i}]`;
		        if (c === ILL_FORMED) {
		          throw new RangeError(`utf8.decode: ill-formed UTF8 byte sequence found at: ${at}`);
		        }
		        if (c === TRAILING) {
		          throw new RangeError(`utf8.decode: illegal trailing byte found at: ${at}`);
		        }
		        if (c === RANGE) {
		          throw new RangeError(`utf8.decode: code point out of range found at: ${at}`);
		        }
		        if (c === NON_SHORTEST) {
		          throw new RangeError(`utf8.decode: non-shortest form found at: ${at}`);
		        }
		        throw new RangeError(`utf8.decode: unrecognized error found at: ${at}`);
		      }
		      chars.push(c);
		      i += inc;
		    }
		    return chars;
		  },
		};

		// The UTF16BE algorithms.
		exports.utf16be = {
		  encode(chars) {
		    const bytes = [];
		    let char;
		    let h;
		    let l;
		    for (let i = 0; i < chars.length; i += 1) {
		      char = chars[i];
		      if ((char >= 0 && char <= 0xd7ff) || (char >= 0xe000 && char <= 0xffff)) {
		        bytes.push((char >> 8) & mask[8]);
		        bytes.push(char & mask[8]);
		      } else if (char >= 0x10000 && char <= 0x10ffff) {
		        l = char - 0x10000;
		        h = 0xd800 + (l >> 10);
		        l = 0xdc00 + (l & mask[10]);
		        bytes.push((h >> 8) & mask[8]);
		        bytes.push(h & mask[8]);
		        bytes.push((l >> 8) & mask[8]);
		        bytes.push(l & mask[8]);
		      } else {
		        throw new RangeError(`utf16be.encode: UTF16BE value out of range: char[${i}]: ${char}`);
		      }
		    }
		    return Buffer.from(bytes);
		  },
		  decode(buf, bom) {
		    /* assumes caller has insured that buf is a Buffer of bytes */
		    if (buf.length % 2 > 0) {
		      throw new RangeError(`utf16be.decode: data length must be even multiple of 2: length: ${buf.length}`);
		    }
		    const chars = [];
		    const len = buf.length;
		    let i = bom ? 2 : 0;
		    let j = 0;
		    let c;
		    let inc;
		    let i1;
		    let i3;
		    let high;
		    let low;
		    while (i < len) {
		      const TRUE = true;
		      while (TRUE) {
		        i1 = i + 1;
		        if (i1 < len) {
		          high = (buf[i] << 8) + buf[i1];
		          if (high < 0xd800 || high > 0xdfff) {
		            c = high;
		            inc = 2;
		            break;
		          }
		          i3 = i + 3;
		          if (i3 < len) {
		            low = (buf[i + 2] << 8) + buf[i3];
		            if (high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) {
		              c = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
		              inc = 4;
		              break;
		            }
		          }
		        }
		        /* if we fall through to here, it is an ill-formed sequence */
		        throw new RangeError(`utf16be.decode: ill-formed UTF16BE byte sequence found: byte[${i}]`);
		      }
		      chars[j++] = c;
		      i += inc;
		    }
		    return chars;
		  },
		};

		// The UTF16LE algorithms.
		exports.utf16le = {
		  encode(chars) {
		    const bytes = [];
		    let char;
		    let h;
		    let l;
		    for (let i = 0; i < chars.length; i += 1) {
		      char = chars[i];
		      if ((char >= 0 && char <= 0xd7ff) || (char >= 0xe000 && char <= 0xffff)) {
		        bytes.push(char & mask[8]);
		        bytes.push((char >> 8) & mask[8]);
		      } else if (char >= 0x10000 && char <= 0x10ffff) {
		        l = char - 0x10000;
		        h = 0xd800 + (l >> 10);
		        l = 0xdc00 + (l & mask[10]);
		        bytes.push(h & mask[8]);
		        bytes.push((h >> 8) & mask[8]);
		        bytes.push(l & mask[8]);
		        bytes.push((l >> 8) & mask[8]);
		      } else {
		        throw new RangeError(`utf16le.encode: UTF16LE value out of range: char[${i}]: ${char}`);
		      }
		    }
		    return Buffer.from(bytes);
		  },
		  decode(buf, bom) {
		    /* assumes caller has insured that buf is a Buffer of bytes */
		    if (buf.length % 2 > 0) {
		      throw new RangeError(`utf16le.decode: data length must be even multiple of 2: length: ${buf.length}`);
		    }
		    const chars = [];
		    const len = buf.length;
		    let i = bom ? 2 : 0;
		    let j = 0;
		    let c;
		    let inc;
		    let i1;
		    let i3;
		    let high;
		    let low;
		    while (i < len) {
		      const TRUE = true;
		      while (TRUE) {
		        i1 = i + 1;
		        if (i1 < len) {
		          high = (buf[i1] << 8) + buf[i];
		          if (high < 0xd800 || high > 0xdfff) {
		            c = high;
		            inc = 2;
		            break;
		          }
		          i3 = i + 3;
		          if (i3 < len) {
		            low = (buf[i3] << 8) + buf[i + 2];
		            if (high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) {
		              c = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
		              inc = 4;
		              break;
		            }
		          }
		        }
		        /* if we fall through to here, it is an ill-formed sequence */
		        throw new RangeError(`utf16le.decode: ill-formed UTF16LE byte sequence found: byte[${i}]`);
		      }
		      chars[j++] = c;
		      i += inc;
		    }
		    return chars;
		  },
		};

		// The UTF32BE algorithms.
		exports.utf32be = {
		  encode(chars) {
		    const buf = Buffer.alloc(chars.length * 4);
		    let i = 0;
		    chars.forEach((char) => {
		      if ((char >= 0xd800 && char <= 0xdfff) || char > 0x10ffff) {
		        throw new RangeError(`utf32be.encode: UTF32BE character code out of range: char[${i / 4}]: ${char}`);
		      }
		      buf[i++] = (char >> 24) & mask[8];
		      buf[i++] = (char >> 16) & mask[8];
		      buf[i++] = (char >> 8) & mask[8];
		      buf[i++] = char & mask[8];
		    });
		    return buf;
		  },
		  decode(buf, bom) {
		    /* caller to insure buf is a Buffer of bytes */
		    if (buf.length % 4 > 0) {
		      throw new RangeError(`utf32be.decode: UTF32BE byte length must be even multiple of 4: length: ${buf.length}`);
		    }
		    const chars = [];
		    let i = bom ? 4 : 0;
		    for (; i < buf.length; i += 4) {
		      const char = (buf[i] << 24) + (buf[i + 1] << 16) + (buf[i + 2] << 8) + buf[i + 3];
		      if ((char >= 0xd800 && char <= 0xdfff) || char > 0x10ffff) {
		        throw new RangeError(`utf32be.decode: UTF32BE character code out of range: char[${i / 4}]: ${char}`);
		      }
		      chars.push(char);
		    }
		    return chars;
		  },
		};

		// The UTF32LE algorithms.
		exports.utf32le = {
		  encode(chars) {
		    const buf = Buffer.alloc(chars.length * 4);
		    let i = 0;
		    chars.forEach((char) => {
		      if ((char >= 0xd800 && char <= 0xdfff) || char > 0x10ffff) {
		        throw new RangeError(`utf32le.encode: UTF32LE character code out of range: char[${i / 4}]: ${char}`);
		      }
		      buf[i++] = char & mask[8];
		      buf[i++] = (char >> 8) & mask[8];
		      buf[i++] = (char >> 16) & mask[8];
		      buf[i++] = (char >> 24) & mask[8];
		    });
		    return buf;
		  },
		  decode(buf, bom) {
		    /* caller to insure buf is a Buffer of bytes */
		    if (buf.length % 4 > 0) {
		      throw new RangeError(`utf32be.decode: UTF32LE byte length must be even multiple of 4: length: ${buf.length}`);
		    }
		    const chars = [];
		    let i = bom ? 4 : 0;
		    for (; i < buf.length; i += 4) {
		      const char = (buf[i + 3] << 24) + (buf[i + 2] << 16) + (buf[i + 1] << 8) + buf[i];
		      if ((char >= 0xd800 && char <= 0xdfff) || char > 0x10ffff) {
		        throw new RangeError(`utf32le.encode: UTF32LE character code out of range: char[${i / 4}]: ${char}`);
		      }
		      chars.push(char);
		    }
		    return chars;
		  },
		};

		// The UINT7 algorithms. ASCII or 7-bit unsigned integers.
		exports.uint7 = {
		  encode(chars) {
		    const buf = Buffer.alloc(chars.length);
		    for (let i = 0; i < chars.length; i += 1) {
		      if (chars[i] > 0x7f) {
		        throw new RangeError(`uint7.encode: UINT7 character code out of range: char[${i}]: ${chars[i]}`);
		      }
		      buf[i] = chars[i];
		    }
		    return buf;
		  },
		  decode(buf) {
		    const chars = [];
		    for (let i = 0; i < buf.length; i += 1) {
		      if (buf[i] > 0x7f) {
		        throw new RangeError(`uint7.decode: UINT7 character code out of range: byte[${i}]: ${buf[i]}`);
		      }
		      chars[i] = buf[i];
		    }
		    return chars;
		  },
		};

		// The UINT8 algorithms. BINARY, Latin 1 or 8-bit unsigned integers.
		exports.uint8 = {
		  encode(chars) {
		    const buf = Buffer.alloc(chars.length);
		    for (let i = 0; i < chars.length; i += 1) {
		      if (chars[i] > 0xff) {
		        throw new RangeError(`uint8.encode: UINT8 character code out of range: char[${i}]: ${chars[i]}`);
		      }
		      buf[i] = chars[i];
		    }
		    return buf;
		  },
		  decode(buf) {
		    const chars = [];
		    for (let i = 0; i < buf.length; i += 1) {
		      chars[i] = buf[i];
		    }
		    return chars;
		  },
		};

		// The UINT16BE algorithms. Big-endian 16-bit unsigned integers.
		exports.uint16be = {
		  encode(chars) {
		    const buf = Buffer.alloc(chars.length * 2);
		    let i = 0;
		    chars.forEach((char) => {
		      if (char > 0xffff) {
		        throw new RangeError(`uint16be.encode: UINT16BE character code out of range: char[${i / 2}]: ${char}`);
		      }
		      buf[i++] = (char >> 8) & mask[8];
		      buf[i++] = char & mask[8];
		    });
		    return buf;
		  },
		  decode(buf) {
		    if (buf.length % 2 > 0) {
		      throw new RangeError(`uint16be.decode: UINT16BE byte length must be even multiple of 2: length: ${buf.length}`);
		    }
		    const chars = [];
		    for (let i = 0; i < buf.length; i += 2) {
		      chars.push((buf[i] << 8) + buf[i + 1]);
		    }
		    return chars;
		  },
		};

		// The UINT16LE algorithms. Little-endian 16-bit unsigned integers.
		exports.uint16le = {
		  encode(chars) {
		    const buf = Buffer.alloc(chars.length * 2);
		    let i = 0;
		    chars.forEach((char) => {
		      if (char > 0xffff) {
		        throw new RangeError(`uint16le.encode: UINT16LE character code out of range: char[${i / 2}]: ${char}`);
		      }
		      buf[i++] = char & mask[8];
		      buf[i++] = (char >> 8) & mask[8];
		    });
		    return buf;
		  },
		  decode(buf) {
		    if (buf.length % 2 > 0) {
		      throw new RangeError(`uint16le.decode: UINT16LE byte length must be even multiple of 2: length: ${buf.length}`);
		    }
		    const chars = [];
		    for (let i = 0; i < buf.length; i += 2) {
		      chars.push((buf[i + 1] << 8) + buf[i]);
		    }
		    return chars;
		  },
		};

		// The UINT32BE algorithms. Big-endian 32-bit unsigned integers.
		exports.uint32be = {
		  encode(chars) {
		    const buf = Buffer.alloc(chars.length * 4);
		    let i = 0;
		    chars.forEach((char) => {
		      buf[i++] = (char >> 24) & mask[8];
		      buf[i++] = (char >> 16) & mask[8];
		      buf[i++] = (char >> 8) & mask[8];
		      buf[i++] = char & mask[8];
		    });
		    return buf;
		  },
		  decode(buf) {
		    if (buf.length % 4 > 0) {
		      throw new RangeError(`uint32be.decode: UINT32BE byte length must be even multiple of 4: length: ${buf.length}`);
		    }
		    const chars = [];
		    for (let i = 0; i < buf.length; i += 4) {
		      chars.push((buf[i] << 24) + (buf[i + 1] << 16) + (buf[i + 2] << 8) + buf[i + 3]);
		    }
		    return chars;
		  },
		};

		// The UINT32LE algorithms. Little-endian 32-bit unsigned integers.
		exports.uint32le = {
		  encode(chars) {
		    const buf = Buffer.alloc(chars.length * 4);
		    let i = 0;
		    chars.forEach((char) => {
		      buf[i++] = char & mask[8];
		      buf[i++] = (char >> 8) & mask[8];
		      buf[i++] = (char >> 16) & mask[8];
		      buf[i++] = (char >> 24) & mask[8];
		    });
		    return buf;
		  },
		  decode(buf) {
		    /* caller to insure buf is a Buffer of bytes */
		    if (buf.length % 4 > 0) {
		      throw new RangeError(`uint32le.decode: UINT32LE byte length must be even multiple of 4: length: ${buf.length}`);
		    }
		    const chars = [];
		    for (let i = 0; i < buf.length; i += 4) {
		      chars.push((buf[i + 3] << 24) + (buf[i + 2] << 16) + (buf[i + 1] << 8) + buf[i]);
		    }
		    return chars;
		  },
		};

		// The STRING algorithms. Converts JavaScript strings to Array of 32-bit integers and vice versa.
		// Uses the node.js Buffer's native "utf16le" capabilites.
		exports.string = {
		  encode(chars) {
		    return exports.utf16le.encode(chars).toString('utf16le');
		  },
		  decode(str) {
		    return exports.utf16le.decode(Buffer.from(str, 'utf16le'), 0);
		  },
		};

		// The ESCAPED algorithms.
		// Note that ESCAPED format contains only ASCII characters.
		// The characters are always in the form of a Buffer of bytes.
		exports.escaped = {
		  // Encodes an Array of 32-bit integers into ESCAPED format.
		  encode(chars) {
		    const bytes = [];
		    for (let i = 0; i < chars.length; i += 1) {
		      const char = chars[i];
		      if (char === 96) {
		        bytes.push(char);
		        bytes.push(char);
		      } else if (char === 10) {
		        bytes.push(char);
		      } else if (char >= 32 && char <= 126) {
		        bytes.push(char);
		      } else {
		        let str = '';
		        if (char >= 0 && char <= 31) {
		          str += `\`x${ascii[char]}`;
		        } else if (char >= 127 && char <= 255) {
		          str += `\`x${ascii[char]}`;
		        } else if (char >= 0x100 && char <= 0xffff) {
		          str += `\`u${ascii[(char >> 8) & mask[8]]}${ascii[char & mask[8]]}`;
		        } else if (char >= 0x10000 && char <= 0xffffffff) {
		          str += '`u{';
		          const digit = (char >> 24) & mask[8];
		          if (digit > 0) {
		            str += ascii[digit];
		          }
		          str += `${ascii[(char >> 16) & mask[8]] + ascii[(char >> 8) & mask[8]] + ascii[char & mask[8]]}}`;
		        } else {
		          throw new Error('escape.encode(char): char > 0xffffffff not allowed');
		        }
		        const buf = Buffer.from(str);
		        buf.forEach((b) => {
		          bytes.push(b);
		        });
		      }
		    }
		    return Buffer.from(bytes);
		  },
		  // Decodes ESCAPED format from a Buffer of bytes to an Array of 32-bit integers.
		  decode(buf) {
		    function isHex(hex) {
		      if ((hex >= 48 && hex <= 57) || (hex >= 65 && hex <= 70) || (hex >= 97 && hex <= 102)) {
		        return true;
		      }
		      return false;
		    }
		    function getx(i, len, bufArg) {
		      const ret = { char: null, nexti: i + 2, error: true };
		      if (i + 1 < len) {
		        if (isHex(bufArg[i]) && isHex(bufArg[i + 1])) {
		          const str = String.fromCodePoint(bufArg[i], bufArg[i + 1]);
		          ret.char = parseInt(str, 16);
		          if (!Number.isNaN(ret.char)) {
		            ret.error = false;
		          }
		        }
		      }
		      return ret;
		    }
		    function getu(i, len, bufArg) {
		      const ret = { char: null, nexti: i + 4, error: true };
		      if (i + 3 < len) {
		        if (isHex(bufArg[i]) && isHex(bufArg[i + 1]) && isHex(bufArg[i + 2]) && isHex(bufArg[i + 3])) {
		          const str = String.fromCodePoint(bufArg[i], bufArg[i + 1], bufArg[i + 2], bufArg[i + 3]);
		          ret.char = parseInt(str, 16);
		          if (!Number.isNaN(ret.char)) {
		            ret.error = false;
		          }
		        }
		      }
		      return ret;
		    }
		    function getU(i, len, bufArg) {
		      const ret = { char: null, nexti: i + 4, error: true };
		      let str = '';
		      while (i < len && isHex(bufArg[i])) {
		        str += String.fromCodePoint(bufArg[i]);
		        // eslint-disable-next-line no-param-reassign
		        i += 1;
		      }
		      ret.char = parseInt(str, 16);
		      if (bufArg[i] === 125 && !Number.isNaN(ret.char)) {
		        ret.error = false;
		      }
		      ret.nexti = i + 1;
		      return ret;
		    }
		    const chars = [];
		    const len = buf.length;
		    let i1;
		    let ret;
		    let error;
		    let i = 0;
		    while (i < len) {
		      const TRUE = true;
		      while (TRUE) {
		        error = true;
		        if (buf[i] !== 96) {
		          /* unescaped character */
		          chars.push(buf[i]);
		          i += 1;
		          error = false;
		          break;
		        }
		        i1 = i + 1;
		        if (i1 >= len) {
		          break;
		        }
		        if (buf[i1] === 96) {
		          /* escaped grave accent */
		          chars.push(96);
		          i += 2;
		          error = false;
		          break;
		        }
		        if (buf[i1] === 120) {
		          ret = getx(i1 + 1, len, buf);
		          if (ret.error) {
		            break;
		          }
		          /* escaped hex */
		          chars.push(ret.char);
		          i = ret.nexti;
		          error = false;
		          break;
		        }
		        if (buf[i1] === 117) {
		          if (buf[i1 + 1] === 123) {
		            ret = getU(i1 + 2, len, buf);
		            if (ret.error) {
		              break;
		            }
		            /* escaped utf-32 */
		            chars.push(ret.char);
		            i = ret.nexti;
		            error = false;
		            break;
		          }
		          ret = getu(i1 + 1, len, buf);
		          if (ret.error) {
		            break;
		          }
		          /* escaped utf-16 */
		          chars.push(ret.char);
		          i = ret.nexti;
		          error = false;
		          break;
		        }
		        break;
		      }
		      if (error) {
		        throw new Error(`escaped.decode: ill-formed escape sequence at buf[${i}]`);
		      }
		    }
		    return chars;
		  },
		};

		// The line end conversion algorigthms.
		const CR = 13;
		const LF = 10;
		exports.lineEnds = {
		  crlf(chars) {
		    const lfchars = [];
		    let i = 0;
		    while (i < chars.length) {
		      switch (chars[i]) {
		        case CR:
		          if (i + 1 < chars.length && chars[i + 1] === LF) {
		            i += 2;
		          } else {
		            i += 1;
		          }
		          lfchars.push(CR);
		          lfchars.push(LF);
		          break;
		        case LF:
		          lfchars.push(CR);
		          lfchars.push(LF);
		          i += 1;
		          break;
		        default:
		          lfchars.push(chars[i]);
		          i += 1;
		          break;
		      }
		    }
		    if (lfchars.length > 0 && lfchars[lfchars.length - 1] !== LF) {
		      lfchars.push(CR);
		      lfchars.push(LF);
		    }
		    return lfchars;
		  },
		  lf(chars) {
		    const lfchars = [];
		    let i = 0;
		    while (i < chars.length) {
		      switch (chars[i]) {
		        case CR:
		          if (i + 1 < chars.length && chars[i + 1] === LF) {
		            i += 2;
		          } else {
		            i += 1;
		          }
		          lfchars.push(LF);
		          break;
		        case LF:
		          lfchars.push(LF);
		          i += 1;
		          break;
		        default:
		          lfchars.push(chars[i]);
		          i += 1;
		          break;
		      }
		    }
		    if (lfchars.length > 0 && lfchars[lfchars.length - 1] !== LF) {
		      lfchars.push(LF);
		    }
		    return lfchars;
		  },
		};

		// The base 64 algorithms.
		exports.base64 = {
		  encode(buf) {
		    if (buf.length === 0) {
		      return Buffer.alloc(0);
		    }
		    let i;
		    let j;
		    let n;
		    let tail = buf.length % 3;
		    tail = tail > 0 ? 3 - tail : 0;
		    let units = (buf.length + tail) / 3;
		    const base64 = Buffer.alloc(units * 4);
		    if (tail > 0) {
		      units -= 1;
		    }
		    i = 0;
		    j = 0;
		    for (let u = 0; u < units; u += 1) {
		      n = buf[i++] << 16;
		      n += buf[i++] << 8;
		      n += buf[i++];
		      base64[j++] = base64codes[(n >> 18) & mask[6]];
		      base64[j++] = base64codes[(n >> 12) & mask[6]];
		      base64[j++] = base64codes[(n >> 6) & mask[6]];
		      base64[j++] = base64codes[n & mask[6]];
		    }
		    if (tail === 0) {
		      return base64;
		    }
		    if (tail === 1) {
		      n = buf[i++] << 16;
		      n += buf[i] << 8;
		      base64[j++] = base64codes[(n >> 18) & mask[6]];
		      base64[j++] = base64codes[(n >> 12) & mask[6]];
		      base64[j++] = base64codes[(n >> 6) & mask[6]];
		      base64[j] = base64codes[64];
		      return base64;
		    }
		    if (tail === 2) {
		      n = buf[i] << 16;
		      base64[j++] = base64codes[(n >> 18) & mask[6]];
		      base64[j++] = base64codes[(n >> 12) & mask[6]];
		      base64[j++] = base64codes[64];
		      base64[j] = base64codes[64];
		      return base64;
		    }
		    return undefined;
		  },
		  decode(codes) {
		    /* remove white space and ctrl characters, validate & translate characters */
		    function validate(buf) {
		      const chars = [];
		      let tail = 0;
		      for (let i = 0; i < buf.length; i += 1) {
		        const char = buf[i];
		        const TRUE = true;
		        while (TRUE) {
		          if (char === 32 || char === 9 || char === 10 || char === 13) {
		            break;
		          }
		          if (char >= 65 && char <= 90) {
		            chars.push(char - 65);
		            break;
		          }
		          if (char >= 97 && char <= 122) {
		            chars.push(char - 71);
		            break;
		          }
		          if (char >= 48 && char <= 57) {
		            chars.push(char + 4);
		            break;
		          }
		          if (char === 43) {
		            chars.push(62);
		            break;
		          }
		          if (char === 47) {
		            chars.push(63);
		            break;
		          }
		          if (char === 61) {
		            chars.push(64);
		            tail += 1;
		            break;
		          }
		          /* invalid character */
		          throw new RangeError(`base64.decode: invalid character buf[${i}]: ${char}`);
		        }
		      }
		      /* validate length */
		      if (chars.length % 4 > 0) {
		        throw new RangeError(`base64.decode: string length not integral multiple of 4: ${chars.length}`);
		      }
		      /* validate tail */
		      switch (tail) {
		        case 0:
		          break;
		        case 1:
		          if (chars[chars.length - 1] !== 64) {
		            throw new RangeError('base64.decode: one tail character found: not last character');
		          }
		          break;
		        case 2:
		          if (chars[chars.length - 1] !== 64 || chars[chars.length - 2] !== 64) {
		            throw new RangeError('base64.decode: two tail characters found: not last characters');
		          }
		          break;
		        default:
		          throw new RangeError(`base64.decode: more than two tail characters found: ${tail}`);
		      }
		      return { tail, buf: Buffer.from(chars) };
		    }

		    if (codes.length === 0) {
		      return Buffer.alloc(0);
		    }
		    const val = validate(codes);
		    const { tail } = val;
		    const base64 = val.buf;
		    let i;
		    let j;
		    let n;
		    let units = base64.length / 4;
		    const buf = Buffer.alloc(units * 3 - tail);
		    if (tail > 0) {
		      units -= 1;
		    }
		    j = 0;
		    i = 0;
		    for (let u = 0; u < units; u += 1) {
		      n = base64[i++] << 18;
		      n += base64[i++] << 12;
		      n += base64[i++] << 6;
		      n += base64[i++];
		      buf[j++] = (n >> 16) & mask[8];
		      buf[j++] = (n >> 8) & mask[8];
		      buf[j++] = n & mask[8];
		    }
		    if (tail === 1) {
		      n = base64[i++] << 18;
		      n += base64[i++] << 12;
		      n += base64[i] << 6;
		      buf[j++] = (n >> 16) & mask[8];
		      buf[j] = (n >> 8) & mask[8];
		    }
		    if (tail === 2) {
		      n = base64[i++] << 18;
		      n += base64[i++] << 12;
		      buf[j] = (n >> 16) & mask[8];
		    }
		    return buf;
		  },
		  // Converts a base 64 Buffer of bytes to a JavaScript string with line breaks.
		  toString(buf) {
		    if (buf.length % 4 > 0) {
		      throw new RangeError(`base64.toString: input buffer length not multiple of 4: ${buf.length}`);
		    }
		    let str = '';
		    let lineLen = 0;
		    function buildLine(c1, c2, c3, c4) {
		      switch (lineLen) {
		        case 76:
		          str += `\r\n${c1}${c2}${c3}${c4}`;
		          lineLen = 4;
		          break;
		        case 75:
		          str += `${c1}\r\n${c2}${c3}${c4}`;
		          lineLen = 3;
		          break;
		        case 74:
		          str += `${c1 + c2}\r\n${c3}${c4}`;
		          lineLen = 2;
		          break;
		        case 73:
		          str += `${c1 + c2 + c3}\r\n${c4}`;
		          lineLen = 1;
		          break;
		        default:
		          str += c1 + c2 + c3 + c4;
		          lineLen += 4;
		          break;
		      }
		    }
		    function validate(c) {
		      if (c >= 65 && c <= 90) {
		        return true;
		      }
		      if (c >= 97 && c <= 122) {
		        return true;
		      }
		      if (c >= 48 && c <= 57) {
		        return true;
		      }
		      if (c === 43) {
		        return true;
		      }
		      if (c === 47) {
		        return true;
		      }
		      if (c === 61) {
		        return true;
		      }
		      return false;
		    }
		    for (let i = 0; i < buf.length; i += 4) {
		      for (let j = i; j < i + 4; j += 1) {
		        if (!validate(buf[j])) {
		          throw new RangeError(`base64.toString: buf[${j}]: ${buf[j]} : not valid base64 character code`);
		        }
		      }
		      buildLine(
		        String.fromCharCode(buf[i]),
		        String.fromCharCode(buf[i + 1]),
		        String.fromCharCode(buf[i + 2]),
		        String.fromCharCode(buf[i + 3])
		      );
		    }
		    return str;
		  },
		}; 
	} (transformers));
	return transformers;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var hasRequiredConverter;

function requireConverter () {
	if (hasRequiredConverter) return converter;
	hasRequiredConverter = 1;
	(function (exports) {
		// This module exposes the public encoding, decoding and conversion functions.
		// Its private functions provide the disassembling and interpetation of the source and destination encoding types.
		// In the case of Unicode encodings, private functions determine the presence of Byte Order Marks (BOMs), if any.
		//
		// Throws "TypeError" exceptions on input errors.
		//

		'use strict;';

		const { Buffer } = requireBuffer();

		const trans = requireTransformers();

		/* types */
		const UTF8 = 'UTF8';
		const UTF16 = 'UTF16';
		const UTF16BE = 'UTF16BE';
		const UTF16LE = 'UTF16LE';
		const UTF32 = 'UTF32';
		const UTF32BE = 'UTF32BE';
		const UTF32LE = 'UTF32LE';
		const UINT7 = 'UINT7';
		const ASCII = 'ASCII';
		const BINARY = 'BINARY';
		const UINT8 = 'UINT8';
		const UINT16 = 'UINT16';
		const UINT16LE = 'UINT16LE';
		const UINT16BE = 'UINT16BE';
		const UINT32 = 'UINT32';
		const UINT32LE = 'UINT32LE';
		const UINT32BE = 'UINT32BE';
		const ESCAPED = 'ESCAPED';
		const STRING = 'STRING';

		/* private functions */
		// Find the UTF8 BOM, if any.
		const bom8 = function bom8(src) {
		  src.type = UTF8;
		  const buf = src.data;
		  src.bom = 0;
		  if (buf.length >= 3) {
		    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
		      src.bom = 3;
		    }
		  }
		};
		// Find the UTF16 BOM, if any, and determine the UTF16 type.
		// Defaults to UTF16BE.
		// Throws TypeError exception if BOM does not match the specified type.
		const bom16 = function bom16(src) {
		  const buf = src.data;
		  src.bom = 0;
		  switch (src.type) {
		    case UTF16:
		      src.type = UTF16BE;
		      if (buf.length >= 2) {
		        if (buf[0] === 0xfe && buf[1] === 0xff) {
		          src.bom = 2;
		        } else if (buf[0] === 0xff && buf[1] === 0xfe) {
		          src.type = UTF16LE;
		          src.bom = 2;
		        }
		      }
		      break;
		    case UTF16BE:
		      src.type = UTF16BE;
		      if (buf.length >= 2) {
		        if (buf[0] === 0xfe && buf[1] === 0xff) {
		          src.bom = 2;
		        } else if (buf[0] === 0xff && buf[1] === 0xfe) {
		          throw new TypeError(`src type: "${UTF16BE}" specified but BOM is for "${UTF16LE}"`);
		        }
		      }
		      break;
		    case UTF16LE:
		      src.type = UTF16LE;
		      if (buf.length >= 0) {
		        if (buf[0] === 0xfe && buf[1] === 0xff) {
		          throw new TypeError(`src type: "${UTF16LE}" specified but BOM is for "${UTF16BE}"`);
		        } else if (buf[0] === 0xff && buf[1] === 0xfe) {
		          src.bom = 2;
		        }
		      }
		      break;
		    default:
		      throw new TypeError(`UTF16 BOM: src type "${src.type}" unrecognized`);
		  }
		};
		// Find the UTF32 BOM, if any, and determine the UTF32 type.
		// Defaults to UTF32BE.
		// Throws exception if BOM does not match the specified type.
		const bom32 = function bom32(src) {
		  const buf = src.data;
		  src.bom = 0;
		  switch (src.type) {
		    case UTF32:
		      src.type = UTF32BE;
		      if (buf.length >= 4) {
		        if (buf[0] === 0 && buf[1] === 0 && buf[2] === 0xfe && buf[3] === 0xff) {
		          src.bom = 4;
		        }
		        if (buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {
		          src.type = UTF32LE;
		          src.bom = 4;
		        }
		      }
		      break;
		    case UTF32BE:
		      src.type = UTF32BE;
		      if (buf.length >= 4) {
		        if (buf[0] === 0 && buf[1] === 0 && buf[2] === 0xfe && buf[3] === 0xff) {
		          src.bom = 4;
		        }
		        if (buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {
		          throw new TypeError(`src type: ${UTF32BE} specified but BOM is for ${UTF32LE}"`);
		        }
		      }
		      break;
		    case UTF32LE:
		      src.type = UTF32LE;
		      if (buf.length >= 4) {
		        if (buf[0] === 0 && buf[1] === 0 && buf[2] === 0xfe && buf[3] === 0xff) {
		          throw new TypeError(`src type: "${UTF32LE}" specified but BOM is for "${UTF32BE}"`);
		        }
		        if (buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {
		          src.bom = 4;
		        }
		      }
		      break;
		    default:
		      throw new TypeError(`UTF32 BOM: src type "${src.type}" unrecognized`);
		  }
		};
		// Validates the source encoding type and matching data.
		// If the BASE64: prefix is present, the base 64 decoding is done here as the initial step.
		// - For type STRING, data must be a JavaScript string.
		// - For type BASE64:*, data may be a string or Buffer.
		// - For all other types, data must be a Buffer.
		// - The BASE64: prefix is not allowed for type STRING.
		const validateSrc = function validateSrc(type, data) {
		  function getType(typeArg) {
		    const ret = {
		      type: '',
		      base64: false,
		    };
		    const rx = /^(base64:)?([a-zA-Z0-9]+)$/i;
		    const result = rx.exec(typeArg);
		    if (result) {
		      if (result[2]) {
		        ret.type = result[2].toUpperCase();
		      }
		      if (result[1]) {
		        ret.base64 = true;
		      }
		    }
		    return ret;
		  }
		  const ret = getType(type.toUpperCase());
		  if (ret.base64) {
		    /* handle base 64 */
		    if (ret.type === STRING) {
		      throw new TypeError(`type: "${type} "BASE64:" prefix not allowed with type ${STRING}`);
		    }
		    if (Buffer.isBuffer(data)) {
		      ret.data = trans.base64.decode(data);
		    } else if (typeof data === 'string') {
		      const buf = Buffer.from(data, 'ascii');
		      ret.data = trans.base64.decode(buf);
		    } else {
		      throw new TypeError(`type: "${type} unrecognized data type: typeof(data): ${typeof data}`);
		    }
		  } else {
		    ret.data = data;
		  }
		  switch (ret.type) {
		    case UTF8:
		      bom8(ret);
		      break;
		    case UTF16:
		    case UTF16BE:
		    case UTF16LE:
		      bom16(ret);
		      break;
		    case UTF32:
		    case UTF32BE:
		    case UTF32LE:
		      bom32(ret);
		      break;
		    case UINT16:
		      ret.type = UINT16BE;
		      break;
		    case UINT32:
		      ret.type = UINT32BE;
		      break;
		    case ASCII:
		      ret.type = UINT7;
		      break;
		    case BINARY:
		      ret.type = UINT8;
		      break;
		    case UINT7:
		    case UINT8:
		    case UINT16LE:
		    case UINT16BE:
		    case UINT32LE:
		    case UINT32BE:
		    case STRING:
		    case ESCAPED:
		      break;
		    default:
		      throw new TypeError(`type: "${type}" not recognized`);
		  }
		  if (ret.type === STRING) {
		    if (typeof ret.data !== 'string') {
		      throw new TypeError(`type: "${type}" but data is not a string`);
		    }
		  } else if (!Buffer.isBuffer(ret.data)) {
		    throw new TypeError(`type: "${type}" but data is not a Buffer`);
		  }
		  return ret;
		};
		// Disassembles and validates the destination type.
		// `chars` must be an Array of integers.
		// The :BASE64 suffix is not allowed for type STRING.
		const validateDst = function validateDst(type, chars) {
		  function getType(typeArg) {
		    let fix;
		    let rem;
		    const ret = {
		      crlf: false,
		      lf: false,
		      base64: false,
		      type: '',
		    };
		    /* prefix, if any */
		    const TRUE = true;
		    while (TRUE) {
		      rem = typeArg;
		      fix = typeArg.slice(0, 5);
		      if (fix === 'CRLF:') {
		        ret.crlf = true;
		        rem = typeArg.slice(5);
		        break;
		      }
		      fix = typeArg.slice(0, 3);
		      if (fix === 'LF:') {
		        ret.lf = true;
		        rem = typeArg.slice(3);
		        break;
		      }
		      break;
		    }
		    /* suffix, if any */
		    fix = rem.split(':');
		    if (fix.length === 1) {
		      // eslint-disable-next-line prefer-destructuring
		      ret.type = fix[0];
		    } else if (fix.length === 2 && fix[1] === 'BASE64') {
		      ret.base64 = true;
		      // eslint-disable-next-line prefer-destructuring
		      ret.type = fix[0];
		    }
		    return ret;
		  }
		  if (!Array.isArray(chars)) {
		    throw new TypeError(`dst chars: not array: "${typeof chars}`);
		  }
		  if (typeof type !== 'string') {
		    throw new TypeError(`dst type: not string: "${typeof type}`);
		  }
		  const ret = getType(type.toUpperCase());
		  switch (ret.type) {
		    case UTF8:
		    case UTF16BE:
		    case UTF16LE:
		    case UTF32BE:
		    case UTF32LE:
		    case UINT7:
		    case UINT8:
		    case UINT16LE:
		    case UINT16BE:
		    case UINT32LE:
		    case UINT32BE:
		    case ESCAPED:
		      break;
		    case STRING:
		      if (ret.base64) {
		        throw new TypeError(`":BASE64" suffix not allowed with type ${STRING}`);
		      }
		      break;
		    case ASCII:
		      ret.type = UINT7;
		      break;
		    case BINARY:
		      ret.type = UINT8;
		      break;
		    case UTF16:
		      ret.type = UTF16BE;
		      break;
		    case UTF32:
		      ret.type = UTF32BE;
		      break;
		    case UINT16:
		      ret.type = UINT16BE;
		      break;
		    case UINT32:
		      ret.type = UINT32BE;
		      break;
		    default:
		      throw new TypeError(`dst type unrecognized: "${type}" : must have form [crlf:|lf:]type[:base64]`);
		  }
		  return ret;
		};
		// Select and call the requested encoding function.
		const encode = function encode(type, chars) {
		  switch (type) {
		    case UTF8:
		      return trans.utf8.encode(chars);
		    case UTF16BE:
		      return trans.utf16be.encode(chars);
		    case UTF16LE:
		      return trans.utf16le.encode(chars);
		    case UTF32BE:
		      return trans.utf32be.encode(chars);
		    case UTF32LE:
		      return trans.utf32le.encode(chars);
		    case UINT7:
		      return trans.uint7.encode(chars);
		    case UINT8:
		      return trans.uint8.encode(chars);
		    case UINT16BE:
		      return trans.uint16be.encode(chars);
		    case UINT16LE:
		      return trans.uint16le.encode(chars);
		    case UINT32BE:
		      return trans.uint32be.encode(chars);
		    case UINT32LE:
		      return trans.uint32le.encode(chars);
		    case STRING:
		      return trans.string.encode(chars);
		    case ESCAPED:
		      return trans.escaped.encode(chars);
		    default:
		      throw new TypeError(`encode type "${type}" not recognized`);
		  }
		};
		// Select and call the requested decoding function.
		// `src` contains BOM information as well as the source type and data.
		const decode = function decode(src) {
		  switch (src.type) {
		    case UTF8:
		      return trans.utf8.decode(src.data, src.bom);
		    case UTF16LE:
		      return trans.utf16le.decode(src.data, src.bom);
		    case UTF16BE:
		      return trans.utf16be.decode(src.data, src.bom);
		    case UTF32BE:
		      return trans.utf32be.decode(src.data, src.bom);
		    case UTF32LE:
		      return trans.utf32le.decode(src.data, src.bom);
		    case UINT7:
		      return trans.uint7.decode(src.data);
		    case UINT8:
		      return trans.uint8.decode(src.data);
		    case UINT16BE:
		      return trans.uint16be.decode(src.data);
		    case UINT16LE:
		      return trans.uint16le.decode(src.data);
		    case UINT32BE:
		      return trans.uint32be.decode(src.data);
		    case UINT32LE:
		      return trans.uint32le.decode(src.data);
		    case STRING:
		      return trans.string.decode(src.data);
		    case ESCAPED:
		      return trans.escaped.decode(src.data);
		    default:
		      throw new TypeError(`decode type "${src.type}" not recognized`);
		  }
		};

		// The public decoding function. Returns an array of integers.
		exports.decode = function exportsDecode(type, data) {
		  const src = validateSrc(type, data);
		  return decode(src);
		};
		// The public encoding function. Returns a Buffer-typed byte array.
		exports.encode = function exportsEncode(type, chars) {
		  let c;
		  let buf;
		  const dst = validateDst(type, chars);
		  if (dst.crlf) {
		    /* prefix with CRLF line end conversion, don't contaminate caller's chars array */
		    c = trans.lineEnds.crlf(chars);
		    buf = encode(dst.type, c);
		  } else if (dst.lf) {
		    /* prefix with LF line end conversion, don't contaminate caller's chars array */
		    c = trans.lineEnds.lf(chars);
		    buf = encode(dst.type, c);
		  } else {
		    buf = encode(dst.type, chars);
		  }
		  if (dst.base64) {
		    /* post base 64 encoding */
		    buf = trans.base64.encode(buf);
		  }
		  return buf;
		};
		// Converts data of type `srcType` to data of type `dstType`.
		// `srcData` may be a JavaScript String, or node.js Buffer, depending on the corresponding type.
		const convert = function convert(srcType, srcData, dstType) {
		  return exports.encode(dstType, exports.decode(srcType, srcData));
		};
		exports.convert = convert; 
	} (converter));
	return converter;
}

var emitcss;
var hasRequiredEmitcss;

function requireEmitcss () {
	if (hasRequiredEmitcss) return emitcss;
	hasRequiredEmitcss = 1;
	// This module has been developed programmatically in the `apg-lib` build process.
	// It is used to build web pages programatically on the fly without the need for <script> or <style> tags.

	emitcss = function emittcss(){
	return '/* This file automatically generated by jsonToless() and LESS. */\n.apg-mono {\n  font-family: monospace;\n}\n.apg-active {\n  font-weight: bold;\n  color: #000000;\n}\n.apg-match {\n  font-weight: bold;\n  color: #264BFF;\n}\n.apg-empty {\n  font-weight: bold;\n  color: #0fbd0f;\n}\n.apg-nomatch {\n  font-weight: bold;\n  color: #FF4000;\n}\n.apg-lh-match {\n  font-weight: bold;\n  color: #1A97BA;\n}\n.apg-lb-match {\n  font-weight: bold;\n  color: #5F1687;\n}\n.apg-remainder {\n  font-weight: bold;\n  color: #999999;\n}\n.apg-ctrl-char {\n  font-weight: bolder;\n  font-style: italic;\n  font-size: 0.6em;\n}\n.apg-line-end {\n  font-weight: bold;\n  color: #000000;\n}\n.apg-error {\n  font-weight: bold;\n  color: #FF4000;\n}\n.apg-phrase {\n  color: #000000;\n  background-color: #8caae6;\n}\n.apg-empty-phrase {\n  color: #0fbd0f;\n}\ntable.apg-state {\n  font-family: monospace;\n  margin-top: 5px;\n  font-size: 11px;\n  line-height: 130%;\n  text-align: left;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-state th,\ntable.apg-state td {\n  text-align: left;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-state th:nth-last-child(2),\ntable.apg-state td:nth-last-child(2) {\n  text-align: right;\n}\ntable.apg-state caption {\n  font-size: 125%;\n  line-height: 130%;\n  font-weight: bold;\n  text-align: left;\n}\ntable.apg-stats {\n  font-family: monospace;\n  margin-top: 5px;\n  font-size: 11px;\n  line-height: 130%;\n  text-align: right;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-stats th,\ntable.apg-stats td {\n  text-align: right;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-stats caption {\n  font-size: 125%;\n  line-height: 130%;\n  font-weight: bold;\n  text-align: left;\n}\ntable.apg-trace {\n  font-family: monospace;\n  margin-top: 5px;\n  font-size: 11px;\n  line-height: 130%;\n  text-align: right;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-trace caption {\n  font-size: 125%;\n  line-height: 130%;\n  font-weight: bold;\n  text-align: left;\n}\ntable.apg-trace th,\ntable.apg-trace td {\n  text-align: right;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-trace th:last-child,\ntable.apg-trace th:nth-last-child(2),\ntable.apg-trace td:last-child,\ntable.apg-trace td:nth-last-child(2) {\n  text-align: left;\n}\ntable.apg-grammar {\n  font-family: monospace;\n  margin-top: 5px;\n  font-size: 11px;\n  line-height: 130%;\n  text-align: right;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-grammar caption {\n  font-size: 125%;\n  line-height: 130%;\n  font-weight: bold;\n  text-align: left;\n}\ntable.apg-grammar th,\ntable.apg-grammar td {\n  text-align: right;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-grammar th:last-child,\ntable.apg-grammar td:last-child {\n  text-align: left;\n}\ntable.apg-rules {\n  font-family: monospace;\n  margin-top: 5px;\n  font-size: 11px;\n  line-height: 130%;\n  text-align: right;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-rules caption {\n  font-size: 125%;\n  line-height: 130%;\n  font-weight: bold;\n  text-align: left;\n}\ntable.apg-rules th,\ntable.apg-rules td {\n  text-align: right;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-rules a {\n  color: #003399 !important;\n}\ntable.apg-rules a:hover {\n  color: #8caae6 !important;\n}\ntable.apg-attrs {\n  font-family: monospace;\n  margin-top: 5px;\n  font-size: 11px;\n  line-height: 130%;\n  text-align: center;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-attrs caption {\n  font-size: 125%;\n  line-height: 130%;\n  font-weight: bold;\n  text-align: left;\n}\ntable.apg-attrs th,\ntable.apg-attrs td {\n  text-align: center;\n  border: 1px solid black;\n  border-collapse: collapse;\n}\ntable.apg-attrs th:nth-child(1),\ntable.apg-attrs th:nth-child(2),\ntable.apg-attrs th:nth-child(3) {\n  text-align: right;\n}\ntable.apg-attrs td:nth-child(1),\ntable.apg-attrs td:nth-child(2),\ntable.apg-attrs td:nth-child(3) {\n  text-align: right;\n}\ntable.apg-attrs a {\n  color: #003399 !important;\n}\ntable.apg-attrs a:hover {\n  color: #8caae6 !important;\n}\n';
	};
	return emitcss;
}

/* eslint-disable func-names */

var hasRequiredUtilities;

function requireUtilities () {
	if (hasRequiredUtilities) return utilities;
	hasRequiredUtilities = 1;
	(function (exports) {
		/*  *************************************************************************************
		 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
		 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
		 *   ********************************************************************************* */
		// This module exports a variety of utility functions that support
		// [`apg`](https://github.com/ldthomas/apg-js2), [`apg-lib`](https://github.com/ldthomas/apg-js2-lib)
		// and the generated parser applications.

		const style = requireStyle();
		const converter = requireConverter();
		const emitCss = requireEmitcss();
		const id = requireIdentifiers();

		const thisFileName = 'utilities.js: ';

		/* translate (implied) phrase beginning character and length to actual first and last character indexes */
		/* used by multiple phrase handling functions */
		const getBounds = function (length, begArg, len) {
		  let end;
		  let beg = begArg;
		  const TRUE = true;
		  while (TRUE) {
		    if (length <= 0) {
		      beg = 0;
		      end = 0;
		      break;
		    }
		    if (typeof beg !== 'number') {
		      beg = 0;
		      end = length;
		      break;
		    }
		    if (beg >= length) {
		      beg = length;
		      end = length;
		      break;
		    }
		    if (typeof len !== 'number') {
		      end = length;
		      break;
		    }
		    end = beg + len;
		    if (end > length) {
		      end = length;
		      break;
		    }
		    break;
		  }
		  return {
		    beg,
		    end,
		  };
		};
		// Generates a complete, minimal HTML5 page, inserting the user's HTML text on the page.
		// - *html* - the page text in HTML format
		// - *title* - the HTML page `<title>` - defaults to `htmlToPage`.
		exports.htmlToPage = function (html, titleArg) {
		  let title;
		  if (typeof html !== 'string') {
		    throw new Error(`${thisFileName}htmlToPage: input HTML is not a string`);
		  }
		  if (typeof titleArg !== 'string') {
		    title = 'htmlToPage';
		  } else {
		    title = titleArg;
		  }
		  let page = '';
		  page += '<!DOCTYPE html>\n';
		  page += '<html lang="en">\n';
		  page += '<head>\n';
		  page += '<meta charset="utf-8">\n';
		  page += `<title>${title}</title>\n`;
		  page += '<style>\n';
		  page += emitCss();
		  page += '</style>\n';
		  page += '</head>\n<body>\n';
		  page += `<p>${new Date()}</p>\n`;
		  page += html;
		  page += '</body>\n</html>\n';
		  return page;
		};
		// Formats the returned object from `parser.parse()`
		// into an HTML table.
		// ```
		// return {
		//   success : sysData.success,
		//   state : sysData.state,
		//   length : charsLength,
		//   matched : sysData.phraseLength,
		//   maxMatched : maxMatched,
		//   maxTreeDepth : maxTreeDepth,
		//   nodeHits : nodeHits,
		//   inputLength : chars.length,
		//   subBegin : charsBegin,
		//   subEnd : charsEnd,
		//   subLength : charsLength
		// };
		// ```
		exports.parserResultToHtml = function (result, caption) {
		  let cap = null;
		  if (typeof caption === 'string' && caption !== '') {
		    cap = caption;
		  }
		  let success;
		  let state;
		  if (result.success === true) {
		    success = `<span class="${style.CLASS_MATCH}">true</span>`;
		  } else {
		    success = `<span class="${style.CLASS_NOMATCH}">false</span>`;
		  }
		  if (result.state === id.EMPTY) {
		    state = `<span class="${style.CLASS_EMPTY}">EMPTY</span>`;
		  } else if (result.state === id.MATCH) {
		    state = `<span class="${style.CLASS_MATCH}">MATCH</span>`;
		  } else if (result.state === id.NOMATCH) {
		    state = `<span class="${style.CLASS_NOMATCH}">NOMATCH</span>`;
		  } else {
		    state = `<span class="${style.CLASS_NOMATCH}">unrecognized</span>`;
		  }
		  let html = '';
		  html += `<table class="${style.CLASS_STATE}">\n`;
		  if (cap) {
		    html += `<caption>${cap}</caption>\n`;
		  }
		  html += '<tr><th>state item</th><th>value</th><th>description</th></tr>\n';
		  html += `<tr><td>parser success</td><td>${success}</td>\n`;
		  html += `<td><span class="${style.CLASS_MATCH}">true</span> if the parse succeeded,\n`;
		  html += ` <span class="${style.CLASS_NOMATCH}">false</span> otherwise`;
		  html += '<br><i>NOTE: for success, entire string must be matched</i></td></tr>\n';
		  html += `<tr><td>parser state</td><td>${state}</td>\n`;
		  html += `<td><span class="${style.CLASS_EMPTY}">EMPTY</span>, `;
		  html += `<span class="${style.CLASS_MATCH}">MATCH</span> or \n`;
		  html += `<span class="${style.CLASS_NOMATCH}">NOMATCH</span></td></tr>\n`;
		  html += `<tr><td>string length</td><td>${result.length}</td><td>length of the input (sub)string</td></tr>\n`;
		  html += `<tr><td>matched length</td><td>${result.matched}</td><td>number of input string characters matched</td></tr>\n`;
		  html += `<tr><td>max matched</td><td>${result.maxMatched}</td><td>maximum number of input string characters matched</td></tr>\n`;
		  html += `<tr><td>max tree depth</td><td>${result.maxTreeDepth}</td><td>maximum depth of the parse tree reached</td></tr>\n`;
		  html += `<tr><td>node hits</td><td>${result.nodeHits}</td><td>number of parse tree node hits (opcode function calls)</td></tr>\n`;
		  html += `<tr><td>input length</td><td>${result.inputLength}</td><td>length of full input string</td></tr>\n`;
		  html += `<tr><td>sub-string begin</td><td>${result.subBegin}</td><td>sub-string first character index</td></tr>\n`;
		  html += `<tr><td>sub-string end</td><td>${result.subEnd}</td><td>sub-string end-of-string index</td></tr>\n`;
		  html += `<tr><td>sub-string length</td><td>${result.subLength}</td><td>sub-string length</td></tr>\n`;
		  html += '</table>\n';
		  return html;
		};
		// Translates a sub-array of integer character codes into a string.
		// Very useful in callback functions to translate the matched phrases into strings.
		exports.charsToString = function (chars, phraseIndex, phraseLength) {
		  let beg;
		  let end;
		  if (typeof phraseIndex === 'number') {
		    if (phraseIndex >= chars.length) {
		      return '';
		    }
		    beg = phraseIndex < 0 ? 0 : phraseIndex;
		  } else {
		    beg = 0;
		  }
		  if (typeof phraseLength === 'number') {
		    if (phraseLength <= 0) {
		      return '';
		    }
		    end = phraseLength > chars.length - beg ? chars.length : beg + phraseLength;
		  } else {
		    end = chars.length;
		  }
		  if (beg < end) {
		    return converter.encode('UTF16LE', chars.slice(beg, end)).toString('utf16le');
		  }
		  return '';
		};
		// Translates a string into an array of integer character codes.
		exports.stringToChars = function (string) {
		  return converter.decode('STRING', string);
		};
		// Translates an opcode identifier into a human-readable string.
		exports.opcodeToString = function (type) {
		  let ret = 'unknown';
		  switch (type) {
		    case id.ALT:
		      ret = 'ALT';
		      break;
		    case id.CAT:
		      ret = 'CAT';
		      break;
		    case id.RNM:
		      ret = 'RNM';
		      break;
		    case id.UDT:
		      ret = 'UDT';
		      break;
		    case id.AND:
		      ret = 'AND';
		      break;
		    case id.NOT:
		      ret = 'NOT';
		      break;
		    case id.REP:
		      ret = 'REP';
		      break;
		    case id.TRG:
		      ret = 'TRG';
		      break;
		    case id.TBS:
		      ret = 'TBS';
		      break;
		    case id.TLS:
		      ret = 'TLS';
		      break;
		    case id.BKR:
		      ret = 'BKR';
		      break;
		    case id.BKA:
		      ret = 'BKA';
		      break;
		    case id.BKN:
		      ret = 'BKN';
		      break;
		    case id.ABG:
		      ret = 'ABG';
		      break;
		    case id.AEN:
		      ret = 'AEN';
		      break;
		    default:
		      throw new Error('unrecognized opcode');
		  }
		  return ret;
		};
		// Translates an state identifier into a human-readable string.
		exports.stateToString = function (state) {
		  let ret = 'unknown';
		  switch (state) {
		    case id.ACTIVE:
		      ret = 'ACTIVE';
		      break;
		    case id.MATCH:
		      ret = 'MATCH';
		      break;
		    case id.EMPTY:
		      ret = 'EMPTY';
		      break;
		    case id.NOMATCH:
		      ret = 'NOMATCH';
		      break;
		    default:
		      throw new Error('unrecognized state');
		  }
		  return ret;
		};
		// Array which translates all 128, 7-bit ASCII character codes to their respective HTML format.
		exports.asciiChars = [
		  'NUL',
		  'SOH',
		  'STX',
		  'ETX',
		  'EOT',
		  'ENQ',
		  'ACK',
		  'BEL',
		  'BS',
		  'TAB',
		  'LF',
		  'VT',
		  'FF',
		  'CR',
		  'SO',
		  'SI',
		  'DLE',
		  'DC1',
		  'DC2',
		  'DC3',
		  'DC4',
		  'NAK',
		  'SYN',
		  'ETB',
		  'CAN',
		  'EM',
		  'SUB',
		  'ESC',
		  'FS',
		  'GS',
		  'RS',
		  'US',
		  '&nbsp;',
		  '!',
		  '&#34;',
		  '#',
		  '$',
		  '%',
		  '&#38;',
		  '&#39;',
		  '(',
		  ')',
		  '*',
		  '+',
		  ',',
		  '-',
		  '.',
		  '/',
		  '0',
		  '1',
		  '2',
		  '3',
		  '4',
		  '5',
		  '6',
		  '7',
		  '8',
		  '9',
		  ':',
		  ';',
		  '&#60;',
		  '=',
		  '&#62;',
		  '?',
		  '@',
		  'A',
		  'B',
		  'C',
		  'D',
		  'E',
		  'F',
		  'G',
		  'H',
		  'I',
		  'J',
		  'K',
		  'L',
		  'M',
		  'N',
		  'O',
		  'P',
		  'Q',
		  'R',
		  'S',
		  'T',
		  'U',
		  'V',
		  'W',
		  'X',
		  'Y',
		  'Z',
		  '[',
		  '&#92;',
		  ']',
		  '^',
		  '_',
		  '`',
		  'a',
		  'b',
		  'c',
		  'd',
		  'e',
		  'f',
		  'g',
		  'h',
		  'i',
		  'j',
		  'k',
		  'l',
		  'm',
		  'n',
		  'o',
		  'p',
		  'q',
		  'r',
		  's',
		  't',
		  'u',
		  'v',
		  'w',
		  'x',
		  'y',
		  'z',
		  '{',
		  '|',
		  '}',
		  '~',
		  'DEL',
		];
		// Translates a single character to hexadecimal with leading zeros for 2, 4, or 8 digit display.
		exports.charToHex = function (char) {
		  let ch = char.toString(16).toUpperCase();
		  switch (ch.length) {
		    case 1:
		    case 3:
		    case 7:
		      ch = `0${ch}`;
		      break;
		    case 2:
		    case 6:
		      ch = `00${ch}`;
		      break;
		    case 4:
		      break;
		    case 5:
		      ch = `000${ch}`;
		      break;
		    default:
		      throw new Error('unrecognized option');
		  }
		  return ch;
		};
		// Translates a sub-array of character codes to decimal display format.
		exports.charsToDec = function (chars, beg, len) {
		  let ret = '';
		  if (!Array.isArray(chars)) {
		    throw new Error(`${thisFileName}charsToDec: input must be an array of integers`);
		  }
		  const bounds = getBounds(chars.length, beg, len);
		  if (bounds.end > bounds.beg) {
		    ret += chars[bounds.beg];
		    for (let i = bounds.beg + 1; i < bounds.end; i += 1) {
		      ret += `,${chars[i]}`;
		    }
		  }
		  return ret;
		};
		// Translates a sub-array of character codes to hexadecimal display format.
		exports.charsToHex = function (chars, beg, len) {
		  let ret = '';
		  if (!Array.isArray(chars)) {
		    throw new Error(`${thisFileName}charsToHex: input must be an array of integers`);
		  }
		  const bounds = getBounds(chars.length, beg, len);
		  if (bounds.end > bounds.beg) {
		    ret += `\\x${exports.charToHex(chars[bounds.beg])}`;
		    for (let i = bounds.beg + 1; i < bounds.end; i += 1) {
		      ret += `,\\x${exports.charToHex(chars[i])}`;
		    }
		  }
		  return ret;
		};
		exports.charsToHtmlEntities = function (chars, beg, len) {
		  let ret = '';
		  if (!Array.isArray(chars)) {
		    throw new Error(`${thisFileName}charsToHex: input must be an array of integers`);
		  }
		  const bounds = getBounds(chars.length, beg, len);
		  if (bounds.end > bounds.beg) {
		    for (let i = bounds.beg; i < bounds.end; i += 1) {
		      ret += `&#x${chars[i].toString(16)};`;
		    }
		  }
		  return ret;
		};
		// Translates a sub-array of character codes to Unicode display format.
		function isUnicode(char) {
		  if (char >= 0xd800 && char <= 0xdfff) {
		    return false;
		  }
		  if (char > 0x10ffff) {
		    return false;
		  }
		  return true;
		}
		exports.charsToUnicode = function (chars, beg, len) {
		  let ret = '';
		  if (!Array.isArray(chars)) {
		    throw new Error(`${thisFileName}charsToUnicode: input must be an array of integers`);
		  }
		  const bounds = getBounds(chars.length, beg, len);
		  if (bounds.end > bounds.beg) {
		    for (let i = bounds.beg; i < bounds.end; i += 1) {
		      if (isUnicode(chars[i])) {
		        ret += `&#${chars[i]};`;
		      } else {
		        ret += ` U+${exports.charToHex(chars[i])}`;
		      }
		    }
		  }
		  return ret;
		};
		// Translates a sub-array of character codes to JavaScript Unicode display format (`\uXXXX`).
		exports.charsToJsUnicode = function (chars, beg, len) {
		  let ret = '';
		  if (!Array.isArray(chars)) {
		    throw new Error(`${thisFileName}charsToJsUnicode: input must be an array of integers`);
		  }
		  const bounds = getBounds(chars.length, beg, len);
		  if (bounds.end > bounds.beg) {
		    ret += `\\u${exports.charToHex(chars[bounds.beg])}`;
		    for (let i = bounds.beg + 1; i < bounds.end; i += 1) {
		      ret += `,\\u${exports.charToHex(chars[i])}`;
		    }
		  }
		  return ret;
		};
		// Translates a sub-array of character codes to printing ASCII character display format.
		exports.charsToAscii = function (chars, beg, len) {
		  let ret = '';
		  if (!Array.isArray(chars)) {
		    throw new Error(`${thisFileName}charsToAscii: input must be an array of integers`);
		  }
		  const bounds = getBounds(chars.length, beg, len);
		  for (let i = bounds.beg; i < bounds.end; i += 1) {
		    const char = chars[i];
		    if (char >= 32 && char <= 126) {
		      ret += String.fromCharCode(char);
		    } else {
		      ret += `\\x${exports.charToHex(char)}`;
		    }
		  }
		  return ret;
		};
		// Translates a sub-array of character codes to HTML display format.
		exports.charsToAsciiHtml = function (chars, beg, len) {
		  if (!Array.isArray(chars)) {
		    throw new Error(`${thisFileName}charsToAsciiHtml: input must be an array of integers`);
		  }
		  let html = '';
		  let char;
		  const bounds = getBounds(chars.length, beg, len);
		  for (let i = bounds.beg; i < bounds.end; i += 1) {
		    char = chars[i];
		    if (char < 32 || char === 127) {
		      /* control characters */
		      html += `<span class="${style.CLASS_CTRLCHAR}">${exports.asciiChars[char]}</span>`;
		    } else if (char > 127) {
		      /* non-ASCII */
		      html += `<span class="${style.CLASS_CTRLCHAR}">U+${exports.charToHex(char)}</span>`;
		    } else {
		      /* printing ASCII, 32 <= char <= 126 */
		      html += exports.asciiChars[char];
		    }
		  }
		  return html;
		};
		// Translates a JavaScript string to HTML display format.
		exports.stringToAsciiHtml = function (str) {
		  const chars = converter.decode('STRING', str);
		  return this.charsToAsciiHtml(chars);
		}; 
	} (utilities));
	return utilities;
}

/* eslint-disable guard-for-in */

var ast;
var hasRequiredAst;

function requireAst () {
	if (hasRequiredAst) return ast;
	hasRequiredAst = 1;
	/* eslint-disable no-restricted-syntax */
	/*  *************************************************************************************
	 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
	 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
	 *   ********************************************************************************* */
	// This module is used by the parser to build an [Abstract Syntax Tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree) (AST).
	// The AST can be thought of as a subset of the full parse tree.
	// Each node of the AST holds the phrase that was matched at the corresponding, named parse tree node.
	// It is built as the parser successfully matches phrases to the rule names
	// (`RNM` operators) and `UDT`s as it parses an input string.
	// The user controls which `RNM` or `UDT` names to keep on the AST.
	// The user can also associate callback functions with some or all of the retained
	// AST nodes to be used to translate the node phrases. That is, associate semantic
	// actions to the matched phrases.
	// Translating the AST rather that attempting to apply semantic actions during
	// the parsing process, has the advantage that there is no backtracking and that the phrases
	// are known while traversing down tree as will as up.
	//
	// Let `ast` be an `ast.js` object. To identify a node to be kept on the AST:
	// ```
	// ast.callbacks["rulename"] = true; (all nodes default to false)
	// ```
	// To associate a callback function with a node:
	// ```
	// ast.callbacks["rulename"] = fn
	// ```
	// `rulename` is any `RNM` or `UDT` name defined by the associated grammar
	// and `fn` is a user-written callback function.
	// (See [`apg-examples`](https://github.com/ldthomas/apg-js2-examples/tree/master/ast) for examples of how to create an AST,
	// define the nodes and callback functions and attach it to a parser.)
	ast = function exportsAst() {
	  const id = requireIdentifiers();
	  const utils = requireUtilities();

	  const thisFileName = 'ast.js: ';
	  const that = this;
	  let rules = null;
	  let udts = null;
	  let chars = null;
	  let nodeCount = 0;
	  const nodesDefined = [];
	  const nodeCallbacks = [];
	  const stack = [];
	  const records = [];
	  this.callbacks = [];
	  this.astObject = 'astObject';
	  /* called by the parser to initialize the AST with the rules, UDTs and the input characters */
	  this.init = function init(rulesIn, udtsIn, charsIn) {
	    stack.length = 0;
	    records.length = 0;
	    nodesDefined.length = 0;
	    nodeCount = 0;
	    rules = rulesIn;
	    udts = udtsIn;
	    chars = charsIn;
	    let i;
	    const list = [];
	    for (i = 0; i < rules.length; i += 1) {
	      list.push(rules[i].lower);
	    }
	    for (i = 0; i < udts.length; i += 1) {
	      list.push(udts[i].lower);
	    }
	    nodeCount = rules.length + udts.length;
	    for (i = 0; i < nodeCount; i += 1) {
	      nodesDefined[i] = false;
	      nodeCallbacks[i] = null;
	    }
	    for (const index in that.callbacks) {
	      const lower = index.toLowerCase();
	      i = list.indexOf(lower);
	      if (i < 0) {
	        throw new Error(`${thisFileName}init: node '${index}' not a rule or udt name`);
	      }
	      if (typeof that.callbacks[index] === 'function') {
	        nodesDefined[i] = true;
	        nodeCallbacks[i] = that.callbacks[index];
	      }
	      if (that.callbacks[index] === true) {
	        nodesDefined[i] = true;
	      }
	    }
	  };
	  /* AST node definitions - called by the parser's `RNM` operator */
	  this.ruleDefined = function ruleDefined(index) {
	    return nodesDefined[index] !== false;
	  };
	  /* AST node definitions - called by the parser's `UDT` operator */
	  this.udtDefined = function udtDefined(index) {
	    return nodesDefined[rules.length + index] !== false;
	  };
	  /* called by the parser's `RNM` & `UDT` operators */
	  /* builds a record for the downward traversal of the node */
	  this.down = function down(callbackIndex, name) {
	    const thisIndex = records.length;
	    stack.push(thisIndex);
	    records.push({
	      name,
	      thisIndex,
	      thatIndex: null,
	      state: id.SEM_PRE,
	      callbackIndex,
	      phraseIndex: null,
	      phraseLength: null,
	      stack: stack.length,
	    });
	    return thisIndex;
	  };
	  /* called by the parser's `RNM` & `UDT` operators */
	  /* builds a record for the upward traversal of the node */
	  this.up = function up(callbackIndex, name, phraseIndex, phraseLength) {
	    const thisIndex = records.length;
	    const thatIndex = stack.pop();
	    records.push({
	      name,
	      thisIndex,
	      thatIndex,
	      state: id.SEM_POST,
	      callbackIndex,
	      phraseIndex,
	      phraseLength,
	      stack: stack.length,
	    });
	    records[thatIndex].thatIndex = thisIndex;
	    records[thatIndex].phraseIndex = phraseIndex;
	    records[thatIndex].phraseLength = phraseLength;
	    return thisIndex;
	  };
	  // Called by the user to translate the AST.
	  // Translate means to associate or apply some semantic action to the
	  // phrases that were syntactically matched to the AST nodes according
	  // to the defining grammar.
	  // ```
	  // data - optional user-defined data
	  //        passed to the callback functions by the translator
	  // ```
	  this.translate = function translate(data) {
	    let ret;
	    let callback;
	    let record;
	    for (let i = 0; i < records.length; i += 1) {
	      record = records[i];
	      callback = nodeCallbacks[record.callbackIndex];
	      if (record.state === id.SEM_PRE) {
	        if (callback !== null) {
	          ret = callback(id.SEM_PRE, chars, record.phraseIndex, record.phraseLength, data);
	          if (ret === id.SEM_SKIP) {
	            i = record.thatIndex;
	          }
	        }
	      } else if (callback !== null) {
	        callback(id.SEM_POST, chars, record.phraseIndex, record.phraseLength, data);
	      }
	    }
	  };
	  /* called by the parser to reset the length of the records array */
	  /* necessary on backtracking */
	  this.setLength = function setLength(length) {
	    records.length = length;
	    if (length > 0) {
	      stack.length = records[length - 1].stack;
	    } else {
	      stack.length = 0;
	    }
	  };
	  /* called by the parser to get the length of the records array */
	  this.getLength = function getLength() {
	    return records.length;
	  };
	  /* helper for XML display */
	  function indent(n) {
	    let ret = '';
	    for (let i = 0; i < n; i += 1) {
	      ret += ' ';
	    }
	    return ret;
	  }
	  // Generate an `XML` version of the AST.
	  // Useful if you want to use a special or favorite XML parser to translate the
	  // AST.
	  // ```
	  // mode - the display mode of the captured phrases
	  //      - default mode is "ascii"
	  //      - can be: "ascii"
	  //                "decimal"
	  //                "hexadecimal"
	  //                "unicode"
	  // ```
	  this.toXml = function toSml(modeArg) {
	    let display = utils.charsToDec;
	    let caption = 'decimal integer character codes';
	    if (typeof modeArg === 'string' && modeArg.length >= 3) {
	      const mode = modeArg.slice(0, 3).toLowerCase();
	      if (mode === 'asc') {
	        display = utils.charsToAscii;
	        caption = 'ASCII for printing characters, hex for non-printing';
	      } else if (mode === 'hex') {
	        display = utils.charsToHex;
	        caption = 'hexadecimal integer character codes';
	      } else if (mode === 'uni') {
	        display = utils.charsToUnicode;
	        caption = 'Unicode UTF-32 integer character codes';
	      }
	    }
	    let xml = '';
	    let depth = 0;
	    xml += '<?xml version="1.0" encoding="utf-8"?>\n';
	    xml += `<root nodes="${records.length / 2}" characters="${chars.length}">\n`;
	    xml += `<!-- input string, ${caption} -->\n`;
	    xml += indent(depth + 2);
	    xml += display(chars);
	    xml += '\n';
	    records.forEach((rec) => {
	      if (rec.state === id.SEM_PRE) {
	        depth += 1;
	        xml += indent(depth);
	        xml += `<node name="${rec.name}" index="${rec.phraseIndex}" length="${rec.phraseLength}">\n`;
	        xml += indent(depth + 2);
	        xml += display(chars, rec.phraseIndex, rec.phraseLength);
	        xml += '\n';
	      } else {
	        xml += indent(depth);
	        xml += `</node><!-- name="${rec.name}" -->\n`;
	        depth -= 1;
	      }
	    });

	    xml += '</root>\n';
	    return xml;
	  };
	  /* generate a JavaScript object version of the AST */
	  /* for the phrase-matching engine apg-exp */
	  this.phrases = function phrases() {
	    const obj = {};
	    let i;
	    let record;
	    for (i = 0; i < records.length; i += 1) {
	      record = records[i];
	      if (record.state === id.SEM_PRE) {
	        if (!Array.isArray(obj[record.name])) {
	          obj[record.name] = [];
	        }
	        obj[record.name].push({
	          index: record.phraseIndex,
	          length: record.phraseLength,
	        });
	      }
	    }
	    return obj;
	  };
	};
	return ast;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var circularBuffer;
var hasRequiredCircularBuffer;

function requireCircularBuffer () {
	if (hasRequiredCircularBuffer) return circularBuffer;
	hasRequiredCircularBuffer = 1;
	// This module acts as a "circular buffer". It is used to keep track
	// only the last N records in an array of records. If more than N records
	// are saved, each additional record overwrites the previously oldest record.
	// This module deals only with the record indexes and does not save
	// any actual records. It is used by [`trace.js`](./trace.html) for limiting the number of
	// trace records saved.
	circularBuffer = function exportsCircularBuffer() {
	  'use strict;';

	  const thisFileName = 'circular-buffer.js: ';
	  let itemIndex = -1;
	  let maxListSize = 0;
	  // Initialize buffer.<br>
	  // *size* is `maxListSize`, the maximum number of records saved before overwriting begins.
	  this.init = function init(size) {
	    if (typeof size !== 'number' || size <= 0) {
	      throw new Error(`${thisFileName}init: circular buffer size must an integer > 0`);
	    }
	    maxListSize = Math.ceil(size);
	    itemIndex = -1;
	  };
	  // Call this to increment the number of records collected.<br>
	  // Returns the array index number to store the next record in.
	  this.increment = function increment() {
	    itemIndex += 1;
	    return (itemIndex + maxListSize) % maxListSize;
	  };
	  // Returns `maxListSize` - the maximum number of records to keep in the buffer.
	  this.maxSize = function maxSize() {
	    return maxListSize;
	  };
	  // Returns the highest number of items saved.<br>
	  // (The number of items is the actual number of records processed
	  // even though only `maxListSize` records are actually retained.)
	  this.items = function items() {
	    return itemIndex + 1;
	  };
	  // Returns the record number associated with this item index.
	  this.getListIndex = function getListIndex(item) {
	    if (itemIndex === -1) {
	      return -1;
	    }
	    if (item < 0 || item > itemIndex) {
	      return -1;
	    }
	    if (itemIndex - item >= maxListSize) {
	      return -1;
	    }
	    return (item + maxListSize) % maxListSize;
	  };
	  // The iterator over the circular buffer.
	  // The user's function, `fn`, will be called with arguments `fn(listIndex, itemIndex)`
	  // where `listIndex` is the saved record index and `itemIndex` is the actual item index.
	  this.forEach = function forEach(fn) {
	    if (itemIndex === -1) {
	      /* no records have been collected */
	      return;
	    }
	    if (itemIndex < maxListSize) {
	      /* fewer than maxListSize records have been collected - number of items = number of records */
	      for (let i = 0; i <= itemIndex; i += 1) {
	        fn(i, i);
	      }
	      return;
	    }
	    /* start with the oldest record saved and finish with the most recent record saved */
	    for (let i = itemIndex - maxListSize + 1; i <= itemIndex; i += 1) {
	      const listIndex = (i + maxListSize) % maxListSize;
	      fn(listIndex, i);
	    }
	  };
	};
	return circularBuffer;
}

/* eslint-disable func-names */

var parser$1;
var hasRequiredParser$1;

function requireParser$1 () {
	if (hasRequiredParser$1) return parser$1;
	hasRequiredParser$1 = 1;
	/* eslint-disable no-restricted-syntax */
	/* eslint-disable new-cap */
	/* eslint-disable guard-for-in */
	/*  *************************************************************************************
	 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
	 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
	 *   ********************************************************************************* */
	// This is the primary object of `apg-lib`. Calling its `parse()` member function
	// walks the parse tree of opcodes, matching phrases from the input string as it goes.
	// The working code for all of the operators, `ALT`, `CAT`, etc. is in this module.
	parser$1 = function parser() {
	  const id = requireIdentifiers();
	  const utils = requireUtilities();

	  const thisFileName = 'parser.js: ';
	  const thisThis = this;
	  let opExecute;
	  this.ast = null;
	  this.stats = null;
	  this.trace = null;
	  this.callbacks = [];
	  let opcodes = null;
	  let chars = null;
	  let charsBegin;
	  let charsLength;
	  let charsEnd;
	  let lookAround;
	  let treeDepth = 0;
	  let maxTreeDepth = 0;
	  let nodeHits = 0;
	  let ruleCallbacks = null;
	  let udtCallbacks = null;
	  let rules = null;
	  let udts = null;
	  let syntaxData = null;
	  let maxMatched = 0;
	  let limitTreeDepth = Infinity;
	  let limitNodeHits = Infinity;
	  // Evaluates any given rule. This can be called from the syntax callback
	  // functions to evaluate any rule in the grammar's rule list. Great caution
	  // should be used. Use of this function will alter the language that the
	  // parser accepts.
	  const evaluateRule = function evaluateRule(ruleIndex, phraseIndex, sysData) {
	    const functionName = `${thisFileName}evaluateRule(): `;
	    if (ruleIndex >= rules.length) {
	      throw new Error(`${functionName}rule index: ${ruleIndex} out of range`);
	    }
	    if (phraseIndex >= charsEnd) {
	      throw new Error(`${functionName}phrase index: ${phraseIndex} out of range`);
	    }
	    const { length } = opcodes;
	    opcodes.push({
	      type: id.RNM,
	      index: ruleIndex,
	    });
	    opExecute(length, phraseIndex, sysData);
	    opcodes.pop();
	  };
	  // Evaluates any given UDT. This can be called from the syntax callback
	  // functions to evaluate any UDT in the grammar's UDT list. Great caution
	  // should be used. Use of this function will alter the language that the
	  // parser accepts.
	  const evaluateUdt = function (udtIndex, phraseIndex, sysData) {
	    const functionName = `${thisFileName}evaluateUdt(): `;
	    if (udtIndex >= udts.length) {
	      throw new Error(`${functionName}udt index: ${udtIndex} out of range`);
	    }
	    if (phraseIndex >= charsEnd) {
	      throw new Error(`${functionName}phrase index: ${phraseIndex} out of range`);
	    }
	    const { length } = opcodes;
	    opcodes.push({
	      type: id.UDT,
	      empty: udts[udtIndex].empty,
	      index: udtIndex,
	    });
	    opExecute(length, phraseIndex, sysData);
	    opcodes.pop();
	  };
	  /* Clears this object of any/all data that has been initialized or added to it. */
	  /* Called by parse() on initialization, allowing this object to be re-used for multiple parsing calls. */
	  const clear = function () {
	    treeDepth = 0;
	    maxTreeDepth = 0;
	    nodeHits = 0;
	    maxMatched = 0;
	    lookAround = [
	      {
	        lookAround: id.LOOKAROUND_NONE,
	        anchor: 0,
	        charsEnd: 0,
	        charsLength: 0,
	      },
	    ];
	    rules = null;
	    udts = null;
	    chars = null;
	    charsBegin = 0;
	    charsLength = 0;
	    charsEnd = 0;
	    ruleCallbacks = null;
	    udtCallbacks = null;
	    syntaxData = null;
	    opcodes = null;
	  };
	  /* object for maintaining a stack of back reference frames */
	  const backRef = function () {
	    const stack = [];
	    const init = function () {
	      const obj = {};
	      rules.forEach((rule) => {
	        if (rule.isBkr) {
	          obj[rule.lower] = null;
	        }
	      });
	      if (udts.length > 0) {
	        udts.forEach((udt) => {
	          if (udt.isBkr) {
	            obj[udt.lower] = null;
	          }
	        });
	      }
	      stack.push(obj);
	    };
	    const copy = function () {
	      const top = stack[stack.length - 1];
	      const obj = {};
	      /* // eslint-disable-next-line no-restricted-syntax */
	      for (const name in top) {
	        obj[name] = top[name];
	      }
	      return obj;
	    };
	    this.push = function push() {
	      stack.push(copy());
	    };
	    this.pop = function pop(lengthArg) {
	      let length = lengthArg;
	      if (!length) {
	        length = stack.length - 1;
	      }
	      if (length < 1 || length > stack.length) {
	        throw new Error(`${thisFileName}backRef.pop(): bad length: ${length}`);
	      }
	      stack.length = length;
	      return stack[stack.length - 1];
	    };
	    this.length = function length() {
	      return stack.length;
	    };
	    this.savePhrase = function savePhrase(name, index, length) {
	      stack[stack.length - 1][name] = {
	        phraseIndex: index,
	        phraseLength: length,
	      };
	    };
	    this.getPhrase = function (name) {
	      return stack[stack.length - 1][name];
	    };
	    /* constructor */
	    init();
	  };
	  // The system data structure that relays system information to and from the rule and UDT callback functions.
	  // - *state* - the state of the parser, ACTIVE, MATCH, EMPTY or NOMATCH (see the `identifiers` object in
	  // [`apg-lib`](https://github.com/ldthomas/apg-js2-lib))
	  // - *phraseLength* - the number of characters matched if the state is MATCHED or EMPTY
	  // - *lookaround* - the top of the stack holds the current look around state,
	  // LOOKAROUND_NONE, LOOKAROUND_AHEAD or LOOKAROUND_BEHIND,
	  // - *uFrame* - the "universal" back reference frame.
	  // Holds the last matched phrase for each of the back referenced rules and UDTs.
	  // - *pFrame* - the stack of "parent" back reference frames.
	  // Holds the matched phrase from the parent frame of each back referenced rules and UDTs.
	  // - *evaluateRule* - a reference to this object's `evaluateRule()` function.
	  // Can be called from a callback function (use with extreme caution!)
	  // - *evaluateUdt* - a reference to this object's `evaluateUdt()` function.
	  // Can be called from a callback function (use with extreme caution!)
	  const systemData = function systemData() {
	    const thisData = this;
	    this.state = id.ACTIVE;
	    this.phraseLength = 0;
	    this.ruleIndex = 0;
	    this.udtIndex = 0;
	    this.lookAround = lookAround[lookAround.length - 1];
	    this.uFrame = new backRef();
	    this.pFrame = new backRef();
	    this.evaluateRule = evaluateRule;
	    this.evaluateUdt = evaluateUdt;
	    /* refresh the parser state for the next operation */
	    this.refresh = function refresh() {
	      thisData.state = id.ACTIVE;
	      thisData.phraseLength = 0;
	      thisData.lookAround = lookAround[lookAround.length - 1];
	    };
	  };
	  /* some look around helper functions */
	  const lookAroundValue = function lookAroundValue() {
	    return lookAround[lookAround.length - 1];
	  };
	  /* return true if parser is in look around (ahead or behind) state */
	  const inLookAround = function inLookAround() {
	    return lookAround.length > 1;
	  };
	  /* return true if parser is in look behind state */
	  const inLookBehind = function () {
	    return lookAround[lookAround.length - 1].lookAround === id.LOOKAROUND_BEHIND;
	  };
	  /* called by parse() to initialize the AST object, if one has been defined */
	  const initializeAst = function () {
	    const functionName = `${thisFileName}initializeAst(): `;
	    const TRUE = true;
	    while (TRUE) {
	      if (thisThis.ast === undefined) {
	        thisThis.ast = null;
	        break;
	      }
	      if (thisThis.ast === null) {
	        break;
	      }
	      if (thisThis.ast.astObject !== 'astObject') {
	        throw new Error(`${functionName}ast object not recognized`);
	      }
	      break;
	    }
	    if (thisThis.ast !== null) {
	      thisThis.ast.init(rules, udts, chars);
	    }
	  };
	  /* called by parse() to initialize the trace object, if one has been defined */
	  const initializeTrace = function () {
	    const functionName = `${thisFileName}initializeTrace(): `;
	    const TRUE = true;
	    while (TRUE) {
	      if (thisThis.trace === undefined) {
	        thisThis.trace = null;
	        break;
	      }
	      if (thisThis.trace === null) {
	        break;
	      }
	      if (thisThis.trace.traceObject !== 'traceObject') {
	        throw new Error(`${functionName}trace object not recognized`);
	      }
	      break;
	    }
	    if (thisThis.trace !== null) {
	      thisThis.trace.init(rules, udts, chars);
	    }
	  };
	  /* called by parse() to initialize the statistics object, if one has been defined */
	  const initializeStats = function () {
	    const functionName = `${thisFileName}initializeStats(): `;
	    const TRUE = true;
	    while (TRUE) {
	      if (thisThis.stats === undefined) {
	        thisThis.stats = null;
	        break;
	      }
	      if (thisThis.stats === null) {
	        break;
	      }
	      if (thisThis.stats.statsObject !== 'statsObject') {
	        throw new Error(`${functionName}stats object not recognized`);
	      }
	      break;
	    }
	    if (thisThis.stats !== null) {
	      thisThis.stats.init(rules, udts);
	    }
	  };
	  /* called by parse() to initialize the rules & udts from the grammar object */
	  /* (the grammar object generated previously by apg) */
	  const initializeGrammar = function (grammar) {
	    const functionName = `${thisFileName}initializeGrammar(): `;
	    if (!grammar) {
	      throw new Error(`${functionName}grammar object undefined`);
	    }
	    if (grammar.grammarObject !== 'grammarObject') {
	      throw new Error(`${functionName}bad grammar object`);
	    }
	    rules = grammar.rules;
	    udts = grammar.udts;
	  };
	  /* called by parse() to initialize the start rule */
	  const initializeStartRule = function (startRule) {
	    const functionName = `${thisFileName}initializeStartRule(): `;
	    let start = null;
	    if (typeof startRule === 'number') {
	      if (startRule >= rules.length) {
	        throw new Error(`${functionName}start rule index too large: max: ${rules.length}: index: ${startRule}`);
	      }
	      start = startRule;
	    } else if (typeof startRule === 'string') {
	      const lower = startRule.toLowerCase();
	      for (let i = 0; i < rules.length; i += 1) {
	        if (lower === rules[i].lower) {
	          start = rules[i].index;
	          break;
	        }
	      }
	      if (start === null) {
	        throw new Error(`${functionName}start rule name '${startRule}' not recognized`);
	      }
	    } else {
	      throw new Error(`${functionName}type of start rule '${typeof startRule}' not recognized`);
	    }
	    return start;
	  };
	  /* called by parse() to initialize the array of characters codes representing the input string */
	  const initializeInputChars = function initializeInputChars(inputArg, begArg, lenArg) {
	    const functionName = `${thisFileName}initializeInputChars(): `;
	    /* varify and normalize input */
	    let input = inputArg;
	    let beg = begArg;
	    let len = lenArg;
	    if (input === undefined) {
	      throw new Error(`${functionName}input string is undefined`);
	    }
	    if (input === null) {
	      throw new Error(`${functionName}input string is null`);
	    }
	    if (typeof input === 'string') {
	      input = utils.stringToChars(input);
	    } else if (!Array.isArray(input)) {
	      throw new Error(`${functionName}input string is not a string or array`);
	    }
	    if (input.length > 0) {
	      if (typeof input[0] !== 'number') {
	        throw new Error(`${functionName}input string not an array of integers`);
	      }
	    }
	    /* verify and normalize beginning index */
	    if (typeof beg !== 'number') {
	      beg = 0;
	    } else {
	      beg = Math.floor(beg);
	      if (beg < 0 || beg > input.length) {
	        throw new Error(`${functionName}input beginning index out of range: ${beg}`);
	      }
	    }
	    /* verify and normalize input length */
	    if (typeof len !== 'number') {
	      len = input.length - beg;
	    } else {
	      len = Math.floor(len);
	      if (len < 0 || len > input.length - beg) {
	        throw new Error(`${functionName}input length out of range: ${len}`);
	      }
	    }
	    chars = input;
	    charsBegin = beg;
	    charsLength = len;
	    charsEnd = charsBegin + charsLength;
	  };
	  /* called by parse() to initialize the user-written, syntax callback functions, if any */
	  const initializeCallbacks = function () {
	    const functionName = `${thisFileName}initializeCallbacks(): `;
	    let i;
	    ruleCallbacks = [];
	    udtCallbacks = [];
	    for (i = 0; i < rules.length; i += 1) {
	      ruleCallbacks[i] = null;
	    }
	    for (i = 0; i < udts.length; i += 1) {
	      udtCallbacks[i] = null;
	    }
	    let func;
	    const list = [];
	    for (i = 0; i < rules.length; i += 1) {
	      list.push(rules[i].lower);
	    }
	    for (i = 0; i < udts.length; i += 1) {
	      list.push(udts[i].lower);
	    }
	    for (const index in thisThis.callbacks) {
	      i = list.indexOf(index.toLowerCase());
	      if (i < 0) {
	        throw new Error(`${functionName}syntax callback '${index}' not a rule or udt name`);
	      }
	      func = thisThis.callbacks[index];
	      if (!func) {
	        func = null;
	      }
	      if (typeof func === 'function' || func === null) {
	        if (i < rules.length) {
	          ruleCallbacks[i] = func;
	        } else {
	          udtCallbacks[i - rules.length] = func;
	        }
	      } else {
	        throw new Error(
	          `${functionName}syntax callback[${index}] must be function reference or 'false' (false/null/undefined/etc.)`
	        );
	      }
	    }
	    /* make sure all udts have been defined - the parser can't work without them */
	    for (i = 0; i < udts.length; i += 1) {
	      if (udtCallbacks[i] === null) {
	        throw new Error(
	          `${functionName}all UDT callbacks must be defined. UDT callback[${udts[i].lower}] not a function reference`
	        );
	      }
	    }
	  };
	  // Set the maximum parse tree depth allowed. The default is `Infinity`.
	  // A limit is not normally needed, but can be used to protect against an
	  // exponentual or "catastrophically backtracking" grammar.
	  // <ul>
	  // <li>
	  // depth - max allowed parse tree depth. An exception is thrown if exceeded.
	  // </li>
	  // </ul>
	  this.setMaxTreeDepth = function (depth) {
	    if (typeof depth !== 'number') {
	      throw new Error(`parser: max tree depth must be integer > 0: ${depth}`);
	    }
	    limitTreeDepth = Math.floor(depth);
	    if (limitTreeDepth <= 0) {
	      throw new Error(`parser: max tree depth must be integer > 0: ${depth}`);
	    }
	  };
	  // Set the maximum number of node hits (parser unit steps or opcode function calls) allowed.
	  // The default is `Infinity`.
	  // A limit is not normally needed, but can be used to protect against an
	  // exponentual or "catastrophically backtracking" grammar.
	  // <ul>
	  // <li>
	  // hits - maximum number of node hits or parser unit steps allowed.
	  // An exception thrown if exceeded.
	  // </li>
	  // </ul>
	  this.setMaxNodeHits = function (hits) {
	    if (typeof hits !== 'number') {
	      throw new Error(`parser: max node hits must be integer > 0: ${hits}`);
	    }
	    limitNodeHits = Math.floor(hits);
	    if (limitNodeHits <= 0) {
	      throw new Error(`parser: max node hits must be integer > 0: ${hits}`);
	    }
	  };
	  /* the main parser function */
	  const privateParse = function (grammar, startRuleArg, callbackData) {
	    let success;
	    const functionName = `${thisFileName}parse(): `;
	    initializeGrammar(grammar);
	    const startRule = initializeStartRule(startRuleArg);
	    initializeCallbacks();
	    initializeTrace();
	    initializeStats();
	    initializeAst();
	    const sysData = new systemData();
	    if (!(callbackData === undefined || callbackData === null)) {
	      syntaxData = callbackData;
	    }
	    /* create a dummy opcode for the start rule */
	    opcodes = [
	      {
	        type: id.RNM,
	        index: startRule,
	      },
	    ];
	    /* execute the start rule */
	    opExecute(0, charsBegin, sysData);
	    opcodes = null;
	    /* test and return the sysData */
	    switch (sysData.state) {
	      case id.ACTIVE:
	        throw new Error(`${functionName}final state should never be 'ACTIVE'`);
	      case id.NOMATCH:
	        success = false;
	        break;
	      case id.EMPTY:
	      case id.MATCH:
	        if (sysData.phraseLength === charsLength) {
	          success = true;
	        } else {
	          success = false;
	        }
	        break;
	      default:
	        throw new Error('unrecognized state');
	    }
	    return {
	      success,
	      state: sysData.state,
	      length: charsLength,
	      matched: sysData.phraseLength,
	      maxMatched,
	      maxTreeDepth,
	      nodeHits,
	      inputLength: chars.length,
	      subBegin: charsBegin,
	      subEnd: charsEnd,
	      subLength: charsLength,
	    };
	  };

	  // This form allows parsing of a sub-string of the full input string.
	  // <ul>
	  // <li>*inputIndex* - index of the first character in the sub-string</li>
	  // <li>*inputLength* - length of the sub-string</li>
	  // </ul>
	  // All other parameters as for the above function `parse()`.
	  this.parseSubstring = function parseSubstring(grammar, startRule, inputChars, inputIndex, inputLength, callbackData) {
	    clear();
	    initializeInputChars(inputChars, inputIndex, inputLength);
	    return privateParse(grammar, startRule, callbackData);
	  };
	  // This is the main function, called to parse an input string.
	  // <ul>
	  // <li>*grammar* - an instantiated grammar object - the output of `apg` for a
	  // specific SABNF grammar</li>
	  // <li>*startRule* - the rule name or rule index to be used as the root of the
	  // parse tree. This is usually the first rule, index = 0, of the grammar
	  // but can be any rule defined in the above grammar object.</li>
	  // <li>*inputChars* - the input string. Can be a string or an array of integer character codes representing the
	  // string.</li>
	  // <li>*callbackData* - user-defined data object to be passed to the user's
	  // callback functions.
	  // This is not used by the parser in any way, merely passed on to the user.
	  // May be `null` or omitted.</li>
	  // </ul>
	  this.parse = function parse(grammar, startRule, inputChars, callbackData) {
	    clear();
	    initializeInputChars(inputChars, 0, inputChars.length);
	    return privateParse(grammar, startRule, callbackData);
	  };
	  // The `ALT` operator.<br>
	  // Executes its child nodes, from left to right, until it finds a match.
	  // Fails if *all* of its child nodes fail.
	  const opALT = function (opIndex, phraseIndex, sysData) {
	    const op = opcodes[opIndex];
	    for (let i = 0; i < op.children.length; i += 1) {
	      opExecute(op.children[i], phraseIndex, sysData);
	      if (sysData.state !== id.NOMATCH) {
	        break;
	      }
	    }
	  };
	  // The `CAT` operator.<br>
	  // Executes all of its child nodes, from left to right,
	  // concatenating the matched phrases.
	  // Fails if *any* child nodes fail.
	  const opCAT = function (opIndex, phraseIndex, sysData) {
	    let success;
	    let astLength;
	    let catCharIndex;
	    let catPhrase;
	    const op = opcodes[opIndex];
	    const ulen = sysData.uFrame.length();
	    const plen = sysData.pFrame.length();
	    if (thisThis.ast) {
	      astLength = thisThis.ast.getLength();
	    }
	    success = true;
	    catCharIndex = phraseIndex;
	    catPhrase = 0;
	    for (let i = 0; i < op.children.length; i += 1) {
	      opExecute(op.children[i], catCharIndex, sysData);
	      if (sysData.state === id.NOMATCH) {
	        success = false;
	        break;
	      } else {
	        catCharIndex += sysData.phraseLength;
	        catPhrase += sysData.phraseLength;
	      }
	    }
	    if (success) {
	      sysData.state = catPhrase === 0 ? id.EMPTY : id.MATCH;
	      sysData.phraseLength = catPhrase;
	    } else {
	      sysData.state = id.NOMATCH;
	      sysData.phraseLength = 0;
	      /* reset the back referencing frames on failure */
	      sysData.uFrame.pop(ulen);
	      sysData.pFrame.pop(plen);
	      if (thisThis.ast) {
	        thisThis.ast.setLength(astLength);
	      }
	    }
	  };
	  // The `REP` operator.<br>
	  // Repeatedly executes its single child node,
	  // concatenating each of the matched phrases found.
	  // The number of repetitions executed and its final sysData depends
	  // on its `min` & `max` repetition values.
	  const opREP = function (opIndex, phraseIndex, sysData) {
	    let astLength;
	    let repCharIndex;
	    let repPhrase;
	    let repCount;
	    const op = opcodes[opIndex];
	    if (op.max === 0) {
	      // this is an empty-string acceptor
	      // deprecated: use the TLS empty string operator, "", instead
	      sysData.state = id.EMPTY;
	      sysData.phraseLength = 0;
	      return;
	    }
	    repCharIndex = phraseIndex;
	    repPhrase = 0;
	    repCount = 0;
	    const ulen = sysData.uFrame.length();
	    const plen = sysData.pFrame.length();
	    if (thisThis.ast) {
	      astLength = thisThis.ast.getLength();
	    }
	    const TRUE = true;
	    while (TRUE) {
	      if (repCharIndex >= charsEnd) {
	        /* exit on end of input string */
	        break;
	      }
	      opExecute(opIndex + 1, repCharIndex, sysData);
	      if (sysData.state === id.NOMATCH) {
	        /* always end if the child node fails */
	        break;
	      }
	      if (sysData.state === id.EMPTY) {
	        /* REP always succeeds when the child node returns an empty phrase */
	        /* this may not seem obvious, but that's the way it works out */
	        break;
	      }
	      repCount += 1;
	      repPhrase += sysData.phraseLength;
	      repCharIndex += sysData.phraseLength;
	      if (repCount === op.max) {
	        /* end on maxed out reps */
	        break;
	      }
	    }
	    /* evaluate the match count according to the min, max values */
	    if (sysData.state === id.EMPTY) {
	      sysData.state = repPhrase === 0 ? id.EMPTY : id.MATCH;
	      sysData.phraseLength = repPhrase;
	    } else if (repCount >= op.min) {
	      sysData.state = repPhrase === 0 ? id.EMPTY : id.MATCH;
	      sysData.phraseLength = repPhrase;
	    } else {
	      sysData.state = id.NOMATCH;
	      sysData.phraseLength = 0;
	      /* reset the back referencing frames on failure */
	      sysData.uFrame.pop(ulen);
	      sysData.pFrame.pop(plen);
	      if (thisThis.ast) {
	        thisThis.ast.setLength(astLength);
	      }
	    }
	  };
	  // Validate the callback function's returned sysData values.
	  // It's the user's responsibility to get them right
	  // but `RNM` fails if not.
	  const validateRnmCallbackResult = function (rule, sysData, charsLeft, down) {
	    if (sysData.phraseLength > charsLeft) {
	      let str = `${thisFileName}opRNM(${rule.name}): callback function error: `;
	      str += `sysData.phraseLength: ${sysData.phraseLength}`;
	      str += ` must be <= remaining chars: ${charsLeft}`;
	      throw new Error(str);
	    }
	    switch (sysData.state) {
	      case id.ACTIVE:
	        if (down !== true) {
	          throw new Error(
	            `${thisFileName}opRNM(${rule.name}): callback function return error. ACTIVE state not allowed.`
	          );
	        }
	        break;
	      case id.EMPTY:
	        sysData.phraseLength = 0;
	        break;
	      case id.MATCH:
	        if (sysData.phraseLength === 0) {
	          sysData.state = id.EMPTY;
	        }
	        break;
	      case id.NOMATCH:
	        sysData.phraseLength = 0;
	        break;
	      default:
	        throw new Error(
	          `${thisFileName}opRNM(${rule.name}): callback function return error. Unrecognized return state: ${sysData.state}`
	        );
	    }
	  };
	  // The `RNM` operator.<br>
	  // This operator will acts as a root node for a parse tree branch below and
	  // returns the matched phrase to its parent.
	  // However, its larger responsibility is handling user-defined callback functions, back references and `AST` nodes.
	  // Note that the `AST` is a separate object, but `RNM` calls its functions to create its nodes.
	  // See [`ast.js`](./ast.html) for usage.
	  const opRNM = function (opIndex, phraseIndex, sysData) {
	    let astLength;
	    let astDefined;
	    let savedOpcodes;
	    let ulen;
	    let plen;
	    let saveFrame;
	    const op = opcodes[opIndex];
	    const rule = rules[op.index];
	    const callback = ruleCallbacks[rule.index];
	    const notLookAround = !inLookAround();
	    /* ignore AST and back references in lookaround */
	    if (notLookAround) {
	      /* begin AST and back references */
	      astDefined = thisThis.ast && thisThis.ast.ruleDefined(op.index);
	      if (astDefined) {
	        astLength = thisThis.ast.getLength();
	        thisThis.ast.down(op.index, rules[op.index].name);
	      }
	      ulen = sysData.uFrame.length();
	      plen = sysData.pFrame.length();
	      sysData.uFrame.push();
	      sysData.pFrame.push();
	      saveFrame = sysData.pFrame;
	      sysData.pFrame = new backRef();
	    }
	    if (callback === null) {
	      /* no callback - just execute the rule */
	      savedOpcodes = opcodes;
	      opcodes = rule.opcodes;
	      opExecute(0, phraseIndex, sysData);
	      opcodes = savedOpcodes;
	    } else {
	      /* call user's callback */
	      const charsLeft = charsEnd - phraseIndex;
	      sysData.ruleIndex = rule.index;
	      callback(sysData, chars, phraseIndex, syntaxData);
	      validateRnmCallbackResult(rule, sysData, charsLeft, true);
	      if (sysData.state === id.ACTIVE) {
	        savedOpcodes = opcodes;
	        opcodes = rule.opcodes;
	        opExecute(0, phraseIndex, sysData);
	        opcodes = savedOpcodes;
	        sysData.ruleIndex = rule.index;
	        callback(sysData, chars, phraseIndex, syntaxData);
	        validateRnmCallbackResult(rule, sysData, charsLeft, false);
	      } /* implied else clause: just accept the callback sysData - RNM acting as UDT */
	    }
	    if (notLookAround) {
	      /* end AST */
	      if (astDefined) {
	        if (sysData.state === id.NOMATCH) {
	          thisThis.ast.setLength(astLength);
	        } else {
	          thisThis.ast.up(op.index, rule.name, phraseIndex, sysData.phraseLength);
	        }
	      }
	      /* end back reference */
	      sysData.pFrame = saveFrame;
	      if (sysData.state === id.NOMATCH) {
	        sysData.uFrame.pop(ulen);
	        sysData.pFrame.pop(plen);
	      } else if (rule.isBkr) {
	        /* save phrase on both the parent and universal frames */
	        /* BKR operator will decide which to use later */
	        sysData.pFrame.savePhrase(rule.lower, phraseIndex, sysData.phraseLength);
	        sysData.uFrame.savePhrase(rule.lower, phraseIndex, sysData.phraseLength);
	      }
	    }
	  };
	  // Validate the callback function's returned sysData values.
	  // It's the user's responsibility to get it right but `UDT` fails if not.
	  const validateUdtCallbackResult = function (udt, sysData, charsLeft) {
	    if (sysData.phraseLength > charsLeft) {
	      let str = `${thisFileName}opUDT(${udt.name}): callback function error: `;
	      str += `sysData.phraseLength: ${sysData.phraseLength}`;
	      str += ` must be <= remaining chars: ${charsLeft}`;
	      throw new Error(str);
	    }
	    switch (sysData.state) {
	      case id.ACTIVE:
	        throw new Error(`${thisFileName}opUDT(${udt.name}): callback function return error. ACTIVE state not allowed.`);
	      case id.EMPTY:
	        if (udt.empty === false) {
	          throw new Error(`${thisFileName}opUDT(${udt.name}): callback function return error. May not return EMPTY.`);
	        } else {
	          sysData.phraseLength = 0;
	        }
	        break;
	      case id.MATCH:
	        if (sysData.phraseLength === 0) {
	          if (udt.empty === false) {
	            throw new Error(`${thisFileName}opUDT(${udt.name}): callback function return error. May not return EMPTY.`);
	          } else {
	            sysData.state = id.EMPTY;
	          }
	        }
	        break;
	      case id.NOMATCH:
	        sysData.phraseLength = 0;
	        break;
	      default:
	        throw new Error(
	          `${thisFileName}opUDT(${udt.name}): callback function return error. Unrecognized return state: ${sysData.state}`
	        );
	    }
	  };
	  // The `UDT` operator.<br>
	  // Simply calls the user's callback function, but operates like `RNM` with regard to the `AST`
	  // and back referencing.
	  // There is some ambiguity here. `UDT`s act as terminals for phrase recognition but as named rules
	  // for `AST` nodes and back referencing.
	  // See [`ast.js`](./ast.html) for usage.
	  const opUDT = function (opIndex, phraseIndex, sysData) {
	    let astLength;
	    let astIndex;
	    let astDefined;
	    let ulen;
	    let plen;
	    let saveFrame;
	    const op = opcodes[opIndex];
	    const udt = udts[op.index];
	    sysData.UdtIndex = udt.index;

	    const notLookAround = !inLookAround();
	    /* ignore AST and back references in lookaround */
	    if (notLookAround) {
	      /* begin AST and back reference */
	      astDefined = thisThis.ast && thisThis.ast.udtDefined(op.index);
	      if (astDefined) {
	        astIndex = rules.length + op.index;
	        astLength = thisThis.ast.getLength();
	        thisThis.ast.down(astIndex, udt.name);
	      }
	      /* NOTE: push and pop of the back reference frame is normally not necessary */
	      /* only in the case that the UDT calls evaluateRule() or evaluateUdt() */
	      ulen = sysData.uFrame.length();
	      plen = sysData.pFrame.length();
	      sysData.uFrame.push();
	      sysData.pFrame.push();
	      saveFrame = sysData.pFrame;
	      sysData.pFrame = new backRef();
	    }
	    /* call the UDT */
	    const charsLeft = charsEnd - phraseIndex;
	    udtCallbacks[op.index](sysData, chars, phraseIndex, syntaxData);
	    validateUdtCallbackResult(udt, sysData, charsLeft);
	    if (notLookAround) {
	      /* end AST */
	      if (astDefined) {
	        if (sysData.state === id.NOMATCH) {
	          thisThis.ast.setLength(astLength);
	        } else {
	          thisThis.ast.up(astIndex, udt.name, phraseIndex, sysData.phraseLength);
	        }
	      }
	      /* end back reference */
	      sysData.pFrame = saveFrame;
	      if (sysData.state === id.NOMATCH) {
	        sysData.uFrame.pop(ulen);
	        sysData.pFrame.pop(plen);
	      } else if (udt.isBkr) {
	        /* save phrase on both the parent and universal frames */
	        /* BKR operator will decide which to use later */
	        sysData.pFrame.savePhrase(udt.lower, phraseIndex, sysData.phraseLength);
	        sysData.uFrame.savePhrase(udt.lower, phraseIndex, sysData.phraseLength);
	      }
	    }
	  };
	  // The `AND` operator.<br>
	  // This is the positive `look ahead` operator.
	  // Executes its single child node, returning the EMPTY state
	  // if it succeedsand NOMATCH if it fails.
	  // *Always* backtracks on any matched phrase and returns EMPTY on success.
	  const opAND = function (opIndex, phraseIndex, sysData) {
	    lookAround.push({
	      lookAround: id.LOOKAROUND_AHEAD,
	      anchor: phraseIndex,
	      charsEnd,
	      charsLength,
	    });
	    charsEnd = chars.length;
	    charsLength = chars.length - charsBegin;
	    opExecute(opIndex + 1, phraseIndex, sysData);
	    const pop = lookAround.pop();
	    charsEnd = pop.charsEnd;
	    charsLength = pop.charsLength;
	    sysData.phraseLength = 0;
	    switch (sysData.state) {
	      case id.EMPTY:
	        sysData.state = id.EMPTY;
	        break;
	      case id.MATCH:
	        sysData.state = id.EMPTY;
	        break;
	      case id.NOMATCH:
	        sysData.state = id.NOMATCH;
	        break;
	      default:
	        throw new Error(`opAND: invalid state ${sysData.state}`);
	    }
	  };
	  // The `NOT` operator.<br>
	  // This is the negative `look ahead` operator.
	  // Executes its single child node, returning the EMPTY state
	  // if it *fails* and NOMATCH if it succeeds.
	  // *Always* backtracks on any matched phrase and returns EMPTY
	  // on success (failure of its child node).
	  const opNOT = function (opIndex, phraseIndex, sysData) {
	    lookAround.push({
	      lookAround: id.LOOKAROUND_AHEAD,
	      anchor: phraseIndex,
	      charsEnd,
	      charsLength,
	    });
	    charsEnd = chars.length;
	    charsLength = chars.length - charsBegin;
	    opExecute(opIndex + 1, phraseIndex, sysData);
	    const pop = lookAround.pop();
	    charsEnd = pop.charsEnd;
	    charsLength = pop.charsLength;
	    sysData.phraseLength = 0;
	    switch (sysData.state) {
	      case id.EMPTY:
	      case id.MATCH:
	        sysData.state = id.NOMATCH;
	        break;
	      case id.NOMATCH:
	        sysData.state = id.EMPTY;
	        break;
	      default:
	        throw new Error(`opNOT: invalid state ${sysData.state}`);
	    }
	  };
	  // The `TRG` operator.<br>
	  // Succeeds if the single first character of the phrase is
	  // within the `min - max` range.
	  const opTRG = function (opIndex, phraseIndex, sysData) {
	    const op = opcodes[opIndex];
	    sysData.state = id.NOMATCH;
	    if (phraseIndex < charsEnd) {
	      if (op.min <= chars[phraseIndex] && chars[phraseIndex] <= op.max) {
	        sysData.state = id.MATCH;
	        sysData.phraseLength = 1;
	      }
	    }
	  };
	  // The `TBS` operator.<br>
	  // Matches its pre-defined phrase against the input string.
	  // All characters must match exactly.
	  // Case-sensitive literal strings (`'string'` & `%s"string"`) are translated to `TBS`
	  // operators by `apg`.
	  // Phrase length of zero is not allowed.
	  // Empty phrases can only be defined with `TLS` operators.
	  const opTBS = function (opIndex, phraseIndex, sysData) {
	    let i;
	    const op = opcodes[opIndex];
	    const len = op.string.length;
	    sysData.state = id.NOMATCH;
	    if (phraseIndex + len <= charsEnd) {
	      for (i = 0; i < len; i += 1) {
	        if (chars[phraseIndex + i] !== op.string[i]) {
	          return;
	        }
	      }
	      sysData.state = id.MATCH;
	      sysData.phraseLength = len;
	    } /* implied else NOMATCH */
	  };
	  // The `TLS` operator.<br>
	  // Matches its pre-defined phrase against the input string.
	  // A case-insensitive match is attempted for ASCII alphbetical characters.
	  // `TLS` is the only operator that explicitly allows empty phrases.
	  // `apg` will fail for empty `TBS`, case-sensitive strings (`''`) or
	  // zero repetitions (`0*0RuleName` or `0RuleName`).
	  const opTLS = function (opIndex, phraseIndex, sysData) {
	    let i;
	    let code;
	    const op = opcodes[opIndex];
	    sysData.state = id.NOMATCH;
	    const len = op.string.length;
	    if (len === 0) {
	      /* EMPTY match allowed for TLS */
	      sysData.state = id.EMPTY;
	      return;
	    }
	    if (phraseIndex + len <= charsEnd) {
	      for (i = 0; i < len; i += 1) {
	        code = chars[phraseIndex + i];
	        if (code >= 65 && code <= 90) {
	          code += 32;
	        }
	        if (code !== op.string[i]) {
	          return;
	        }
	      }
	      sysData.state = id.MATCH;
	      sysData.phraseLength = len;
	    } /* implied else NOMATCH */
	  };
	  // The `ABG` operator.<br>
	  // This is an "anchor" for the beginning of the string, similar to the familiar regex `^` anchor.
	  // An anchor matches a position rather than a phrase.
	  // Returns EMPTY if `phraseIndex` is 0, NOMATCH otherwise.
	  const opABG = function (opIndex, phraseIndex, sysData) {
	    sysData.state = id.NOMATCH;
	    sysData.phraseLength = 0;
	    sysData.state = phraseIndex === 0 ? id.EMPTY : id.NOMATCH;
	  };
	  // The `AEN` operator.<br>
	  // This is an "anchor" for the end of the string, similar to the familiar regex `$` anchor.
	  // An anchor matches a position rather than a phrase.
	  // Returns EMPTY if `phraseIndex` equals the input string length, NOMATCH otherwise.
	  const opAEN = function (opIndex, phraseIndex, sysData) {
	    sysData.state = id.NOMATCH;
	    sysData.phraseLength = 0;
	    sysData.state = phraseIndex === chars.length ? id.EMPTY : id.NOMATCH;
	  };
	  // The `BKR` operator.<br>
	  // The back reference operator.
	  // Matches the last matched phrase of the named rule or UDT against the input string.
	  // For ASCII alphbetical characters the match may be case sensitive (`%s`) or insensitive (`%i`),
	  // depending on the back reference definition.
	  // For `universal` mode (`%u`) matches the last phrase found anywhere in the grammar.
	  // For `parent frame` mode (`%p`) matches the last phrase found in the parent rule only.
	  const opBKR = function (opIndex, phraseIndex, sysData) {
	    let i;
	    let code;
	    let lmcode;
	    let lower;
	    const op = opcodes[opIndex];
	    sysData.state = id.NOMATCH;
	    if (op.index < rules.length) {
	      lower = rules[op.index].lower;
	    } else {
	      lower = udts[op.index - rules.length].lower;
	    }
	    const frame = op.bkrMode === id.BKR_MODE_PM ? sysData.pFrame.getPhrase(lower) : sysData.uFrame.getPhrase(lower);
	    const insensitive = op.bkrCase === id.BKR_MODE_CI;
	    if (frame === null) {
	      return;
	    }
	    const lmIndex = frame.phraseIndex;
	    const len = frame.phraseLength;
	    if (len === 0) {
	      sysData.state = id.EMPTY;
	      return;
	    }
	    if (phraseIndex + len <= charsEnd) {
	      if (insensitive) {
	        /* case-insensitive match */
	        for (i = 0; i < len; i += 1) {
	          code = chars[phraseIndex + i];
	          lmcode = chars[lmIndex + i];
	          if (code >= 65 && code <= 90) {
	            code += 32;
	          }
	          if (lmcode >= 65 && lmcode <= 90) {
	            lmcode += 32;
	          }
	          if (code !== lmcode) {
	            return;
	          }
	        }
	        sysData.state = id.MATCH;
	        sysData.phraseLength = len;
	      } else {
	        /* case-sensitive match */
	        for (i = 0; i < len; i += 1) {
	          code = chars[phraseIndex + i];
	          lmcode = chars[lmIndex + i];
	          if (code !== lmcode) {
	            return;
	          }
	        }
	      }
	      sysData.state = id.MATCH;
	      sysData.phraseLength = len;
	    }
	  };
	  // The `BKA` operator.<br>
	  // This is the positive `look behind` operator.
	  // It's child node is parsed right-to-left.
	  // Returns the EMPTY state if a match is found, NOMATCH otherwise.
	  // Like the look ahead operators, it always backtracks to `phraseIndex`.
	  const opBKA = function (opIndex, phraseIndex, sysData) {
	    lookAround.push({
	      lookAround: id.LOOKAROUND_BEHIND,
	      anchor: phraseIndex,
	    });
	    opExecute(opIndex + 1, phraseIndex, sysData);
	    lookAround.pop();
	    sysData.phraseLength = 0;
	    switch (sysData.state) {
	      case id.EMPTY:
	        sysData.state = id.EMPTY;
	        break;
	      case id.MATCH:
	        sysData.state = id.EMPTY;
	        break;
	      case id.NOMATCH:
	        sysData.state = id.NOMATCH;
	        break;
	      default:
	        throw new Error(`opBKA: invalid state ${sysData.state}`);
	    }
	  };
	  // The `BKN` operator.<br>
	  // This is the negative `look behind` operator.
	  // It's child node is parsed right-to-left.
	  // Returns the EMPTY state if a match is *not* found, NOMATCH otherwise.
	  // Like the look ahead operators, it always backtracks to `phraseIndex`.
	  const opBKN = function (opIndex, phraseIndex, sysData) {
	    // let op;
	    // op = opcodes[opIndex];
	    lookAround.push({
	      lookAround: id.LOOKAROUND_BEHIND,
	      anchor: phraseIndex,
	    });
	    opExecute(opIndex + 1, phraseIndex, sysData);
	    lookAround.pop();
	    sysData.phraseLength = 0;
	    switch (sysData.state) {
	      case id.EMPTY:
	      case id.MATCH:
	        sysData.state = id.NOMATCH;
	        break;
	      case id.NOMATCH:
	        sysData.state = id.EMPTY;
	        break;
	      default:
	        throw new Error(`opBKN: invalid state ${sysData.state}`);
	    }
	  };
	  // The right-to-left `CAT` operator.<br>
	  // Called for `CAT` operators when in look behind mode.
	  // Calls its child nodes from right to left concatenating matched phrases right to left.
	  const opCATBehind = function (opIndex, phraseIndex, sysData) {
	    let success;
	    let astLength;
	    let catCharIndex;
	    let catMatched;
	    const op = opcodes[opIndex];
	    const ulen = sysData.uFrame.length();
	    const plen = sysData.pFrame.length();
	    if (thisThis.ast) {
	      astLength = thisThis.ast.getLength();
	    }
	    success = true;
	    catCharIndex = phraseIndex;
	    catMatched = 0;
	    // catPhrase = 0;
	    for (let i = op.children.length - 1; i >= 0; i -= 1) {
	      opExecute(op.children[i], catCharIndex, sysData);
	      catCharIndex -= sysData.phraseLength;
	      catMatched += sysData.phraseLength;
	      // catPhrase += sysData.phraseLength;
	      if (sysData.state === id.NOMATCH) {
	        success = false;
	        break;
	      }
	    }
	    if (success) {
	      sysData.state = catMatched === 0 ? id.EMPTY : id.MATCH;
	      sysData.phraseLength = catMatched;
	    } else {
	      sysData.state = id.NOMATCH;
	      sysData.phraseLength = 0;
	      sysData.uFrame.pop(ulen);
	      sysData.pFrame.pop(plen);
	      if (thisThis.ast) {
	        thisThis.ast.setLength(astLength);
	      }
	    }
	  };
	  // The right-to-left `REP` operator.<br>
	  // Called for `REP` operators in look behind mode.
	  // Makes repeated calls to its child node, concatenating matched phrases right to left.
	  const opREPBehind = function (opIndex, phraseIndex, sysData) {
	    let astLength;
	    let repCharIndex;
	    let repPhrase;
	    let repCount;
	    const op = opcodes[opIndex];
	    repCharIndex = phraseIndex;
	    repPhrase = 0;
	    repCount = 0;
	    const ulen = sysData.uFrame.length();
	    const plen = sysData.pFrame.length();
	    if (thisThis.ast) {
	      astLength = thisThis.ast.getLength();
	    }
	    const TRUE = true;
	    while (TRUE) {
	      if (repCharIndex <= 0) {
	        /* exit on end of input string */
	        break;
	      }
	      opExecute(opIndex + 1, repCharIndex, sysData);
	      if (sysData.state === id.NOMATCH) {
	        /* always end if the child node fails */
	        break;
	      }
	      if (sysData.state === id.EMPTY) {
	        /* REP always succeeds when the child node returns an empty phrase */
	        /* this may not seem obvious, but that's the way it works out */
	        break;
	      }
	      repCount += 1;
	      repPhrase += sysData.phraseLength;
	      repCharIndex -= sysData.phraseLength;
	      if (repCount === op.max) {
	        /* end on maxed out reps */
	        break;
	      }
	    }
	    /* evaluate the match count according to the min, max values */
	    if (sysData.state === id.EMPTY) {
	      sysData.state = repPhrase === 0 ? id.EMPTY : id.MATCH;
	      sysData.phraseLength = repPhrase;
	    } else if (repCount >= op.min) {
	      sysData.state = repPhrase === 0 ? id.EMPTY : id.MATCH;
	      sysData.phraseLength = repPhrase;
	    } else {
	      sysData.state = id.NOMATCH;
	      sysData.phraseLength = 0;
	      sysData.uFrame.pop(ulen);
	      sysData.pFrame.pop(plen);
	      if (thisThis.ast) {
	        thisThis.ast.setLength(astLength);
	      }
	    }
	  };
	  // The right-to-left `TRG` operator.<br>
	  // Called for `TRG` operators in look behind mode.
	  // Matches a single character at `phraseIndex - 1` to the `min` - `max` range.
	  const opTRGBehind = function (opIndex, phraseIndex, sysData) {
	    const op = opcodes[opIndex];
	    sysData.state = id.NOMATCH;
	    sysData.phraseLength = 0;
	    if (phraseIndex > 0) {
	      const char = chars[phraseIndex - 1];
	      if (op.min <= char && char <= op.max) {
	        sysData.state = id.MATCH;
	        sysData.phraseLength = 1;
	      }
	    }
	  };
	  // The right-to-left `TBS` operator.<br>
	  // Called for `TBS` operators in look behind mode.
	  // Matches the `TBS` phrase to the left of `phraseIndex`.
	  const opTBSBehind = function (opIndex, phraseIndex, sysData) {
	    let i;
	    const op = opcodes[opIndex];
	    sysData.state = id.NOMATCH;
	    const len = op.string.length;
	    const beg = phraseIndex - len;
	    if (beg >= 0) {
	      for (i = 0; i < len; i += 1) {
	        if (chars[beg + i] !== op.string[i]) {
	          return;
	        }
	      }
	      sysData.state = id.MATCH;
	      sysData.phraseLength = len;
	    }
	  };
	  // The right-to-left `TLS` operator.<br>
	  // Called for `TLS` operators in look behind mode.
	  // Matches the `TLS` phrase to the left of `phraseIndex`.
	  const opTLSBehind = function (opIndex, phraseIndex, sysData) {
	    let char;
	    const op = opcodes[opIndex];
	    sysData.state = id.NOMATCH;
	    const len = op.string.length;
	    if (len === 0) {
	      /* EMPTY match allowed for TLS */
	      sysData.state = id.EMPTY;
	      return;
	    }
	    const beg = phraseIndex - len;
	    if (beg >= 0) {
	      for (let i = 0; i < len; i += 1) {
	        char = chars[beg + i];
	        if (char >= 65 && char <= 90) {
	          char += 32;
	        }
	        if (char !== op.string[i]) {
	          return;
	        }
	      }
	      sysData.state = id.MATCH;
	      sysData.phraseLength = len;
	    }
	  };
	  // The right-to-left back reference operator.<br>
	  // Matches the back referenced phrase to the left of `phraseIndex`.
	  const opBKRBehind = function (opIndex, phraseIndex, sysData) {
	    let i;
	    let code;
	    let lmcode;
	    let lower;
	    const op = opcodes[opIndex];
	    /* NOMATCH default */
	    sysData.state = id.NOMATCH;
	    sysData.phraseLength = 0;
	    if (op.index < rules.length) {
	      lower = rules[op.index].lower;
	    } else {
	      lower = udts[op.index - rules.length].lower;
	    }
	    const frame = op.bkrMode === id.BKR_MODE_PM ? sysData.pFrame.getPhrase(lower) : sysData.uFrame.getPhrase(lower);
	    const insensitive = op.bkrCase === id.BKR_MODE_CI;
	    if (frame === null) {
	      return;
	    }
	    const lmIndex = frame.phraseIndex;
	    const len = frame.phraseLength;
	    if (len === 0) {
	      sysData.state = id.EMPTY;
	      sysData.phraseLength = 0;
	      return;
	    }
	    const beg = phraseIndex - len;
	    if (beg >= 0) {
	      if (insensitive) {
	        /* case-insensitive match */
	        for (i = 0; i < len; i += 1) {
	          code = chars[beg + i];
	          lmcode = chars[lmIndex + i];
	          if (code >= 65 && code <= 90) {
	            code += 32;
	          }
	          if (lmcode >= 65 && lmcode <= 90) {
	            lmcode += 32;
	          }
	          if (code !== lmcode) {
	            return;
	          }
	        }
	        sysData.state = id.MATCH;
	        sysData.phraseLength = len;
	      } else {
	        /* case-sensitive match */
	        for (i = 0; i < len; i += 1) {
	          code = chars[beg + i];
	          lmcode = chars[lmIndex + i];
	          if (code !== lmcode) {
	            return;
	          }
	        }
	      }
	      sysData.state = id.MATCH;
	      sysData.phraseLength = len;
	    }
	  };
	  // Generalized execution function.<br>
	  // Having a single, generalized function, allows a single location
	  // for tracing and statistics gathering functions to be called.
	  // Tracing and statistics are handled in separate objects.
	  // However, the parser calls their API to build the object data records.
	  // See [`trace.js`](./trace.html) and [`stats.js`](./stats.html) for their
	  // usage.
	  opExecute = function opExecuteFunc(opIndex, phraseIndex, sysData) {
	    let ret = true;
	    const op = opcodes[opIndex];
	    nodeHits += 1;
	    if (nodeHits > limitNodeHits) {
	      throw new Error(`parser: maximum number of node hits exceeded: ${limitNodeHits}`);
	    }
	    treeDepth += 1;
	    if (treeDepth > maxTreeDepth) {
	      maxTreeDepth = treeDepth;
	      if (maxTreeDepth > limitTreeDepth) {
	        throw new Error(`parser: maximum parse tree depth exceeded: ${limitTreeDepth}`);
	      }
	    }
	    sysData.refresh();
	    if (thisThis.trace !== null) {
	      /* collect the trace record for down the parse tree */
	      const lk = lookAroundValue();
	      thisThis.trace.down(op, sysData.state, phraseIndex, sysData.phraseLength, lk.anchor, lk.lookAround);
	    }
	    if (inLookBehind()) {
	      switch (op.type) {
	        case id.ALT:
	          opALT(opIndex, phraseIndex, sysData);
	          break;
	        case id.CAT:
	          opCATBehind(opIndex, phraseIndex, sysData);
	          break;
	        case id.REP:
	          opREPBehind(opIndex, phraseIndex, sysData);
	          break;
	        case id.RNM:
	          opRNM(opIndex, phraseIndex, sysData);
	          break;
	        case id.UDT:
	          opUDT(opIndex, phraseIndex, sysData);
	          break;
	        case id.AND:
	          opAND(opIndex, phraseIndex, sysData);
	          break;
	        case id.NOT:
	          opNOT(opIndex, phraseIndex, sysData);
	          break;
	        case id.TRG:
	          opTRGBehind(opIndex, phraseIndex, sysData);
	          break;
	        case id.TBS:
	          opTBSBehind(opIndex, phraseIndex, sysData);
	          break;
	        case id.TLS:
	          opTLSBehind(opIndex, phraseIndex, sysData);
	          break;
	        case id.BKR:
	          opBKRBehind(opIndex, phraseIndex, sysData);
	          break;
	        case id.BKA:
	          opBKA(opIndex, phraseIndex, sysData);
	          break;
	        case id.BKN:
	          opBKN(opIndex, phraseIndex, sysData);
	          break;
	        case id.ABG:
	          opABG(opIndex, phraseIndex, sysData);
	          break;
	        case id.AEN:
	          opAEN(opIndex, phraseIndex, sysData);
	          break;
	        default:
	          ret = false;
	          break;
	      }
	    } else {
	      switch (op.type) {
	        case id.ALT:
	          opALT(opIndex, phraseIndex, sysData);
	          break;
	        case id.CAT:
	          opCAT(opIndex, phraseIndex, sysData);
	          break;
	        case id.REP:
	          opREP(opIndex, phraseIndex, sysData);
	          break;
	        case id.RNM:
	          opRNM(opIndex, phraseIndex, sysData);
	          break;
	        case id.UDT:
	          opUDT(opIndex, phraseIndex, sysData);
	          break;
	        case id.AND:
	          opAND(opIndex, phraseIndex, sysData);
	          break;
	        case id.NOT:
	          opNOT(opIndex, phraseIndex, sysData);
	          break;
	        case id.TRG:
	          opTRG(opIndex, phraseIndex, sysData);
	          break;
	        case id.TBS:
	          opTBS(opIndex, phraseIndex, sysData);
	          break;
	        case id.TLS:
	          opTLS(opIndex, phraseIndex, sysData);
	          break;
	        case id.BKR:
	          opBKR(opIndex, phraseIndex, sysData);
	          break;
	        case id.BKA:
	          opBKA(opIndex, phraseIndex, sysData);
	          break;
	        case id.BKN:
	          opBKN(opIndex, phraseIndex, sysData);
	          break;
	        case id.ABG:
	          opABG(opIndex, phraseIndex, sysData);
	          break;
	        case id.AEN:
	          opAEN(opIndex, phraseIndex, sysData);
	          break;
	        default:
	          ret = false;
	          break;
	      }
	    }
	    if (!inLookAround() && phraseIndex + sysData.phraseLength > maxMatched) {
	      maxMatched = phraseIndex + sysData.phraseLength;
	    }
	    if (thisThis.stats !== null) {
	      /* collect the statistics */
	      thisThis.stats.collect(op, sysData);
	    }
	    if (thisThis.trace !== null) {
	      /* collect the trace record for up the parse tree */
	      const lk = lookAroundValue();
	      thisThis.trace.up(op, sysData.state, phraseIndex, sysData.phraseLength, lk.anchor, lk.lookAround);
	    }
	    treeDepth -= 1;
	    return ret;
	  };
	};
	return parser$1;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var stats;
var hasRequiredStats;

function requireStats () {
	if (hasRequiredStats) return stats;
	hasRequiredStats = 1;
	// This module is the constructor for the statistics gathering object.
	// The statistics are nothing more than keeping a count of the
	// number of times each node in the parse tree is traversed.
	//
	// Counts are collected for each of the individual types of operators.
	// Additionally, counts are collected for each of the individually named
	// `RNM` and `UDT` operators.
	stats = function statsFunc() {
	  const id = requireIdentifiers();
	  const utils = requireUtilities();
	  const style = requireStyle();

	  const thisFileName = 'stats.js: ';
	  let rules = [];
	  let udts = [];
	  const stats = [];
	  let totals;
	  const ruleStats = [];
	  const udtStats = [];
	  this.statsObject = 'statsObject';
	  const nameId = 'stats';
	  /* `Array.sort()` callback function for sorting `RNM` and `UDT` operators alphabetically by name. */
	  const sortAlpha = function sortAlpha(lhs, rhs) {
	    if (lhs.lower < rhs.lower) {
	      return -1;
	    }
	    if (lhs.lower > rhs.lower) {
	      return 1;
	    }
	    return 0;
	  };
	  /* `Array.sort()` callback function for sorting `RNM` and `UDT` operators by hit count. */
	  const sortHits = function sortHits(lhs, rhs) {
	    if (lhs.total < rhs.total) {
	      return 1;
	    }
	    if (lhs.total > rhs.total) {
	      return -1;
	    }
	    return sortAlpha(lhs, rhs);
	  };
	  /* `Array.sort()` callback function for sorting `RNM` and `UDT` operators by index */
	  /* (in the order in which they appear in the SABNF grammar). */
	  const sortIndex = function sortIndex(lhs, rhs) {
	    if (lhs.index < rhs.index) {
	      return -1;
	    }
	    if (lhs.index > rhs.index) {
	      return 1;
	    }
	    return 0;
	  };
	  const EmptyStat = function EmptyStat() {
	    this.empty = 0;
	    this.match = 0;
	    this.nomatch = 0;
	    this.total = 0;
	  };
	  /* Zero out all stats */
	  const clear = function clear() {
	    stats.length = 0;
	    totals = new EmptyStat();
	    stats[id.ALT] = new EmptyStat();
	    stats[id.CAT] = new EmptyStat();
	    stats[id.REP] = new EmptyStat();
	    stats[id.RNM] = new EmptyStat();
	    stats[id.TRG] = new EmptyStat();
	    stats[id.TBS] = new EmptyStat();
	    stats[id.TLS] = new EmptyStat();
	    stats[id.UDT] = new EmptyStat();
	    stats[id.AND] = new EmptyStat();
	    stats[id.NOT] = new EmptyStat();
	    stats[id.BKR] = new EmptyStat();
	    stats[id.BKA] = new EmptyStat();
	    stats[id.BKN] = new EmptyStat();
	    stats[id.ABG] = new EmptyStat();
	    stats[id.AEN] = new EmptyStat();
	    ruleStats.length = 0;
	    for (let i = 0; i < rules.length; i += 1) {
	      ruleStats.push({
	        empty: 0,
	        match: 0,
	        nomatch: 0,
	        total: 0,
	        name: rules[i].name,
	        lower: rules[i].lower,
	        index: rules[i].index,
	      });
	    }
	    if (udts.length > 0) {
	      udtStats.length = 0;
	      for (let i = 0; i < udts.length; i += 1) {
	        udtStats.push({
	          empty: 0,
	          match: 0,
	          nomatch: 0,
	          total: 0,
	          name: udts[i].name,
	          lower: udts[i].lower,
	          index: udts[i].index,
	        });
	      }
	    }
	  };
	  /* increment the designated operator hit count by one */
	  const incStat = function incStat(stat, state) {
	    stat.total += 1;
	    switch (state) {
	      case id.EMPTY:
	        stat.empty += 1;
	        break;
	      case id.MATCH:
	        stat.match += 1;
	        break;
	      case id.NOMATCH:
	        stat.nomatch += 1;
	        break;
	      default:
	        throw new Error(`${thisFileName}collect(): incStat(): unrecognized state: ${state}`);
	    }
	  };
	  /* helper for toHtml() */
	  const displayRow = function displayRow(name, stat) {
	    let html = '';
	    html += '<tr>';
	    html += `<td class="${style.CLASS_ACTIVE}">${name}</td>`;
	    html += `<td class="${style.CLASS_EMPTY}">${stat.empty}</td>`;
	    html += `<td class="${style.CLASS_MATCH}">${stat.match}</td>`;
	    html += `<td class="${style.CLASS_NOMATCH}">${stat.nomatch}</td>`;
	    html += `<td class="${style.CLASS_ACTIVE}">${stat.total}</td>`;
	    html += '</tr>\n';
	    return html;
	  };
	  const displayOpsOnly = function displayOpsOnly() {
	    let html = '';
	    html += displayRow('ALT', stats[id.ALT]);
	    html += displayRow('CAT', stats[id.CAT]);
	    html += displayRow('REP', stats[id.REP]);
	    html += displayRow('RNM', stats[id.RNM]);
	    html += displayRow('TRG', stats[id.TRG]);
	    html += displayRow('TBS', stats[id.TBS]);
	    html += displayRow('TLS', stats[id.TLS]);
	    html += displayRow('UDT', stats[id.UDT]);
	    html += displayRow('AND', stats[id.AND]);
	    html += displayRow('NOT', stats[id.NOT]);
	    html += displayRow('BKR', stats[id.BKR]);
	    html += displayRow('BKA', stats[id.BKA]);
	    html += displayRow('BKN', stats[id.BKN]);
	    html += displayRow('ABG', stats[id.ABG]);
	    html += displayRow('AEN', stats[id.AEN]);
	    html += displayRow('totals', totals);
	    return html;
	  };
	  /* helper for toHtml() */
	  const displayRules = function displayRules() {
	    let html = '';
	    html += '<tr><th></th><th></th><th></th><th></th><th></th></tr>\n';
	    html += '<tr><th>rules</th><th></th><th></th><th></th><th></th></tr>\n';
	    for (let i = 0; i < rules.length; i += 1) {
	      if (ruleStats[i].total > 0) {
	        html += '<tr>';
	        html += `<td class="${style.CLASS_ACTIVE}">${ruleStats[i].name}</td>`;
	        html += `<td class="${style.CLASS_EMPTY}">${ruleStats[i].empty}</td>`;
	        html += `<td class="${style.CLASS_MATCH}">${ruleStats[i].match}</td>`;
	        html += `<td class="${style.CLASS_NOMATCH}">${ruleStats[i].nomatch}</td>`;
	        html += `<td class="${style.CLASS_ACTIVE}">${ruleStats[i].total}</td>`;
	        html += '</tr>\n';
	      }
	    }
	    if (udts.length > 0) {
	      html += '<tr><th></th><th></th><th></th><th></th><th></th></tr>\n';
	      html += '<tr><th>udts</th><th></th><th></th><th></th><th></th></tr>\n';
	      for (let i = 0; i < udts.length; i += 1) {
	        if (udtStats[i].total > 0) {
	          html += '<tr>';
	          html += `<td class="${style.CLASS_ACTIVE}">${udtStats[i].name}</td>`;
	          html += `<td class="${style.CLASS_EMPTY}">${udtStats[i].empty}</td>`;
	          html += `<td class="${style.CLASS_MATCH}">${udtStats[i].match}</td>`;
	          html += `<td class="${style.CLASS_NOMATCH}">${udtStats[i].nomatch}</td>`;
	          html += `<td class="${style.CLASS_ACTIVE}">${udtStats[i].total}</td>`;
	          html += '</tr>\n';
	        }
	      }
	    }
	    return html;
	  };
	  /* called only by the parser to validate a stats object */
	  this.validate = function validate(name) {
	    let ret = false;
	    if (typeof name === 'string' && nameId === name) {
	      ret = true;
	    }
	    return ret;
	  };
	  /* no verification of input - only called by parser() */
	  this.init = function init(inputRules, inputUdts) {
	    rules = inputRules;
	    udts = inputUdts;
	    clear();
	  };
	  /* This function is the main interaction with the parser. */
	  /* The parser calls it after each node has been traversed. */
	  this.collect = function collect(op, result) {
	    incStat(totals, result.state, result.phraseLength);
	    incStat(stats[op.type], result.state, result.phraseLength);
	    if (op.type === id.RNM) {
	      incStat(ruleStats[op.index], result.state, result.phraseLength);
	    }
	    if (op.type === id.UDT) {
	      incStat(udtStats[op.index], result.state, result.phraseLength);
	    }
	  };
	  // Display the statistics as an HTML table.
	  // - *type*
	  //   - "ops" - (default) display only the total hit counts for all operator types.
	  //   - "index" - additionally, display the hit counts for the individual `RNM` and `UDT` operators ordered by index.
	  //   - "hits" - additionally, display the hit counts for the individual `RNM` and `UDT` operators by hit count.
	  //   - "alpha" - additionally, display the hit counts for the individual `RNM` and `UDT` operators by name alphabetically.
	  // - *caption* - optional caption for the table
	  this.toHtml = function toHtml(type, caption) {
	    let html = '';
	    html += `<table class="${style.CLASS_STATS}">\n`;
	    if (typeof caption === 'string') {
	      html += `<caption>${caption}</caption>\n`;
	    }
	    html += `<tr><th class="${style.CLASS_ACTIVE}">ops</th>\n`;
	    html += `<th class="${style.CLASS_EMPTY}">EMPTY</th>\n`;
	    html += `<th class="${style.CLASS_MATCH}">MATCH</th>\n`;
	    html += `<th class="${style.CLASS_NOMATCH}">NOMATCH</th>\n`;
	    html += `<th class="${style.CLASS_ACTIVE}">totals</th></tr>\n`;
	    const test = true;
	    while (test) {
	      if (type === undefined) {
	        html += displayOpsOnly();
	        break;
	      }
	      if (type === null) {
	        html += displayOpsOnly();
	        break;
	      }
	      if (type === 'ops') {
	        html += displayOpsOnly();
	        break;
	      }
	      if (type === 'index') {
	        ruleStats.sort(sortIndex);
	        if (udtStats.length > 0) {
	          udtStats.sort(sortIndex);
	        }
	        html += displayOpsOnly();
	        html += displayRules();
	        break;
	      }
	      if (type === 'hits') {
	        ruleStats.sort(sortHits);
	        if (udtStats.length > 0) {
	          udtStats.sort(sortIndex);
	        }
	        html += displayOpsOnly();
	        html += displayRules();
	        break;
	      }
	      if (type === 'alpha') {
	        ruleStats.sort(sortAlpha);
	        if (udtStats.length > 0) {
	          udtStats.sort(sortAlpha);
	        }
	        html += displayOpsOnly();
	        html += displayRules();
	        break;
	      }
	      break;
	    }
	    html += '</table>\n';
	    return html;
	  };
	  // Display the stats table in a complete HTML5 page.
	  this.toHtmlPage = function toHtmlPage(type, caption, title) {
	    return utils.htmlToPage(this.toHtml(type, caption), title);
	  };
	};
	return stats;
}

/* eslint-disable func-names */

var trace;
var hasRequiredTrace;

function requireTrace () {
	if (hasRequiredTrace) return trace;
	hasRequiredTrace = 1;
	/* eslint-disable prefer-destructuring */
	/* eslint-disable no-restricted-syntax */
	/* eslint-disable guard-for-in */
	/*  *************************************************************************************
	 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
	 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
	 *   ********************************************************************************* */
	// This module provides a means of tracing the parser through the parse tree as it goes.
	// It is the primary debugging facility for debugging both the SABNF grammar syntax
	// and the input strings that are supposed to be valid grammar sentences.
	// It is also a very informative and educational tool for understanding
	// how a parser actually operates for a given language.
	//
	// Tracing is the process of generating and saving a record of information for each passage
	// of the parser through a parse tree node. And since it traverses each node twice, once down the tree
	// and once coming back up, there are two records for each node.
	// This, obviously, has the potential of generating lots of records.
	// And since these records are normally displayed on a web page
	// it is important to have a means to limit the actual number of records generated to
	// probably no more that a few thousand. This is almost always enough to find any errors.
	// The problem is to get the *right* few thousand records.
	// Therefore, this module has a number of ways of limiting and/or filtering, the number and type of records.
	// Considerable effort has been made to make this filtering of the trace output as simple
	// and intuitive as possible.
	//
	// However, the ability to filter the trace records, or for that matter even understand what they are
	// and the information they contain, does require a minimum amount of understanding of the APG parsing
	// method. The parse tree nodes are all represented by APG operators. They break down into two natural groups.
	// - The `RNM` operators and `UDT` operators are named phrases.
	// These are names chosen by the writer of the SABNF grammar to represent special phrases of interest.
	// - All others collect, concatenate and otherwise manipulate various intermediate phrases along the way.
	//
	// There are separate means of filtering which of these operators in each of these two groups get traced.
	// Let `trace` be an instantiated `trace.js` object.
	// Prior to parsing the string, filtering the rules and UDTs can be defined as follows:
	// ```
	// trace.filter.rules["rulename"] = true;
	//     /* trace rule name "rulename" */
	// trace.filter.rules["udtname"]  = true;
	//     /* trace UDT name "udtname" */
	// trace.filter.rules["<ALL>"]    = true;
	//     /* trace all rules and UDTs (the default) */
	// trace.filter.rules["<NONE>"]   = true;
	//     /* trace no rules or UDTS */
	// ```
	// If any rule or UDT name other than "&lt;ALL>" or "&lt;NONE>" is specified, all other names are turned off.
	// Therefore, to be selective of rule names, a filter statement is required for each rule/UDT name desired.
	//
	// Filtering of the other operators follows a similar procedure.
	// ```
	// trace.filter.operators["TRG"] = true;
	//     /* trace the terminal range, TRG, operators */
	// trace.filter.operators["CAT"]  = true;
	//     /* trace the concatenations, CAT, operators */
	// trace.filter.operators["<ALL>"]    = true;
	//     /* trace all operators */
	// trace.filter.operators["<NONE>"]   = true;
	//     /* trace no operators (the default) */
	// ```
	// If any operator name other than "&lt;ALL>" or "&lt;NONE>" is specified, all other names are turned off.
	// Therefore, to be selective of operator names, a filter statement is required for each name desired.
	//
	// There is, additionally, a means for limiting the total number of filtered or saved trace records.
	// See the function, `setMaxRecords(max)` below. This will result in only the last `max` records being saved.
	//
	// (See [`apg-examples`](https://github.com/ldthomas/apg-js-examples) for examples of using `trace.js`.)
	trace = function exportTrace() {
	  const utils = requireUtilities();
	  const style = requireStyle();
	  const circular = new (requireCircularBuffer())();
	  const id = requireIdentifiers();

	  const thisFileName = 'trace.js: ';
	  const that = this;
	  const MODE_HEX = 16;
	  const MODE_DEC = 10;
	  const MODE_ASCII = 8;
	  const MODE_UNICODE = 32;
	  const MAX_PHRASE = 80;
	  const MAX_TLS = 5;
	  const records = [];
	  let maxRecords = 5000;
	  let lastRecord = -1;
	  let filteredRecords = 0;
	  let treeDepth = 0;
	  const recordStack = [];
	  let chars = null;
	  let rules = null;
	  let udts = null;
	  const operatorFilter = [];
	  const ruleFilter = [];
	  /* special trace table phrases */
	  const PHRASE_END = `<span class="${style.CLASS_LINEEND}">&bull;</span>`;
	  const PHRASE_CONTINUE = `<span class="${style.CLASS_LINEEND}">&hellip;</span>`;
	  const PHRASE_EMPTY = `<span class="${style.CLASS_EMPTY}">&#120634;</span>`;
	  /* filter the non-RNM & non-UDT operators */
	  const initOperatorFilter = function () {
	    const setOperators = function (set) {
	      operatorFilter[id.ALT] = set;
	      operatorFilter[id.CAT] = set;
	      operatorFilter[id.REP] = set;
	      operatorFilter[id.TLS] = set;
	      operatorFilter[id.TBS] = set;
	      operatorFilter[id.TRG] = set;
	      operatorFilter[id.AND] = set;
	      operatorFilter[id.NOT] = set;
	      operatorFilter[id.BKR] = set;
	      operatorFilter[id.BKA] = set;
	      operatorFilter[id.BKN] = set;
	      operatorFilter[id.ABG] = set;
	      operatorFilter[id.AEN] = set;
	    };
	    let items = 0;
	    // eslint-disable-next-line no-unused-vars
	    for (const name in that.filter.operators) {
	      items += 1;
	    }
	    if (items === 0) {
	      /* case 1: no operators specified: default: do not trace any operators */
	      setOperators(false);
	      return;
	    }
	    for (const name in that.filter.operators) {
	      const upper = name.toUpperCase();
	      if (upper === '<ALL>') {
	        /* case 2: <all> operators specified: trace all operators ignore all other operator commands */
	        setOperators(true);
	        return;
	      }
	      if (upper === '<NONE>') {
	        /* case 3: <none> operators specified: trace NO operators ignore all other operator commands */
	        setOperators(false);
	        return;
	      }
	    }
	    setOperators(false);
	    for (const name in that.filter.operators) {
	      const upper = name.toUpperCase();
	      /* case 4: one or more individual operators specified: trace 'true' operators only */
	      if (upper === 'ALT') {
	        operatorFilter[id.ALT] = that.filter.operators[name] === true;
	      } else if (upper === 'CAT') {
	        operatorFilter[id.CAT] = that.filter.operators[name] === true;
	      } else if (upper === 'REP') {
	        operatorFilter[id.REP] = that.filter.operators[name] === true;
	      } else if (upper === 'AND') {
	        operatorFilter[id.AND] = that.filter.operators[name] === true;
	      } else if (upper === 'NOT') {
	        operatorFilter[id.NOT] = that.filter.operators[name] === true;
	      } else if (upper === 'TLS') {
	        operatorFilter[id.TLS] = that.filter.operators[name] === true;
	      } else if (upper === 'TBS') {
	        operatorFilter[id.TBS] = that.filter.operators[name] === true;
	      } else if (upper === 'TRG') {
	        operatorFilter[id.TRG] = that.filter.operators[name] === true;
	      } else if (upper === 'BKR') {
	        operatorFilter[id.BKR] = that.filter.operators[name] === true;
	      } else if (upper === 'BKA') {
	        operatorFilter[id.BKA] = that.filter.operators[name] === true;
	      } else if (upper === 'BKN') {
	        operatorFilter[id.BKN] = that.filter.operators[name] === true;
	      } else if (upper === 'ABG') {
	        operatorFilter[id.ABG] = that.filter.operators[name] === true;
	      } else if (upper === 'AEN') {
	        operatorFilter[id.AEN] = that.filter.operators[name] === true;
	      } else {
	        throw new Error(
	          `${thisFileName}initOpratorFilter: '${name}' not a valid operator name.` +
	            ` Must be <all>, <none>, alt, cat, rep, tls, tbs, trg, and, not, bkr, bka or bkn`
	        );
	      }
	    }
	  };
	  /* filter the rule and `UDT` named operators */
	  const initRuleFilter = function () {
	    const setRules = function (set) {
	      operatorFilter[id.RNM] = set;
	      operatorFilter[id.UDT] = set;
	      const count = rules.length + udts.length;
	      ruleFilter.length = 0;
	      for (let i = 0; i < count; i += 1) {
	        ruleFilter.push(set);
	      }
	    };
	    let items;
	    let i;
	    const list = [];
	    for (i = 0; i < rules.length; i += 1) {
	      list.push(rules[i].lower);
	    }
	    for (i = 0; i < udts.length; i += 1) {
	      list.push(udts[i].lower);
	    }
	    ruleFilter.length = 0;
	    items = 0;
	    // eslint-disable-next-line no-unused-vars
	    for (const name in that.filter.rules) {
	      items += 1;
	    }
	    if (items === 0) {
	      /* case 1: default to all rules & udts */
	      setRules(true);
	      return;
	    }
	    for (const name in that.filter.rules) {
	      const lower = name.toLowerCase();
	      if (lower === '<all>') {
	        /* case 2: trace all rules ignore all other rule commands */
	        setRules(true);
	        return;
	      }
	      if (lower === '<none>') {
	        /* case 3: trace no rules */
	        setRules(false);
	        return;
	      }
	    }
	    /* case 4: trace only individually specified rules */
	    setRules(false);
	    operatorFilter[id.RNM] = true;
	    operatorFilter[id.UDT] = true;
	    for (const name in that.filter.rules) {
	      const lower = name.toLowerCase();
	      i = list.indexOf(lower);
	      if (i < 0) {
	        throw new Error(`${thisFileName}initRuleFilter: '${name}' not a valid rule or udt name`);
	      }
	      ruleFilter[i] = that.filter.rules[name] === true;
	    }
	  };
	  /* used by other APG components to verify that they have a valid trace object */
	  this.traceObject = 'traceObject';
	  this.filter = {
	    operators: [],
	    rules: [],
	  };
	  // Set the maximum number of records to keep (default = 5000).
	  // Each record number larger than `maxRecords`
	  // will result in deleting the previously oldest record.
	  // - `max`: maximum number of records to retain (default = 5000)
	  // - `last`: last record number to retain, (default = -1 for (unknown) actual last record)
	  this.setMaxRecords = function (max, last) {
	    lastRecord = -1;
	    if (typeof max === 'number' && max > 0) {
	      maxRecords = Math.ceil(max);
	    } else {
	      maxRecords = 0;
	      return;
	    }
	    if (typeof last === 'number') {
	      lastRecord = Math.floor(last);
	      if (lastRecord < 0) {
	        lastRecord = -1;
	      }
	    }
	  };
	  // Returns `maxRecords` to the caller.
	  this.getMaxRecords = function () {
	    return maxRecords;
	  };
	  // Returns `lastRecord` to the caller.
	  this.getLastRecord = function () {
	    return lastRecord;
	  };
	  /* Called only by the `parser.js` object. No verification of input. */
	  this.init = function (rulesIn, udtsIn, charsIn) {
	    records.length = 0;
	    recordStack.length = 0;
	    filteredRecords = 0;
	    treeDepth = 0;
	    chars = charsIn;
	    rules = rulesIn;
	    udts = udtsIn;
	    initOperatorFilter();
	    initRuleFilter();
	    circular.init(maxRecords);
	  };
	  /* returns true if this records passes through the designated filter, false if the record is to be skipped */
	  const filterOps = function (op) {
	    let ret = false;
	    if (op.type === id.RNM) {
	      if (operatorFilter[op.type] && ruleFilter[op.index]) {
	        ret = true;
	      } else {
	        ret = false;
	      }
	    } else if (op.type === id.UDT) {
	      if (operatorFilter[op.type] && ruleFilter[rules.length + op.index]) {
	        ret = true;
	      } else {
	        ret = false;
	      }
	    } else {
	      ret = operatorFilter[op.type];
	    }
	    return ret;
	  };
	  const filterRecords = function (record) {
	    if (lastRecord === -1) {
	      return true;
	    }
	    if (record <= lastRecord) {
	      return true;
	    }
	    return false;
	  };
	  /* Collect the "down" record. */
	  this.down = function (op, state, offset, length, anchor, lookAround) {
	    if (filterRecords(filteredRecords) && filterOps(op)) {
	      recordStack.push(filteredRecords);
	      records[circular.increment()] = {
	        dirUp: false,
	        depth: treeDepth,
	        thisLine: filteredRecords,
	        thatLine: undefined,
	        opcode: op,
	        state,
	        phraseIndex: offset,
	        phraseLength: length,
	        lookAnchor: anchor,
	        lookAround,
	      };
	      filteredRecords += 1;
	      treeDepth += 1;
	    }
	  };
	  /* Collect the "up" record. */
	  this.up = function (op, state, offset, length, anchor, lookAround) {
	    if (filterRecords(filteredRecords) && filterOps(op)) {
	      const thisLine = filteredRecords;
	      const thatLine = recordStack.pop();
	      const thatRecord = circular.getListIndex(thatLine);
	      if (thatRecord !== -1) {
	        records[thatRecord].thatLine = thisLine;
	      }
	      treeDepth -= 1;
	      records[circular.increment()] = {
	        dirUp: true,
	        depth: treeDepth,
	        thisLine,
	        thatLine,
	        opcode: op,
	        state,
	        phraseIndex: offset,
	        phraseLength: length,
	        lookAnchor: anchor,
	        lookAround,
	      };
	      filteredRecords += 1;
	    }
	  };
	  /* convert the trace records to a tree of nodes */
	  const toTreeObj = function () {
	    /* private helper functions */
	    function nodeOpcode(node, opcode) {
	      let name;
	      let casetype;
	      let modetype;
	      if (opcode) {
	        node.op = { id: opcode.type, name: utils.opcodeToString(opcode.type) };
	        node.opData = undefined;
	        switch (opcode.type) {
	          case id.RNM:
	            node.opData = rules[opcode.index].name;
	            break;
	          case id.UDT:
	            node.opData = udts[opcode.index].name;
	            break;
	          case id.BKR:
	            if (opcode.index < rules.length) {
	              name = rules[opcode.index].name;
	            } else {
	              name = udts[opcode.index - rules.length].name;
	            }
	            casetype = opcode.bkrCase === id.BKR_MODE_CI ? '%i' : '%s';
	            modetype = opcode.bkrMode === id.BKR_MODE_UM ? '%u' : '%p';
	            node.opData = `\\\\${casetype}${modetype}${name}`;
	            break;
	          case id.TLS:
	            node.opData = [];
	            for (let i = 0; i < opcode.string.length; i += 1) {
	              node.opData.push(opcode.string[i]);
	            }
	            break;
	          case id.TBS:
	            node.opData = [];
	            for (let i = 0; i < opcode.string.length; i += 1) {
	              node.opData.push(opcode.string[i]);
	            }
	            break;
	          case id.TRG:
	            node.opData = [opcode.min, opcode.max];
	            break;
	          case id.REP:
	            node.opData = [opcode.min, opcode.max];
	            break;
	          default:
	            throw new Error('unrecognized opcode');
	        }
	      } else {
	        node.op = { id: undefined, name: undefined };
	        node.opData = undefined;
	      }
	    }
	    function nodePhrase(state, index, length) {
	      if (state === id.MATCH) {
	        return {
	          index,
	          length,
	        };
	      }
	      if (state === id.NOMATCH) {
	        return {
	          index,
	          length: 0,
	        };
	      }
	      if (state === id.EMPTY) {
	        return {
	          index,
	          length: 0,
	        };
	      }
	      return null;
	    }
	    let nodeId = -1;
	    function nodeDown(parent, record, depth) {
	      const node = {
	        // eslint-disable-next-line no-plusplus
	        id: nodeId++,
	        branch: -1,
	        parent,
	        up: false,
	        down: false,
	        depth,
	        children: [],
	      };
	      if (record) {
	        node.down = true;
	        node.state = { id: record.state, name: utils.stateToString(record.state) };
	        node.phrase = null;
	        nodeOpcode(node, record.opcode);
	      } else {
	        node.state = { id: undefined, name: undefined };
	        node.phrase = nodePhrase();
	        nodeOpcode(node, undefined);
	      }
	      return node;
	    }
	    function nodeUp(node, record) {
	      if (record) {
	        node.up = true;
	        node.state = { id: record.state, name: utils.stateToString(record.state) };
	        node.phrase = nodePhrase(record.state, record.phraseIndex, record.phraseLength);
	        if (!node.down) {
	          nodeOpcode(node, record.opcode);
	        }
	      }
	    }
	    /* walk the final tree: label branches and count leaf nodes */
	    let leafNodes = 0;
	    let depth = -1;
	    let branchCount = 1;
	    function walk(node) {
	      depth += 1;
	      node.branch = branchCount;
	      if (depth > treeDepth) {
	        treeDepth = depth;
	      }
	      if (node.children.length === 0) {
	        leafNodes += 1;
	      } else {
	        for (let i = 0; i < node.children.length; i += 1) {
	          if (i > 0) {
	            branchCount += 1;
	          }
	          node.children[i].leftMost = false;
	          node.children[i].rightMost = false;
	          if (node.leftMost) {
	            node.children[i].leftMost = i === 0;
	          }
	          if (node.rightMost) {
	            node.children[i].rightMost = i === node.children.length - 1;
	          }
	          walk(node.children[i]);
	        }
	      }
	      depth -= 1;
	    }
	    function display(node, offset) {
	      let name;
	      const obj = {};
	      obj.id = node.id;
	      obj.branch = node.branch;
	      obj.leftMost = node.leftMost;
	      obj.rightMost = node.rightMost;
	      name = node.state.name ? node.state.name : 'ACTIVE';
	      obj.state = { id: node.state.id, name };
	      name = node.op.name ? node.op.name : '?';
	      obj.op = { id: node.op.id, name };
	      if (typeof node.opData === 'string') {
	        obj.opData = node.opData;
	      } else if (Array.isArray(node.opData)) {
	        obj.opData = [];
	        for (let i = 0; i < node.opData.length; i += 1) {
	          obj.opData[i] = node.opData[i];
	        }
	      } else {
	        obj.opData = undefined;
	      }
	      if (node.phrase) {
	        obj.phrase = { index: node.phrase.index, length: node.phrase.length };
	      } else {
	        obj.phrase = null;
	      }
	      obj.depth = node.depth;
	      obj.children = [];
	      for (let i = 0; i < node.children.length; i += 1) {
	        i !== node.children.length - 1;
	        obj.children[i] = display(node.children[i]);
	      }
	      return obj;
	    }

	    /* construct the tree beginning here */
	    const branch = [];
	    let root;
	    let node;
	    let parent;
	    let record;
	    let firstRecord = true;
	    /* push a dummy node so the root node will have a non-null parent */
	    const dummy = nodeDown(null, null, -1);
	    branch.push(dummy);
	    node = dummy;
	    circular.forEach((lineIndex) => {
	      record = records[lineIndex];
	      if (firstRecord) {
	        firstRecord = false;
	        if (record.depth > 0) {
	          /* push some dummy nodes to fill in for missing records */
	          const num = record.dirUp ? record.depth + 1 : record.depth;
	          for (let i = 0; i < num; i += 1) {
	            parent = node;
	            node = nodeDown(node, null, i);
	            branch.push(node);
	            parent.children.push(node);
	          }
	        }
	      }
	      if (record.dirUp) {
	        /* handle the next record up */
	        node = branch.pop();
	        nodeUp(node, record);
	        node = branch[branch.length - 1];
	      } else {
	        /* handle the next record down */
	        parent = node;
	        node = nodeDown(node, record, record.depth);
	        branch.push(node);
	        parent.children.push(node);
	      }
	    });

	    /* if not at root, walk it up to root */
	    while (branch.length > 1) {
	      node = branch.pop();
	      nodeUp(node, null);
	    }
	    /* maybe redundant or paranoid tests: these should never happen */
	    if (dummy.children.length === 0) {
	      throw new Error('trace.toTree(): parse tree has no nodes');
	    }
	    if (branch.length === 0) {
	      throw new Error('trace.toTree(): integrity check: dummy root node disappeared?');
	    }

	    /* if no record for start rule: find the pseudo root node (first dummy node above a real node) */
	    root = dummy.children[0];
	    let prev = root;
	    while (root && !root.down && !root.up) {
	      prev = root;
	      root = root.children[0];
	    }
	    root = prev;

	    /* walk the tree of nodes: label brances and count leaves */
	    root.leftMost = true;
	    root.rightMost = true;
	    walk(root);
	    root.branch = 0;

	    /* generate the exported object */
	    const obj = {};
	    obj.string = [];
	    for (let i = 0; i < chars.length; i += 1) {
	      obj.string[i] = chars[i];
	    }
	    /* generate the exported rule names */
	    obj.rules = [];
	    for (let i = 0; i < rules.length; i += 1) {
	      obj.rules[i] = rules[i].name;
	    }
	    /* generate the exported UDT names */
	    obj.udts = [];
	    for (let i = 0; i < udts.length; i += 1) {
	      obj.udts[i] = udts[i].name;
	    }
	    /* generate the ids */
	    obj.id = {};
	    obj.id.ALT = { id: id.ALT, name: 'ALT' };
	    obj.id.CAT = { id: id.CAT, name: 'CAT' };
	    obj.id.REP = { id: id.REP, name: 'REP' };
	    obj.id.RNM = { id: id.RNM, name: 'RNM' };
	    obj.id.TLS = { id: id.TLS, name: 'TLS' };
	    obj.id.TBS = { id: id.TBS, name: 'TBS' };
	    obj.id.TRG = { id: id.TRG, name: 'TRG' };
	    obj.id.UDT = { id: id.UDT, name: 'UDT' };
	    obj.id.AND = { id: id.AND, name: 'AND' };
	    obj.id.NOT = { id: id.NOT, name: 'NOT' };
	    obj.id.BKR = { id: id.BKR, name: 'BKR' };
	    obj.id.BKA = { id: id.BKA, name: 'BKA' };
	    obj.id.BKN = { id: id.BKN, name: 'BKN' };
	    obj.id.ABG = { id: id.ABG, name: 'ABG' };
	    obj.id.AEN = { id: id.AEN, name: 'AEN' };
	    obj.id.ACTIVE = { id: id.ACTIVE, name: 'ACTIVE' };
	    obj.id.MATCH = { id: id.MATCH, name: 'MATCH' };
	    obj.id.EMPTY = { id: id.EMPTY, name: 'EMPTY' };
	    obj.id.NOMATCH = { id: id.NOMATCH, name: 'NOMATCH' };
	    /* generate the max tree depth */
	    obj.treeDepth = treeDepth;
	    /* generate the number of leaf nodes (branches) */
	    obj.leafNodes = leafNodes;
	    /* generate the types of the left- and right-most branches */
	    let branchesIncomplete;
	    if (root.down) {
	      if (root.up) {
	        branchesIncomplete = 'none';
	      } else {
	        branchesIncomplete = 'right';
	      }
	    } else if (root.up) {
	      branchesIncomplete = 'left';
	    } else {
	      branchesIncomplete = 'both';
	    }
	    obj.branchesIncomplete = branchesIncomplete;
	    obj.tree = display(root, root.depth);
	    return obj;
	  };
	  // Returns the trace records as JSON parse tree object.
	  // - stringify: if `true`, the object is 'stringified' before returning, otherwise, the object itself is returned.
	  this.toTree = function (stringify) {
	    const obj = toTreeObj();
	    if (stringify) {
	      return JSON.stringify(obj);
	    }
	    return obj;
	  };
	  // Translate the trace records to HTML format and create a complete HTML page for browser display.
	  this.toHtmlPage = function (mode, caption, title) {
	    return utils.htmlToPage(this.toHtml(mode, caption), title);
	  };

	  /* From here on down, these are just helper functions for `toHtml()`. */
	  const htmlHeader = function (mode, caption) {
	    /* open the page */
	    /* write the HTML5 header with table style */
	    /* open the <table> tag */
	    let modeName;
	    switch (mode) {
	      case MODE_HEX:
	        modeName = 'hexadecimal';
	        break;
	      case MODE_DEC:
	        modeName = 'decimal';
	        break;
	      case MODE_ASCII:
	        modeName = 'ASCII';
	        break;
	      case MODE_UNICODE:
	        modeName = 'UNICODE';
	        break;
	      default:
	        throw new Error(`${thisFileName}htmlHeader: unrecognized mode: ${mode}`);
	    }
	    let header = '';
	    header += `<p>display mode: ${modeName}</p>\n`;
	    header += `<table class="${style.CLASS_TRACE}">\n`;
	    if (typeof caption === 'string') {
	      header += `<caption>${caption}</caption>`;
	    }
	    return header;
	  };
	  const htmlFooter = function () {
	    let footer = '';
	    /* close the </table> tag */
	    footer += '</table>\n';
	    /* display a table legend */
	    footer += `<p class="${style.CLASS_MONOSPACE}">legend:<br>\n`;
	    footer += '(a)&nbsp;-&nbsp;line number<br>\n';
	    footer += '(b)&nbsp;-&nbsp;matching line number<br>\n';
	    footer += '(c)&nbsp;-&nbsp;phrase offset<br>\n';
	    footer += '(d)&nbsp;-&nbsp;phrase length<br>\n';
	    footer += '(e)&nbsp;-&nbsp;tree depth<br>\n';
	    footer += '(f)&nbsp;-&nbsp;operator state<br>\n';
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_ACTIVE}">&darr;</span>&nbsp;&nbsp;phrase opened<br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_MATCH}">&uarr;M</span> phrase matched<br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_EMPTY}">&uarr;E</span> empty phrase matched<br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_NOMATCH}">&uarr;N</span> phrase not matched<br>\n`;
	    footer +=
	      'operator&nbsp;-&nbsp;ALT, CAT, REP, RNM, TRG, TLS, TBS<sup>&dagger;</sup>, UDT, AND, NOT, BKA, BKN, BKR, ABG, AEN<sup>&Dagger;</sup><br>\n';
	    footer += `phrase&nbsp;&nbsp;&nbsp;-&nbsp;up to ${MAX_PHRASE} characters of the phrase being matched<br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_MATCH}">matched characters</span><br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_LOOKAHEAD}">matched characters in look ahead mode</span><br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_LOOKBEHIND}">matched characters in look behind mode</span><br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_REMAINDER}">remainder characters(not yet examined by parser)</span><br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;<span class="${style.CLASS_CTRLCHAR}">control characters, TAB, LF, CR, etc. (ASCII mode only)</span><br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;${PHRASE_EMPTY} empty string<br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;${PHRASE_END} end of input string<br>\n`;
	    footer += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;${PHRASE_CONTINUE} input string display truncated<br>\n`;
	    footer += '</p>\n';
	    footer += `<p class="${style.CLASS_MONOSPACE}">\n`;
	    footer += '<sup>&dagger;</sup>original ABNF operators:<br>\n';
	    footer += 'ALT - alternation<br>\n';
	    footer += 'CAT - concatenation<br>\n';
	    footer += 'REP - repetition<br>\n';
	    footer += 'RNM - rule name<br>\n';
	    footer += 'TRG - terminal range<br>\n';
	    footer += 'TLS - terminal literal string (case insensitive)<br>\n';
	    footer += 'TBS - terminal binary string (case sensitive)<br>\n';
	    footer += '<br>\n';
	    footer += '<sup>&Dagger;</sup>super set SABNF operators:<br>\n';
	    footer += 'UDT - user-defined terminal<br>\n';
	    footer += 'AND - positive look ahead<br>\n';
	    footer += 'NOT - negative look ahead<br>\n';
	    footer += 'BKA - positive look behind<br>\n';
	    footer += 'BKN - negative look behind<br>\n';
	    footer += 'BKR - back reference<br>\n';
	    footer += 'ABG - anchor - begin of input string<br>\n';
	    footer += 'AEN - anchor - end of input string<br>\n';
	    footer += '</p>\n';
	    return footer;
	  };
	  this.indent = function (depth) {
	    let html = '';
	    for (let i = 0; i < depth; i += 1) {
	      html += '.';
	    }
	    return html;
	  };
	  /* format the TRG operator */
	  const displayTrg = function (mode, op) {
	    let html = '';
	    if (op.type === id.TRG) {
	      if (mode === MODE_HEX || mode === MODE_UNICODE) {
	        let hex = op.min.toString(16).toUpperCase();
	        if (hex.length % 2 !== 0) {
	          hex = `0${hex}`;
	        }
	        html += mode === MODE_HEX ? '%x' : 'U+';
	        html += hex;
	        hex = op.max.toString(16).toUpperCase();
	        if (hex.length % 2 !== 0) {
	          hex = `0${hex}`;
	        }
	        html += `&ndash;${hex}`;
	      } else {
	        html = `%d${op.min.toString(10)}&ndash;${op.max.toString(10)}`;
	      }
	    }
	    return html;
	  };
	  /* format the REP operator */
	  const displayRep = function (mode, op) {
	    let html = '';
	    if (op.type === id.REP) {
	      if (mode === MODE_HEX) {
	        let hex = op.min.toString(16).toUpperCase();
	        if (hex.length % 2 !== 0) {
	          hex = `0${hex}`;
	        }
	        html = `x${hex}`;
	        if (op.max < Infinity) {
	          hex = op.max.toString(16).toUpperCase();
	          if (hex.length % 2 !== 0) {
	            hex = `0${hex}`;
	          }
	        } else {
	          hex = 'inf';
	        }
	        html += `&ndash;${hex}`;
	      } else if (op.max < Infinity) {
	        html = `${op.min.toString(10)}&ndash;${op.max.toString(10)}`;
	      } else {
	        html = `${op.min.toString(10)}&ndash;inf`;
	      }
	    }
	    return html;
	  };
	  /* format the TBS operator */
	  const displayTbs = function (mode, op) {
	    let html = '';
	    if (op.type === id.TBS) {
	      const len = Math.min(op.string.length, MAX_TLS * 2);
	      if (mode === MODE_HEX || mode === MODE_UNICODE) {
	        html += mode === MODE_HEX ? '%x' : 'U+';
	        for (let i = 0; i < len; i += 1) {
	          let hex;
	          if (i > 0) {
	            html += '.';
	          }
	          hex = op.string[i].toString(16).toUpperCase();
	          if (hex.length % 2 !== 0) {
	            hex = `0${hex}`;
	          }
	          html += hex;
	        }
	      } else {
	        html = '%d';
	        for (let i = 0; i < len; i += 1) {
	          if (i > 0) {
	            html += '.';
	          }
	          html += op.string[i].toString(10);
	        }
	      }
	      if (len < op.string.length) {
	        html += PHRASE_CONTINUE;
	      }
	    }
	    return html;
	  };
	  /* format the TLS operator */
	  const displayTls = function (mode, op) {
	    let html = '';
	    if (op.type === id.TLS) {
	      const len = Math.min(op.string.length, MAX_TLS);
	      if (mode === MODE_HEX || mode === MODE_DEC) {
	        let charu;
	        let charl;
	        let base;
	        if (mode === MODE_HEX) {
	          html = '%x';
	          base = 16;
	        } else {
	          html = '%d';
	          base = 10;
	        }
	        for (let i = 0; i < len; i += 1) {
	          if (i > 0) {
	            html += '.';
	          }
	          charl = op.string[i];
	          if (charl >= 97 && charl <= 122) {
	            charu = charl - 32;
	            html += `${charu.toString(base)}/${charl.toString(base)}`.toUpperCase();
	          } else if (charl >= 65 && charl <= 90) {
	            charu = charl;
	            charl += 32;
	            html += `${charu.toString(base)}/${charl.toString(base)}`.toUpperCase();
	          } else {
	            html += charl.toString(base).toUpperCase();
	          }
	        }
	        if (len < op.string.length) {
	          html += PHRASE_CONTINUE;
	        }
	      } else {
	        html = '"';
	        for (let i = 0; i < len; i += 1) {
	          html += utils.asciiChars[op.string[i]];
	        }
	        if (len < op.string.length) {
	          html += PHRASE_CONTINUE;
	        }
	        html += '"';
	      }
	    }
	    return html;
	  };
	  const subPhrase = function (mode, charsArg, index, length, prev) {
	    if (length === 0) {
	      return '';
	    }
	    let phrase = '';
	    const comma = prev ? ',' : '';
	    switch (mode) {
	      case MODE_HEX:
	        phrase = comma + utils.charsToHex(charsArg, index, length);
	        break;
	      case MODE_DEC:
	        if (prev) {
	          return `,${utils.charsToDec(charsArg, index, length)}`;
	        }
	        phrase = comma + utils.charsToDec(charsArg, index, length);
	        break;
	      case MODE_UNICODE:
	        phrase = utils.charsToUnicode(charsArg, index, length);
	        break;
	      case MODE_ASCII:
	      default:
	        phrase = utils.charsToAsciiHtml(charsArg, index, length);
	        break;
	    }
	    return phrase;
	  };
	  /* display phrases matched in look-behind mode */
	  const displayBehind = function (mode, charsArg, state, index, length, anchor) {
	    let html = '';
	    let beg1;
	    let len1;
	    let beg2;
	    let len2;
	    let lastchar = PHRASE_END;
	    const spanBehind = `<span class="${style.CLASS_LOOKBEHIND}">`;
	    const spanRemainder = `<span class="${style.CLASS_REMAINDER}">`;
	    const spanend = '</span>';
	    let prev = false;
	    switch (state) {
	      case id.EMPTY:
	        html += PHRASE_EMPTY;
	      /* // eslint-disable-next-line no-fallthrough */
	      case id.NOMATCH:
	      case id.MATCH:
	      case id.ACTIVE:
	        beg1 = index - length;
	        len1 = anchor - beg1;
	        beg2 = anchor;
	        len2 = charsArg.length - beg2;
	        break;
	      default:
	        throw new Error('unrecognized state');
	    }
	    lastchar = PHRASE_END;
	    if (len1 > MAX_PHRASE) {
	      len1 = MAX_PHRASE;
	      lastchar = PHRASE_CONTINUE;
	      len2 = 0;
	    } else if (len1 + len2 > MAX_PHRASE) {
	      lastchar = PHRASE_CONTINUE;
	      len2 = MAX_PHRASE - len1;
	    }
	    if (len1 > 0) {
	      html += spanBehind;
	      html += subPhrase(mode, charsArg, beg1, len1, prev);
	      html += spanend;
	      prev = true;
	    }
	    if (len2 > 0) {
	      html += spanRemainder;
	      html += subPhrase(mode, charsArg, beg2, len2, prev);
	      html += spanend;
	    }
	    return html + lastchar;
	  };
	  const displayForward = function (mode, charsArg, state, index, length, spanAhead) {
	    let html = '';
	    let beg1;
	    let len1;
	    let beg2;
	    let len2;
	    let lastchar = PHRASE_END;
	    const spanRemainder = `<span class="${style.CLASS_REMAINDER}">`;
	    const spanend = '</span>';
	    let prev = false;
	    switch (state) {
	      case id.EMPTY:
	        html += PHRASE_EMPTY;
	      /* // eslint-disable-next-line no-fallthrough */
	      case id.NOMATCH:
	      case id.ACTIVE:
	        beg1 = index;
	        len1 = 0;
	        beg2 = index;
	        len2 = charsArg.length - beg2;
	        break;
	      case id.MATCH:
	        beg1 = index;
	        len1 = length;
	        beg2 = index + len1;
	        len2 = charsArg.length - beg2;
	        break;
	      default:
	        throw new Error('unrecognized state');
	    }
	    lastchar = PHRASE_END;
	    if (len1 > MAX_PHRASE) {
	      len1 = MAX_PHRASE;
	      lastchar = PHRASE_CONTINUE;
	      len2 = 0;
	    } else if (len1 + len2 > MAX_PHRASE) {
	      lastchar = PHRASE_CONTINUE;
	      len2 = MAX_PHRASE - len1;
	    }
	    if (len1 > 0) {
	      html += spanAhead;
	      html += subPhrase(mode, charsArg, beg1, len1, prev);
	      html += spanend;
	      prev = true;
	    }
	    if (len2 > 0) {
	      html += spanRemainder;
	      html += subPhrase(mode, charsArg, beg2, len2, prev);
	      html += spanend;
	    }
	    return html + lastchar;
	  };
	  /* display phrases matched in look-ahead mode */
	  const displayAhead = function (mode, charsArg, state, index, length) {
	    const spanAhead = `<span class="${style.CLASS_LOOKAHEAD}">`;
	    return displayForward(mode, charsArg, state, index, length, spanAhead);
	  };
	  /* display phrases matched in normal parsing mode */
	  const displayNone = function (mode, charsArg, state, index, length) {
	    const spanAhead = `<span class="${style.CLASS_MATCH}">`;
	    return displayForward(mode, charsArg, state, index, length, spanAhead);
	  };
	  /* Returns the filtered records, formatted as an HTML table. */
	  const htmlTable = function (mode) {
	    if (rules === null) {
	      return '';
	    }
	    let html = '';
	    let thisLine;
	    let thatLine;
	    let lookAhead;
	    let lookBehind;
	    let lookAround;
	    let anchor;
	    html += '<tr><th>(a)</th><th>(b)</th><th>(c)</th><th>(d)</th><th>(e)</th><th>(f)</th>';
	    html += '<th>operator</th><th>phrase</th></tr>\n';
	    circular.forEach((lineIndex) => {
	      const line = records[lineIndex];
	      thisLine = line.thisLine;
	      thatLine = line.thatLine !== undefined ? line.thatLine : '--';
	      lookAhead = false;
	      lookBehind = false;
	      lookAround = false;
	      if (line.lookAround === id.LOOKAROUND_AHEAD) {
	        lookAhead = true;
	        lookAround = true;
	        anchor = line.lookAnchor;
	      }
	      if (line.opcode.type === id.AND || line.opcode.type === id.NOT) {
	        lookAhead = true;
	        lookAround = true;
	        anchor = line.phraseIndex;
	      }
	      if (line.lookAround === id.LOOKAROUND_BEHIND) {
	        lookBehind = true;
	        lookAround = true;
	        anchor = line.lookAnchor;
	      }
	      if (line.opcode.type === id.BKA || line.opcode.type === id.BKN) {
	        lookBehind = true;
	        lookAround = true;
	        anchor = line.phraseIndex;
	      }
	      html += '<tr>';
	      html += `<td>${thisLine}</td><td>${thatLine}</td>`;
	      html += `<td>${line.phraseIndex}</td>`;
	      html += `<td>${line.phraseLength}</td>`;
	      html += `<td>${line.depth}</td>`;
	      html += '<td>';
	      switch (line.state) {
	        case id.ACTIVE:
	          html += `<span class="${style.CLASS_ACTIVE}">&darr;&nbsp;</span>`;
	          break;
	        case id.MATCH:
	          html += `<span class="${style.CLASS_MATCH}">&uarr;M</span>`;
	          break;
	        case id.NOMATCH:
	          html += `<span class="${style.CLASS_NOMATCH}">&uarr;N</span>`;
	          break;
	        case id.EMPTY:
	          html += `<span class="${style.CLASS_EMPTY}">&uarr;E</span>`;
	          break;
	        default:
	          html += `<span class="${style.CLASS_ACTIVE}">--</span>`;
	          break;
	      }
	      html += '</td>';
	      html += '<td>';
	      html += that.indent(line.depth);
	      if (lookAhead) {
	        html += `<span class="${style.CLASS_LOOKAHEAD}">`;
	      } else if (lookBehind) {
	        html += `<span class="${style.CLASS_LOOKBEHIND}">`;
	      }
	      html += utils.opcodeToString(line.opcode.type);
	      if (line.opcode.type === id.RNM) {
	        html += `(${rules[line.opcode.index].name}) `;
	      }
	      if (line.opcode.type === id.BKR) {
	        const casetype = line.opcode.bkrCase === id.BKR_MODE_CI ? '%i' : '%s';
	        const modetype = line.opcode.bkrMode === id.BKR_MODE_UM ? '%u' : '%p';
	        html += `(\\${casetype}${modetype}${rules[line.opcode.index].name}) `;
	      }
	      if (line.opcode.type === id.UDT) {
	        html += `(${udts[line.opcode.index].name}) `;
	      }
	      if (line.opcode.type === id.TRG) {
	        html += `(${displayTrg(mode, line.opcode)}) `;
	      }
	      if (line.opcode.type === id.TBS) {
	        html += `(${displayTbs(mode, line.opcode)}) `;
	      }
	      if (line.opcode.type === id.TLS) {
	        html += `(${displayTls(mode, line.opcode)}) `;
	      }
	      if (line.opcode.type === id.REP) {
	        html += `(${displayRep(mode, line.opcode)}) `;
	      }
	      if (lookAround) {
	        html += '</span>';
	      }
	      html += '</td>';
	      html += '<td>';
	      if (lookBehind) {
	        html += displayBehind(mode, chars, line.state, line.phraseIndex, line.phraseLength, anchor);
	      } else if (lookAhead) {
	        html += displayAhead(mode, chars, line.state, line.phraseIndex, line.phraseLength);
	      } else {
	        html += displayNone(mode, chars, line.state, line.phraseIndex, line.phraseLength);
	      }
	      html += '</td></tr>\n';
	    });
	    html += '<tr><th>(a)</th><th>(b)</th><th>(c)</th><th>(d)</th><th>(e)</th><th>(f)</th>';
	    html += '<th>operator</th><th>phrase</th></tr>\n';
	    html += '</table>\n';
	    return html;
	  };
	  // Translate the trace records to HTML format.
	  // - *modearg* - can be `"ascii"`, `"decimal"`, `"hexadecimal"` or `"unicode"`.
	  // Determines the format of the string character code display.
	  // - *caption* - optional caption for the HTML table.
	  this.toHtml = function (modearg, caption) {
	    /* writes the trace records as a table in a complete html page */
	    let mode = MODE_ASCII;
	    if (typeof modearg === 'string' && modearg.length >= 3) {
	      const modein = modearg.toLowerCase().slice(0, 3);
	      if (modein === 'hex') {
	        mode = MODE_HEX;
	      } else if (modein === 'dec') {
	        mode = MODE_DEC;
	      } else if (modein === 'uni') {
	        mode = MODE_UNICODE;
	      }
	    }
	    let html = '';
	    html += htmlHeader(mode, caption);
	    html += htmlTable(mode);
	    html += htmlFooter();
	    return html;
	  };
	};
	return trace;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var nodeExports$1;
var hasRequiredNodeExports$1;

function requireNodeExports$1 () {
	if (hasRequiredNodeExports$1) return nodeExports$1;
	hasRequiredNodeExports$1 = 1;
	// This module serves to export all library objects and object constructors with the `require("apg-lib")` statement.
	// For example, to create a new parser in your program,
	// ````
	// let apglib = require("../apg-lib/node-exports");
	// let my-parser = new apglib.parser();
	// ````
	nodeExports$1 = {
	  ast: requireAst(),
	  circular: requireCircularBuffer(),
	  ids: requireIdentifiers(),
	  parser: requireParser$1(),
	  stats: requireStats(),
	  trace: requireTrace(),
	  utils: requireUtilities(),
	  emitcss: requireEmitcss(),
	  style: requireStyle(),
	};
	return nodeExports$1;
}

var scannerGrammar;
var hasRequiredScannerGrammar;

function requireScannerGrammar () {
	if (hasRequiredScannerGrammar) return scannerGrammar;
	hasRequiredScannerGrammar = 1;
	// copyright: Copyright (c) 2024 Lowell D. Thomas, all rights reserved<br>
	//   license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)<br>
	//
	// Generated by apg-js, Version 4.4.0 [apg-js](https://github.com/ldthomas/apg-js)
	scannerGrammar = function grammar(){
	  // ```
	  // SUMMARY
	  //      rules = 10
	  //       udts = 0
	  //    opcodes = 31
	  //        ---   ABNF original opcodes
	  //        ALT = 5
	  //        CAT = 2
	  //        REP = 4
	  //        RNM = 11
	  //        TLS = 0
	  //        TBS = 4
	  //        TRG = 5
	  //        ---   SABNF superset opcodes
	  //        UDT = 0
	  //        AND = 0
	  //        NOT = 0
	  //        BKA = 0
	  //        BKN = 0
	  //        BKR = 0
	  //        ABG = 0
	  //        AEN = 0
	  // characters = [0 - 4294967295]
	  // ```
	  /* OBJECT IDENTIFIER (for internal parser use) */
	  this.grammarObject = 'grammarObject';

	  /* RULES */
	  this.rules = [];
	  this.rules[0] = { name: 'file', lower: 'file', index: 0, isBkr: false };
	  this.rules[1] = { name: 'line', lower: 'line', index: 1, isBkr: false };
	  this.rules[2] = { name: 'line-text', lower: 'line-text', index: 2, isBkr: false };
	  this.rules[3] = { name: 'last-line', lower: 'last-line', index: 3, isBkr: false };
	  this.rules[4] = { name: 'valid', lower: 'valid', index: 4, isBkr: false };
	  this.rules[5] = { name: 'invalid', lower: 'invalid', index: 5, isBkr: false };
	  this.rules[6] = { name: 'end', lower: 'end', index: 6, isBkr: false };
	  this.rules[7] = { name: 'CRLF', lower: 'crlf', index: 7, isBkr: false };
	  this.rules[8] = { name: 'LF', lower: 'lf', index: 8, isBkr: false };
	  this.rules[9] = { name: 'CR', lower: 'cr', index: 9, isBkr: false };

	  /* UDTS */
	  this.udts = [];

	  /* OPCODES */
	  /* file */
	  this.rules[0].opcodes = [];
	  this.rules[0].opcodes[0] = { type: 2, children: [1,3] };// CAT
	  this.rules[0].opcodes[1] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[0].opcodes[2] = { type: 4, index: 1 };// RNM(line)
	  this.rules[0].opcodes[3] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[0].opcodes[4] = { type: 4, index: 3 };// RNM(last-line)

	  /* line */
	  this.rules[1].opcodes = [];
	  this.rules[1].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[1].opcodes[1] = { type: 4, index: 2 };// RNM(line-text)
	  this.rules[1].opcodes[2] = { type: 4, index: 6 };// RNM(end)

	  /* line-text */
	  this.rules[2].opcodes = [];
	  this.rules[2].opcodes[0] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[2].opcodes[1] = { type: 1, children: [2,3] };// ALT
	  this.rules[2].opcodes[2] = { type: 4, index: 4 };// RNM(valid)
	  this.rules[2].opcodes[3] = { type: 4, index: 5 };// RNM(invalid)

	  /* last-line */
	  this.rules[3].opcodes = [];
	  this.rules[3].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[3].opcodes[1] = { type: 1, children: [2,3] };// ALT
	  this.rules[3].opcodes[2] = { type: 4, index: 4 };// RNM(valid)
	  this.rules[3].opcodes[3] = { type: 4, index: 5 };// RNM(invalid)

	  /* valid */
	  this.rules[4].opcodes = [];
	  this.rules[4].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[4].opcodes[1] = { type: 5, min: 32, max: 126 };// TRG
	  this.rules[4].opcodes[2] = { type: 6, string: [9] };// TBS

	  /* invalid */
	  this.rules[5].opcodes = [];
	  this.rules[5].opcodes[0] = { type: 1, children: [1,2,3,4] };// ALT
	  this.rules[5].opcodes[1] = { type: 5, min: 0, max: 8 };// TRG
	  this.rules[5].opcodes[2] = { type: 5, min: 11, max: 12 };// TRG
	  this.rules[5].opcodes[3] = { type: 5, min: 14, max: 31 };// TRG
	  this.rules[5].opcodes[4] = { type: 5, min: 127, max: 4294967295 };// TRG

	  /* end */
	  this.rules[6].opcodes = [];
	  this.rules[6].opcodes[0] = { type: 1, children: [1,2,3] };// ALT
	  this.rules[6].opcodes[1] = { type: 4, index: 7 };// RNM(CRLF)
	  this.rules[6].opcodes[2] = { type: 4, index: 8 };// RNM(LF)
	  this.rules[6].opcodes[3] = { type: 4, index: 9 };// RNM(CR)

	  /* CRLF */
	  this.rules[7].opcodes = [];
	  this.rules[7].opcodes[0] = { type: 6, string: [13,10] };// TBS

	  /* LF */
	  this.rules[8].opcodes = [];
	  this.rules[8].opcodes[0] = { type: 6, string: [10] };// TBS

	  /* CR */
	  this.rules[9].opcodes = [];
	  this.rules[9].opcodes[0] = { type: 6, string: [13] };// TBS

	  // The `toString()` function will display the original grammar file(s) that produced these opcodes.
	  this.toString = function toString(){
	    let str = "";
	    str += "file = *line [last-line]\n";
	    str += "line = line-text end\n";
	    str += "line-text = *(valid/invalid)\n";
	    str += "last-line = 1*(valid/invalid)\n";
	    str += "valid = %d32-126 / %d9\n";
	    str += "invalid = %d0-8 / %d11-12 /%d14-31 / %x7f-ffffffff\n";
	    str += "end = CRLF / LF / CR\n";
	    str += "CRLF = %d13.10\n";
	    str += "LF = %d10\n";
	    str += "CR = %d13\n";
	    return str;
	  };
	};
	return scannerGrammar;
}

var scannerCallbacks = {};

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var hasRequiredScannerCallbacks;

function requireScannerCallbacks () {
	if (hasRequiredScannerCallbacks) return scannerCallbacks;
	hasRequiredScannerCallbacks = 1;
	// These are the AST translation callback functions used by the scanner
	// to analyze the characters and lines.
	const ids = requireIdentifiers();
	const utils = requireUtilities();

	function semLine(state, chars, phraseIndex, phraseCount, data) {
	  if (state === ids.SEM_PRE) {
	    data.endLength = 0;
	    data.textLength = 0;
	    data.invalidCount = 0;
	  } else {
	    data.lines.push({
	      lineNo: data.lines.length,
	      beginChar: phraseIndex,
	      length: phraseCount,
	      textLength: data.textLength,
	      endType: data.endType,
	      invalidChars: data.invalidCount,
	    });
	  }
	  return ids.SEM_OK;
	}
	function semLineText(state, chars, phraseIndex, phraseCount, data) {
	  if (state === ids.SEM_PRE) {
	    data.textLength = phraseCount;
	  }
	  return ids.SEM_OK;
	}
	function semLastLine(state, chars, phraseIndex, phraseCount, data) {
	  if (state === ids.SEM_PRE) {
	    data.endLength = 0;
	    data.textLength = 0;
	    data.invalidCount = 0;
	  } else if (data.strict) {
	    data.lines.push({
	      lineNo: data.lines.length,
	      beginChar: phraseIndex,
	      length: phraseCount,
	      textLength: phraseCount,
	      endType: 'none',
	      invalidChars: data.invalidCount,
	    });
	    data.errors.push({
	      line: data.lineNo,
	      char: phraseIndex + phraseCount,
	      msg: 'no line end on last line - strict ABNF specifies CRLF(\\r\\n, \\x0D\\x0A)',
	    });
	  } else {
	    /* add a line ender */
	    chars.push(10);
	    data.lines.push({
	      lineNo: data.lines.length,
	      beginChar: phraseIndex,
	      length: phraseCount + 1,
	      textLength: phraseCount,
	      endType: 'LF',
	      invalidChars: data.invalidCount,
	    });
	  }
	  return ids.SEM_OK;
	}
	function semInvalid(state, chars, phraseIndex, phraseCount, data) {
	  if (state === ids.SEM_PRE) {
	    data.errors.push({
	      line: data.lineNo,
	      char: phraseIndex,
	      msg: `invalid character found '\\x${utils.charToHex(chars[phraseIndex])}'`,
	    });
	  }
	  return ids.SEM_OK;
	}
	function semEnd(state, chars, phraseIndex, phraseCount, data) {
	  if (state === ids.SEM_POST) {
	    data.lineNo += 1;
	  }
	  return ids.SEM_OK;
	}
	function semLF(state, chars, phraseIndex, phraseCount, data) {
	  if (state === ids.SEM_PRE) {
	    data.endType = 'LF';
	    if (data.strict) {
	      data.errors.push({
	        line: data.lineNo,
	        char: phraseIndex,
	        msg: 'line end character LF(\\n, \\x0A) - strict ABNF specifies CRLF(\\r\\n, \\x0D\\x0A)',
	      });
	    }
	  }
	  return ids.SEM_OK;
	}
	function semCR(state, chars, phraseIndex, phraseCount, data) {
	  if (state === ids.SEM_PRE) {
	    data.endType = 'CR';
	    if (data.strict) {
	      data.errors.push({
	        line: data.lineNo,
	        char: phraseIndex,
	        msg: 'line end character CR(\\r, \\x0D) - strict ABNF specifies CRLF(\\r\\n, \\x0D\\x0A)',
	      });
	    }
	  }
	  return ids.SEM_OK;
	}
	function semCRLF(state, chars, phraseIndex, phraseCount, data) {
	  if (state === ids.SEM_PRE) {
	    data.endType = 'CRLF';
	  }
	  return ids.SEM_OK;
	}
	const callbacks = [];
	callbacks.line = semLine;
	callbacks['line-text'] = semLineText;
	callbacks['last-line'] = semLastLine;
	callbacks.invalid = semInvalid;
	callbacks.end = semEnd;
	callbacks.lf = semLF;
	callbacks.cr = semCR;
	callbacks.crlf = semCRLF;
	scannerCallbacks.callbacks = callbacks;
	return scannerCallbacks;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var scanner;
var hasRequiredScanner;

function requireScanner () {
	if (hasRequiredScanner) return scanner;
	hasRequiredScanner = 1;
	// This module reads the input grammar file and does a preliminary analysis
	// before attempting to parse it into a grammar object.
	// See:<br>
	// `./dist/scanner-grammar.bnf`<br>
	// for the grammar file this parser is based on.
	//
	// It has two primary functions.
	// - verify the character codes - no non-printing ASCII characters
	// - catalog the lines - create an array with a line object for each line.
	// The object carries information about the line number and character length which is used
	// by the parser generator primarily for error reporting.
	scanner = function exfn(chars, errors, strict, trace) {
	  const thisFileName = 'scanner.js: ';
	  const apglib = requireNodeExports$1();
	  const grammar = new (requireScannerGrammar())();
	  const { callbacks } = requireScannerCallbacks();

	  /* Scan the grammar for character code errors and catalog the lines. */
	  const lines = [];
	  // eslint-disable-next-line new-cap
	  const parser = new apglib.parser();
	  // eslint-disable-next-line new-cap
	  parser.ast = new apglib.ast();
	  parser.ast.callbacks = callbacks;
	  if (trace) {
	    if (trace.traceObject !== 'traceObject') {
	      throw new TypeError(`${thisFileName}trace argument is not a trace object`);
	    }
	    parser.trace = trace;
	  }

	  /* parse the input SABNF grammar */
	  const test = parser.parse(grammar, 'file', chars);
	  if (test.success !== true) {
	    errors.push({
	      line: 0,
	      char: 0,
	      msg: 'syntax analysis error analyzing input SABNF grammar',
	    });
	    return;
	  }
	  const data = {
	    lines,
	    lineNo: 0,
	    errors,
	    strict: !!strict,
	  };

	  /* translate (analyze) the input SABNF grammar */
	  parser.ast.translate(data);
	  // eslint-disable-next-line consistent-return
	  return lines;
	};
	return scanner;
}

/* eslint-disable func-names */

var syntaxCallbacks;
var hasRequiredSyntaxCallbacks;

function requireSyntaxCallbacks () {
	if (hasRequiredSyntaxCallbacks) return syntaxCallbacks;
	hasRequiredSyntaxCallbacks = 1;
	/*  *************************************************************************************
	 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
	 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
	 *   ********************************************************************************* */
	// This module has all of the callback functions for the syntax phase of the generation.
	// See:<br>
	// `./dist/abnf-for-sabnf-grammar.bnf`<br>
	// for the grammar file these callback functions are based on.
	syntaxCallbacks = function exfn() {
	  const thisFileName = 'syntax-callbacks.js: ';
	  const apglib = requireNodeExports$1();
	  const id = apglib.ids;
	  let topAlt;
	  /* syntax, RNM, callback functions */
	  const synFile = function synFile(result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        data.altStack = [];
	        data.repCount = 0;
	        break;
	      case id.EMPTY:
	        data.errors.push({
	          line: 0,
	          char: 0,
	          msg: 'grammar file is empty',
	        });
	        break;
	      case id.MATCH:
	        if (data.ruleCount === 0) {
	          data.errors.push({
	            line: 0,
	            char: 0,
	            msg: 'no rules defined',
	          });
	        }
	        break;
	      case id.NOMATCH:
	        throw new Error(`${thisFileName}synFile: grammar file NOMATCH: design error: should never happen.`);
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  // eslint-disable-next-line func-names
	  const synRule = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        data.altStack.length = 0;
	        topAlt = {
	          groupOpen: null,
	          groupError: false,
	          optionOpen: null,
	          optionError: false,
	          tlsOpen: null,
	          clsOpen: null,
	          prosValOpen: null,
	          basicError: false,
	        };
	        data.altStack.push(topAlt);
	        break;
	      case id.EMPTY:
	        throw new Error(`${thisFileName}synRule: EMPTY: rule cannot be empty`);
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        data.ruleCount += 1;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synRuleError = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, phraseIndex, data.charsLength),
	          char: phraseIndex,
	          msg: 'Unrecognized SABNF line. Invalid rule, comment or blank line.',
	        });
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synRuleNameError = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, phraseIndex, data.charsLength),
	          char: phraseIndex,
	          msg: 'Rule names must be alphanum and begin with alphabetic character.',
	        });
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synDefinedAsError = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, phraseIndex, data.charsLength),
	          char: phraseIndex,
	          msg: "Expected '=' or '=/'. Not found.",
	        });
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synAndOp = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'AND operator(&) found - strict ABNF specified.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synNotOp = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'NOT operator(!) found - strict ABNF specified.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synBkaOp = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'Positive look-behind operator(&&) found - strict ABNF specified.',
	          });
	        } else if (data.lite) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'Positive look-behind operator(&&) found - apg-lite specified.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synBknOp = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'Negative look-behind operator(!!) found - strict ABNF specified.',
	          });
	        } else if (data.lite) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'Negative look-behind operator(!!) found - apg-lite specified.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synAbgOp = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'Beginning of string anchor(%^) found - strict ABNF specified.',
	          });
	        } else if (data.lite) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'Beginning of string anchor(%^) found - apg-lite specified.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synAenOp = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'End of string anchor(%$) found - strict ABNF specified.',
	          });
	        } else if (data.lite) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'End of string anchor(%$) found - apg-lite specified.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synBkrOp = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          const name = apglib.utils.charsToString(chars, phraseIndex, result.phraseLength);
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: `Back reference operator(${name}) found - strict ABNF specified.`,
	          });
	        } else if (data.lite) {
	          const name = apglib.utils.charsToString(chars, phraseIndex, result.phraseLength);
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: `Back reference operator(${name}) found - apg-lite specified.`,
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synUdtOp = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          const name = apglib.utils.charsToString(chars, phraseIndex, result.phraseLength);
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: `UDT operator found(${name}) - strict ABNF specified.`,
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synTlsOpen = function (result, chars, phraseIndex) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        topAlt.tlsOpen = phraseIndex;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synTlsString = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        data.stringTabChar = false;
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.stringTabChar !== false) {
	          data.errors.push({
	            line: data.findLine(data.lines, data.stringTabChar),
	            char: data.stringTabChar,
	            msg: "Tab character (\\t, x09) not allowed in literal string (see 'quoted-string' definition, RFC 7405.)",
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synStringTab = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        data.stringTabChar = phraseIndex;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synTlsClose = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, topAlt.tlsOpen),
	          char: topAlt.tlsOpen,
	          msg: 'Case-insensitive literal string("...") opened but not closed.',
	        });
	        topAlt.basicError = true;
	        topAlt.tlsOpen = null;
	        break;
	      case id.MATCH:
	        topAlt.tlsOpen = null;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synClsOpen = function (result, chars, phraseIndex) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        topAlt.clsOpen = phraseIndex;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synClsString = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        data.stringTabChar = false;
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.stringTabChar !== false) {
	          data.errors.push({
	            line: data.findLine(data.lines, data.stringTabChar),
	            char: data.stringTabChar,
	            msg: 'Tab character (\\t, x09) not allowed in literal string.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synClsClose = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, topAlt.clsOpen),
	          char: topAlt.clsOpen,
	          msg: "Case-sensitive literal string('...') opened but not closed.",
	        });
	        topAlt.clsOpen = null;
	        topAlt.basicError = true;
	        break;
	      case id.MATCH:
	        if (data.strict) {
	          data.errors.push({
	            line: data.findLine(data.lines, topAlt.clsOpen),
	            char: topAlt.clsOpen,
	            msg: "Case-sensitive string operator('...') found - strict ABNF specified.",
	          });
	        }
	        topAlt.clsOpen = null;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synProsValOpen = function (result, chars, phraseIndex) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        topAlt.prosValOpen = phraseIndex;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synProsValString = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        data.stringTabChar = false;
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (data.stringTabChar !== false) {
	          data.errors.push({
	            line: data.findLine(data.lines, data.stringTabChar),
	            char: data.stringTabChar,
	            msg: 'Tab character (\\t, x09) not allowed in prose value string.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synProsValClose = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, topAlt.prosValOpen),
	          char: topAlt.prosValOpen,
	          msg: 'Prose value operator(<...>) opened but not closed.',
	        });
	        topAlt.basicError = true;
	        topAlt.prosValOpen = null;
	        break;
	      case id.MATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, topAlt.prosValOpen),
	          char: topAlt.prosValOpen,
	          msg: 'Prose value operator(<...>) found. The ABNF syntax is valid, but a parser cannot be generated from this grammar.',
	        });
	        topAlt.prosValOpen = null;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synGroupOpen = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        topAlt = {
	          groupOpen: phraseIndex,
	          groupError: false,
	          optionOpen: null,
	          optionError: false,
	          tlsOpen: null,
	          clsOpen: null,
	          prosValOpen: null,
	          basicError: false,
	        };
	        data.altStack.push(topAlt);
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synGroupClose = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, topAlt.groupOpen),
	          char: topAlt.groupOpen,
	          msg: 'Group "(...)" opened but not closed.',
	        });
	        topAlt = data.altStack.pop();
	        topAlt.groupError = true;
	        break;
	      case id.MATCH:
	        topAlt = data.altStack.pop();
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synOptionOpen = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        topAlt = {
	          groupOpen: null,
	          groupError: false,
	          optionOpen: phraseIndex,
	          optionError: false,
	          tlsOpen: null,
	          clsOpen: null,
	          prosValOpen: null,
	          basicError: false,
	        };
	        data.altStack.push(topAlt);
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synOptionClose = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, topAlt.optionOpen),
	          char: topAlt.optionOpen,
	          msg: 'Option "[...]" opened but not closed.',
	        });
	        topAlt = data.altStack.pop();
	        topAlt.optionError = true;
	        break;
	      case id.MATCH:
	        topAlt = data.altStack.pop();
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synBasicElementError = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (topAlt.basicError === false) {
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: 'Unrecognized SABNF element.',
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synLineEnd = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        if (result.phraseLength === 1 && data.strict) {
	          const end = chars[phraseIndex] === 13 ? 'CR' : 'LF';
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: `Line end '${end}' found - strict ABNF specified, only CRLF allowed.`,
	          });
	        }
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synLineEndError = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        break;
	      case id.MATCH:
	        data.errors.push({
	          line: data.findLine(data.lines, phraseIndex, data.charsLength),
	          char: phraseIndex,
	          msg: 'Unrecognized grammar element or characters.',
	        });
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  const synRepetition = function (result, chars, phraseIndex, data) {
	    switch (result.state) {
	      case id.ACTIVE:
	        break;
	      case id.EMPTY:
	        break;
	      case id.NOMATCH:
	        data.repCount += 1;
	        break;
	      case id.MATCH:
	        data.repCount += 1;
	        break;
	      default:
	        throw new Error(`${thisFileName}synFile: unrecognized case.`);
	    }
	  };
	  // Define the list of callback functions.
	  this.callbacks = [];
	  this.callbacks.andop = synAndOp;
	  this.callbacks.basicelementerr = synBasicElementError;
	  this.callbacks.clsclose = synClsClose;
	  this.callbacks.clsopen = synClsOpen;
	  this.callbacks.clsstring = synClsString;
	  this.callbacks.definedaserror = synDefinedAsError;
	  this.callbacks.file = synFile;
	  this.callbacks.groupclose = synGroupClose;
	  this.callbacks.groupopen = synGroupOpen;
	  this.callbacks.lineenderror = synLineEndError;
	  this.callbacks.lineend = synLineEnd;
	  this.callbacks.notop = synNotOp;
	  this.callbacks.optionclose = synOptionClose;
	  this.callbacks.optionopen = synOptionOpen;
	  this.callbacks.prosvalclose = synProsValClose;
	  this.callbacks.prosvalopen = synProsValOpen;
	  this.callbacks.prosvalstring = synProsValString;
	  this.callbacks.repetition = synRepetition;
	  this.callbacks.rule = synRule;
	  this.callbacks.ruleerror = synRuleError;
	  this.callbacks.rulenameerror = synRuleNameError;
	  this.callbacks.stringtab = synStringTab;
	  this.callbacks.tlsclose = synTlsClose;
	  this.callbacks.tlsopen = synTlsOpen;
	  this.callbacks.tlsstring = synTlsString;
	  this.callbacks.udtop = synUdtOp;
	  this.callbacks.bkaop = synBkaOp;
	  this.callbacks.bknop = synBknOp;
	  this.callbacks.bkrop = synBkrOp;
	  this.callbacks.abgop = synAbgOp;
	  this.callbacks.aenop = synAenOp;
	};
	return syntaxCallbacks;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var semanticCallbacks;
var hasRequiredSemanticCallbacks;

function requireSemanticCallbacks () {
	if (hasRequiredSemanticCallbacks) return semanticCallbacks;
	hasRequiredSemanticCallbacks = 1;
	// This module has all of the AST translation callback functions for the semantic analysis
	// phase of the generator.
	// See:<br>
	// `./dist/abnf-for-sabnf-grammar.bnf`<br>
	// for the grammar file these callback functions are based on.
	semanticCallbacks = function exfn() {
	  const apglib = requireNodeExports$1();
	  const id = apglib.ids;

	  /* Some helper functions. */
	  const NameList = function NameList() {
	    this.names = [];
	    /* Adds a new rule name object to the list. Returns -1 if the name already exists. */
	    /* Returns the added name object if the name does not already exist. */
	    this.add = function add(name) {
	      let ret = -1;
	      const find = this.get(name);
	      if (find === -1) {
	        ret = {
	          name,
	          lower: name.toLowerCase(),
	          index: this.names.length,
	        };
	        this.names.push(ret);
	      }
	      return ret;
	    };
	    /* Brute-force look up. */
	    this.get = function get(name) {
	      let ret = -1;
	      const lower = name.toLowerCase();
	      for (let i = 0; i < this.names.length; i += 1) {
	        if (this.names[i].lower === lower) {
	          ret = this.names[i];
	          break;
	        }
	      }
	      return ret;
	    };
	  };
	  /* converts text decimal numbers from, e.g. %d99, to an integer */
	  const decnum = function decnum(chars, beg, len) {
	    let num = 0;
	    for (let i = beg; i < beg + len; i += 1) {
	      num = 10 * num + chars[i] - 48;
	    }
	    return num;
	  };
	  /* converts text binary numbers from, e.g. %b10, to an integer */
	  const binnum = function binnum(chars, beg, len) {
	    let num = 0;
	    for (let i = beg; i < beg + len; i += 1) {
	      num = 2 * num + chars[i] - 48;
	    }
	    return num;
	  };
	  /* converts text hexadecimal numbers from, e.g. %xff, to an integer */
	  const hexnum = function hexnum(chars, beg, len) {
	    let num = 0;
	    for (let i = beg; i < beg + len; i += 1) {
	      let digit = chars[i];
	      if (digit >= 48 && digit <= 57) {
	        digit -= 48;
	      } else if (digit >= 65 && digit <= 70) {
	        digit -= 55;
	      } else if (digit >= 97 && digit <= 102) {
	        digit -= 87;
	      } else {
	        throw new Error('hexnum out of range');
	      }
	      num = 16 * num + digit;
	    }
	    return num;
	  };

	  // This is the prototype for all semantic analysis callback functions.
	  // ````
	  // state - the translator state
	  //   id.SEM_PRE for downward (pre-branch) traversal of the AST
	  //   id.SEM_POST for upward (post branch) traversal of the AST
	  // chars - the array of character codes for the input string
	  // phraseIndex - index into the chars array to the first
	  //               character of the phrase
	  // phraseCount - the number of characters in the phrase
	  // data - user-defined data passed to the translator
	  //        for use by the callback functions.
	  // @return id.SEM_OK, normal return.
	  //         id.SEM_SKIP in state id.SEM_PRE will
	  //         skip the branch below.
	  //         Any thing else is an error which will
	  //         stop the translation.
	  // ````
	  /*
	  function semCallbackPrototype(state, chars, phraseIndex, phraseCount, data) {
	    let ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	    } else if (state === id.SEM_POST) {
	    }
	    return ret;
	  }
	  */
	  // The AST callback functions.
	  function semFile(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.ruleNames = new NameList();
	      data.udtNames = new NameList();
	      data.rules = [];
	      data.udts = [];
	      data.rulesLineMap = [];
	      data.opcodes = [];
	      data.altStack = [];
	      data.topStack = null;
	      data.topRule = null;
	    } else if (state === id.SEM_POST) {
	      /* validate RNM rule names and set opcode rule index */
	      let nameObj;
	      data.rules.forEach((rule) => {
	        rule.isBkr = false;
	        rule.opcodes.forEach((op) => {
	          if (op.type === id.RNM) {
	            nameObj = data.ruleNames.get(op.index.name);
	            if (nameObj === -1) {
	              data.errors.push({
	                line: data.findLine(data.lines, op.index.phraseIndex, data.charsLength),
	                char: op.index.phraseIndex,
	                msg: `Rule name '${op.index.name}' used but not defined.`,
	              });
	              op.index = -1;
	            } else {
	              op.index = nameObj.index;
	            }
	          }
	        });
	      });
	      /* validate BKR rule names and set opcode rule index */
	      data.udts.forEach((udt) => {
	        udt.isBkr = false;
	      });
	      data.rules.forEach((rule) => {
	        rule.opcodes.forEach((op) => {
	          if (op.type === id.BKR) {
	            rule.hasBkr = true;
	            nameObj = data.ruleNames.get(op.index.name);
	            if (nameObj !== -1) {
	              data.rules[nameObj.index].isBkr = true;
	              op.index = nameObj.index;
	            } else {
	              nameObj = data.udtNames.get(op.index.name);
	              if (nameObj !== -1) {
	                data.udts[nameObj.index].isBkr = true;
	                op.index = data.rules.length + nameObj.index;
	              } else {
	                data.errors.push({
	                  line: data.findLine(data.lines, op.index.phraseIndex, data.charsLength),
	                  char: op.index.phraseIndex,
	                  msg: `Back reference name '${op.index.name}' refers to undefined rule or unamed UDT.`,
	                });
	                op.index = -1;
	              }
	            }
	          }
	        });
	      });
	    }
	    return ret;
	  }
	  function semRule(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.altStack.length = 0;
	      data.topStack = null;
	      data.rulesLineMap.push({
	        line: data.findLine(data.lines, phraseIndex, data.charsLength),
	        char: phraseIndex,
	      });
	    }
	    return ret;
	  }
	  function semRuleLookup(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.ruleName = '';
	      data.definedas = '';
	    } else if (state === id.SEM_POST) {
	      let ruleName;
	      if (data.definedas === '=') {
	        ruleName = data.ruleNames.add(data.ruleName);
	        if (ruleName === -1) {
	          data.definedas = null;
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: `Rule name '${data.ruleName}' previously defined.`,
	          });
	        } else {
	          /* start a new rule */
	          data.topRule = {
	            name: ruleName.name,
	            lower: ruleName.lower,
	            opcodes: [],
	            index: ruleName.index,
	          };
	          data.rules.push(data.topRule);
	          data.opcodes = data.topRule.opcodes;
	        }
	      } else {
	        ruleName = data.ruleNames.get(data.ruleName);
	        if (ruleName === -1) {
	          data.definedas = null;
	          data.errors.push({
	            line: data.findLine(data.lines, phraseIndex, data.charsLength),
	            char: phraseIndex,
	            msg: `Rule name '${data.ruleName}' for incremental alternate not previously defined.`,
	          });
	        } else {
	          data.topRule = data.rules[ruleName.index];
	          data.opcodes = data.topRule.opcodes;
	        }
	      }
	    }
	    return ret;
	  }
	  function semAlternation(state, chars, phraseIndex, phraseCount, data) {
	    let ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      const TRUE = true;
	      while (TRUE) {
	        if (data.definedas === null) {
	          /* rule error - skip opcode generation */
	          ret = id.SEM_SKIP;
	          break;
	        }
	        if (data.topStack === null) {
	          /* top-level ALT */
	          if (data.definedas === '=') {
	            /* "=" new rule */
	            data.topStack = {
	              alt: {
	                type: id.ALT,
	                children: [],
	              },
	              cat: null,
	            };
	            data.altStack.push(data.topStack);
	            data.opcodes.push(data.topStack.alt);
	            break;
	          }
	          /* "=/" incremental alternate */
	          data.topStack = {
	            alt: data.opcodes[0],
	            cat: null,
	          };
	          data.altStack.push(data.topStack);
	          break;
	        }
	        /* lower-level ALT */
	        data.topStack = {
	          alt: {
	            type: id.ALT,
	            children: [],
	          },
	          cat: null,
	        };
	        data.altStack.push(data.topStack);
	        data.opcodes.push(data.topStack.alt);
	        break;
	      }
	    } else if (state === id.SEM_POST) {
	      data.altStack.pop();
	      if (data.altStack.length > 0) {
	        data.topStack = data.altStack[data.altStack.length - 1];
	      } else {
	        data.topStack = null;
	      }
	    }
	    return ret;
	  }
	  function semConcatenation(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.topStack.alt.children.push(data.opcodes.length);
	      data.topStack.cat = {
	        type: id.CAT,
	        children: [],
	      };
	      data.opcodes.push(data.topStack.cat);
	    } else if (state === id.SEM_POST) {
	      data.topStack.cat = null;
	    }
	    return ret;
	  }
	  function semRepetition(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.topStack.cat.children.push(data.opcodes.length);
	    }
	    return ret;
	  }
	  function semOptionOpen(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.REP,
	        min: 0,
	        max: 1,
	        char: phraseIndex,
	      });
	    }
	    return ret;
	  }
	  function semRuleName(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.ruleName = apglib.utils.charsToString(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semDefined(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.definedas = '=';
	    }
	    return ret;
	  }
	  function semIncAlt(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.definedas = '=/';
	    }
	    return ret;
	  }
	  function semRepOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.min = 0;
	      data.max = Infinity;
	      data.topRep = {
	        type: id.REP,
	        min: 0,
	        max: Infinity,
	      };
	      data.opcodes.push(data.topRep);
	    } else if (state === id.SEM_POST) {
	      if (data.min > data.max) {
	        data.errors.push({
	          line: data.findLine(data.lines, phraseIndex, data.charsLength),
	          char: phraseIndex,
	          msg: `repetition min cannot be greater than max: min: ${data.min}: max: ${data.max}`,
	        });
	      }
	      data.topRep.min = data.min;
	      data.topRep.max = data.max;
	    }
	    return ret;
	  }
	  function semRepMin(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.min = decnum(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semRepMax(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.max = decnum(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semRepMinMax(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.max = decnum(chars, phraseIndex, phraseCount);
	      data.min = data.max;
	    }
	    return ret;
	  }
	  function semAndOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.AND,
	      });
	    }
	    return ret;
	  }
	  function semNotOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.NOT,
	      });
	    }
	    return ret;
	  }
	  function semRnmOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.RNM,
	        /* NOTE: this is temporary info, index will be replaced with integer later. */
	        /* Probably not the best coding practice but here you go. */
	        index: {
	          phraseIndex,
	          name: apglib.utils.charsToString(chars, phraseIndex, phraseCount),
	        },
	      });
	    }
	    return ret;
	  }
	  function semAbgOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.ABG,
	      });
	    }
	    return ret;
	  }
	  function semAenOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.AEN,
	      });
	    }
	    return ret;
	  }
	  function semBkaOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.BKA,
	      });
	    }
	    return ret;
	  }
	  function semBknOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.BKN,
	      });
	    }
	    return ret;
	  }
	  function semBkrOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.ci = true; /* default to case insensitive */
	      data.cs = false;
	      data.um = true;
	      data.pm = false;
	    } else if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.BKR,
	        bkrCase: data.cs === true ? id.BKR_MODE_CS : id.BKR_MODE_CI,
	        bkrMode: data.pm === true ? id.BKR_MODE_PM : id.BKR_MODE_UM,
	        /* NOTE: this is temporary info, index will be replaced with integer later. */
	        /* Probably not the best coding practice but here you go. */
	        index: {
	          phraseIndex: data.bkrname.phraseIndex,
	          name: apglib.utils.charsToString(chars, data.bkrname.phraseIndex, data.bkrname.phraseLength),
	        },
	      });
	    }
	    return ret;
	  }
	  function semBkrCi(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.ci = true;
	    }
	    return ret;
	  }
	  function semBkrCs(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.cs = true;
	    }
	    return ret;
	  }
	  function semBkrUm(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.um = true;
	    }
	    return ret;
	  }
	  function semBkrPm(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.pm = true;
	    }
	    return ret;
	  }
	  function semBkrName(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.bkrname = {
	        phraseIndex,
	        phraseLength: phraseCount,
	      };
	    }
	    return ret;
	  }
	  function semUdtEmpty(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      const name = apglib.utils.charsToString(chars, phraseIndex, phraseCount);
	      let udtName = data.udtNames.add(name);
	      if (udtName === -1) {
	        udtName = data.udtNames.get(name);
	        if (udtName === -1) {
	          throw new Error('semUdtEmpty: name look up error');
	        }
	      } else {
	        data.udts.push({
	          name: udtName.name,
	          lower: udtName.lower,
	          index: udtName.index,
	          empty: true,
	        });
	      }
	      data.opcodes.push({
	        type: id.UDT,
	        empty: true,
	        index: udtName.index,
	      });
	    }
	    return ret;
	  }
	  function semUdtNonEmpty(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      const name = apglib.utils.charsToString(chars, phraseIndex, phraseCount);
	      let udtName = data.udtNames.add(name);
	      if (udtName === -1) {
	        udtName = data.udtNames.get(name);
	        if (udtName === -1) {
	          throw new Error('semUdtNonEmpty: name look up error');
	        }
	      } else {
	        data.udts.push({
	          name: udtName.name,
	          lower: udtName.lower,
	          index: udtName.index,
	          empty: false,
	        });
	      }
	      data.opcodes.push({
	        type: id.UDT,
	        empty: false,
	        index: udtName.index,
	        syntax: null,
	        semantic: null,
	      });
	    }
	    return ret;
	  }
	  function semTlsOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.tlscase = true; /* default to case insensitive */
	    }
	    return ret;
	  }
	  function semTlsCase(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      if (phraseCount > 0 && (chars[phraseIndex + 1] === 83 || chars[phraseIndex + 1] === 115)) {
	        data.tlscase = false; /* set to case sensitive */
	      }
	    }
	    return ret;
	  }
	  function semTlsString(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      if (data.tlscase) {
	        const str = chars.slice(phraseIndex, phraseIndex + phraseCount);
	        for (let i = 0; i < str.length; i += 1) {
	          if (str[i] >= 65 && str[i] <= 90) {
	            str[i] += 32;
	          }
	        }
	        data.opcodes.push({
	          type: id.TLS,
	          string: str,
	        });
	      } else {
	        data.opcodes.push({
	          type: id.TBS,
	          string: chars.slice(phraseIndex, phraseIndex + phraseCount),
	        });
	      }
	    }
	    return ret;
	  }
	  function semClsOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      if (phraseCount <= 2) {
	        /* only TLS is allowed to be empty */
	        data.opcodes.push({
	          type: id.TLS,
	          string: [],
	        });
	      } else {
	        data.opcodes.push({
	          type: id.TBS,
	          string: chars.slice(phraseIndex + 1, phraseIndex + phraseCount - 1),
	        });
	      }
	    }
	    return ret;
	  }
	  function semTbsOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.tbsstr = [];
	    } else if (state === id.SEM_POST) {
	      data.opcodes.push({
	        type: id.TBS,
	        string: data.tbsstr,
	      });
	    }
	    return ret;
	  }
	  function semTrgOp(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_PRE) {
	      data.min = 0;
	      data.max = 0;
	    } else if (state === id.SEM_POST) {
	      if (data.min > data.max) {
	        data.errors.push({
	          line: data.findLine(data.lines, phraseIndex, data.charsLength),
	          char: phraseIndex,
	          msg: `TRG, (%dmin-max), min cannot be greater than max: min: ${data.min}: max: ${data.max}`,
	        });
	      }
	      data.opcodes.push({
	        type: id.TRG,
	        min: data.min,
	        max: data.max,
	      });
	    }
	    return ret;
	  }
	  function semDmin(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.min = decnum(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semDmax(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.max = decnum(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semBmin(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.min = binnum(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semBmax(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.max = binnum(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semXmin(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.min = hexnum(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semXmax(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.max = hexnum(chars, phraseIndex, phraseCount);
	    }
	    return ret;
	  }
	  function semDstring(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.tbsstr.push(decnum(chars, phraseIndex, phraseCount));
	    }
	    return ret;
	  }
	  function semBstring(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.tbsstr.push(binnum(chars, phraseIndex, phraseCount));
	    }
	    return ret;
	  }
	  function semXstring(state, chars, phraseIndex, phraseCount, data) {
	    const ret = id.SEM_OK;
	    if (state === id.SEM_POST) {
	      data.tbsstr.push(hexnum(chars, phraseIndex, phraseCount));
	    }
	    return ret;
	  }
	  // Define the callback functions to the AST object.
	  this.callbacks = [];
	  this.callbacks.abgop = semAbgOp;
	  this.callbacks.aenop = semAenOp;
	  this.callbacks.alternation = semAlternation;
	  this.callbacks.andop = semAndOp;
	  this.callbacks.bmax = semBmax;
	  this.callbacks.bmin = semBmin;
	  this.callbacks.bkaop = semBkaOp;
	  this.callbacks.bknop = semBknOp;
	  this.callbacks.bkrop = semBkrOp;
	  this.callbacks['bkr-name'] = semBkrName;
	  this.callbacks.bstring = semBstring;
	  this.callbacks.clsop = semClsOp;
	  this.callbacks.ci = semBkrCi;
	  this.callbacks.cs = semBkrCs;
	  this.callbacks.um = semBkrUm;
	  this.callbacks.pm = semBkrPm;
	  this.callbacks.concatenation = semConcatenation;
	  this.callbacks.defined = semDefined;
	  this.callbacks.dmax = semDmax;
	  this.callbacks.dmin = semDmin;
	  this.callbacks.dstring = semDstring;
	  this.callbacks.file = semFile;
	  this.callbacks.incalt = semIncAlt;
	  this.callbacks.notop = semNotOp;
	  this.callbacks.optionopen = semOptionOpen;
	  this.callbacks['rep-max'] = semRepMax;
	  this.callbacks['rep-min'] = semRepMin;
	  this.callbacks['rep-min-max'] = semRepMinMax;
	  this.callbacks.repetition = semRepetition;
	  this.callbacks.repop = semRepOp;
	  this.callbacks.rnmop = semRnmOp;
	  this.callbacks.rule = semRule;
	  this.callbacks.rulelookup = semRuleLookup;
	  this.callbacks.rulename = semRuleName;
	  this.callbacks.tbsop = semTbsOp;
	  this.callbacks.tlscase = semTlsCase;
	  this.callbacks.tlsstring = semTlsString;
	  this.callbacks.tlsop = semTlsOp;
	  this.callbacks.trgop = semTrgOp;
	  this.callbacks['udt-empty'] = semUdtEmpty;
	  this.callbacks['udt-non-empty'] = semUdtNonEmpty;
	  this.callbacks.xmax = semXmax;
	  this.callbacks.xmin = semXmin;
	  this.callbacks.xstring = semXstring;
	};
	return semanticCallbacks;
}

var sabnfGrammar;
var hasRequiredSabnfGrammar;

function requireSabnfGrammar () {
	if (hasRequiredSabnfGrammar) return sabnfGrammar;
	hasRequiredSabnfGrammar = 1;
	// copyright: Copyright (c) 2024 Lowell D. Thomas, all rights reserved<br>
	//   license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)<br>
	//
	// Generated by apg-js, Version 4.4.0 [apg-js](https://github.com/ldthomas/apg-js)
	sabnfGrammar = function grammar(){
	  // ```
	  // SUMMARY
	  //      rules = 95
	  //       udts = 0
	  //    opcodes = 372
	  //        ---   ABNF original opcodes
	  //        ALT = 43
	  //        CAT = 48
	  //        REP = 34
	  //        RNM = 149
	  //        TLS = 2
	  //        TBS = 61
	  //        TRG = 35
	  //        ---   SABNF superset opcodes
	  //        UDT = 0
	  //        AND = 0
	  //        NOT = 0
	  //        BKA = 0
	  //        BKN = 0
	  //        BKR = 0
	  //        ABG = 0
	  //        AEN = 0
	  // characters = [9 - 126]
	  // ```
	  /* OBJECT IDENTIFIER (for internal parser use) */
	  this.grammarObject = 'grammarObject';

	  /* RULES */
	  this.rules = [];
	  this.rules[0] = { name: 'File', lower: 'file', index: 0, isBkr: false };
	  this.rules[1] = { name: 'BlankLine', lower: 'blankline', index: 1, isBkr: false };
	  this.rules[2] = { name: 'Rule', lower: 'rule', index: 2, isBkr: false };
	  this.rules[3] = { name: 'RuleLookup', lower: 'rulelookup', index: 3, isBkr: false };
	  this.rules[4] = { name: 'RuleNameTest', lower: 'rulenametest', index: 4, isBkr: false };
	  this.rules[5] = { name: 'RuleName', lower: 'rulename', index: 5, isBkr: false };
	  this.rules[6] = { name: 'RuleNameError', lower: 'rulenameerror', index: 6, isBkr: false };
	  this.rules[7] = { name: 'DefinedAsTest', lower: 'definedastest', index: 7, isBkr: false };
	  this.rules[8] = { name: 'DefinedAsError', lower: 'definedaserror', index: 8, isBkr: false };
	  this.rules[9] = { name: 'DefinedAs', lower: 'definedas', index: 9, isBkr: false };
	  this.rules[10] = { name: 'Defined', lower: 'defined', index: 10, isBkr: false };
	  this.rules[11] = { name: 'IncAlt', lower: 'incalt', index: 11, isBkr: false };
	  this.rules[12] = { name: 'RuleError', lower: 'ruleerror', index: 12, isBkr: false };
	  this.rules[13] = { name: 'LineEndError', lower: 'lineenderror', index: 13, isBkr: false };
	  this.rules[14] = { name: 'Alternation', lower: 'alternation', index: 14, isBkr: false };
	  this.rules[15] = { name: 'Concatenation', lower: 'concatenation', index: 15, isBkr: false };
	  this.rules[16] = { name: 'Repetition', lower: 'repetition', index: 16, isBkr: false };
	  this.rules[17] = { name: 'Modifier', lower: 'modifier', index: 17, isBkr: false };
	  this.rules[18] = { name: 'Predicate', lower: 'predicate', index: 18, isBkr: false };
	  this.rules[19] = { name: 'BasicElement', lower: 'basicelement', index: 19, isBkr: false };
	  this.rules[20] = { name: 'BasicElementErr', lower: 'basicelementerr', index: 20, isBkr: false };
	  this.rules[21] = { name: 'Group', lower: 'group', index: 21, isBkr: false };
	  this.rules[22] = { name: 'GroupError', lower: 'grouperror', index: 22, isBkr: false };
	  this.rules[23] = { name: 'GroupOpen', lower: 'groupopen', index: 23, isBkr: false };
	  this.rules[24] = { name: 'GroupClose', lower: 'groupclose', index: 24, isBkr: false };
	  this.rules[25] = { name: 'Option', lower: 'option', index: 25, isBkr: false };
	  this.rules[26] = { name: 'OptionError', lower: 'optionerror', index: 26, isBkr: false };
	  this.rules[27] = { name: 'OptionOpen', lower: 'optionopen', index: 27, isBkr: false };
	  this.rules[28] = { name: 'OptionClose', lower: 'optionclose', index: 28, isBkr: false };
	  this.rules[29] = { name: 'RnmOp', lower: 'rnmop', index: 29, isBkr: false };
	  this.rules[30] = { name: 'BkrOp', lower: 'bkrop', index: 30, isBkr: false };
	  this.rules[31] = { name: 'bkrModifier', lower: 'bkrmodifier', index: 31, isBkr: false };
	  this.rules[32] = { name: 'cs', lower: 'cs', index: 32, isBkr: false };
	  this.rules[33] = { name: 'ci', lower: 'ci', index: 33, isBkr: false };
	  this.rules[34] = { name: 'um', lower: 'um', index: 34, isBkr: false };
	  this.rules[35] = { name: 'pm', lower: 'pm', index: 35, isBkr: false };
	  this.rules[36] = { name: 'bkr-name', lower: 'bkr-name', index: 36, isBkr: false };
	  this.rules[37] = { name: 'rname', lower: 'rname', index: 37, isBkr: false };
	  this.rules[38] = { name: 'uname', lower: 'uname', index: 38, isBkr: false };
	  this.rules[39] = { name: 'ename', lower: 'ename', index: 39, isBkr: false };
	  this.rules[40] = { name: 'UdtOp', lower: 'udtop', index: 40, isBkr: false };
	  this.rules[41] = { name: 'udt-non-empty', lower: 'udt-non-empty', index: 41, isBkr: false };
	  this.rules[42] = { name: 'udt-empty', lower: 'udt-empty', index: 42, isBkr: false };
	  this.rules[43] = { name: 'RepOp', lower: 'repop', index: 43, isBkr: false };
	  this.rules[44] = { name: 'AltOp', lower: 'altop', index: 44, isBkr: false };
	  this.rules[45] = { name: 'CatOp', lower: 'catop', index: 45, isBkr: false };
	  this.rules[46] = { name: 'StarOp', lower: 'starop', index: 46, isBkr: false };
	  this.rules[47] = { name: 'AndOp', lower: 'andop', index: 47, isBkr: false };
	  this.rules[48] = { name: 'NotOp', lower: 'notop', index: 48, isBkr: false };
	  this.rules[49] = { name: 'BkaOp', lower: 'bkaop', index: 49, isBkr: false };
	  this.rules[50] = { name: 'BknOp', lower: 'bknop', index: 50, isBkr: false };
	  this.rules[51] = { name: 'AbgOp', lower: 'abgop', index: 51, isBkr: false };
	  this.rules[52] = { name: 'AenOp', lower: 'aenop', index: 52, isBkr: false };
	  this.rules[53] = { name: 'TrgOp', lower: 'trgop', index: 53, isBkr: false };
	  this.rules[54] = { name: 'TbsOp', lower: 'tbsop', index: 54, isBkr: false };
	  this.rules[55] = { name: 'TlsOp', lower: 'tlsop', index: 55, isBkr: false };
	  this.rules[56] = { name: 'TlsCase', lower: 'tlscase', index: 56, isBkr: false };
	  this.rules[57] = { name: 'TlsOpen', lower: 'tlsopen', index: 57, isBkr: false };
	  this.rules[58] = { name: 'TlsClose', lower: 'tlsclose', index: 58, isBkr: false };
	  this.rules[59] = { name: 'TlsString', lower: 'tlsstring', index: 59, isBkr: false };
	  this.rules[60] = { name: 'StringTab', lower: 'stringtab', index: 60, isBkr: false };
	  this.rules[61] = { name: 'ClsOp', lower: 'clsop', index: 61, isBkr: false };
	  this.rules[62] = { name: 'ClsOpen', lower: 'clsopen', index: 62, isBkr: false };
	  this.rules[63] = { name: 'ClsClose', lower: 'clsclose', index: 63, isBkr: false };
	  this.rules[64] = { name: 'ClsString', lower: 'clsstring', index: 64, isBkr: false };
	  this.rules[65] = { name: 'ProsVal', lower: 'prosval', index: 65, isBkr: false };
	  this.rules[66] = { name: 'ProsValOpen', lower: 'prosvalopen', index: 66, isBkr: false };
	  this.rules[67] = { name: 'ProsValString', lower: 'prosvalstring', index: 67, isBkr: false };
	  this.rules[68] = { name: 'ProsValClose', lower: 'prosvalclose', index: 68, isBkr: false };
	  this.rules[69] = { name: 'rep-min', lower: 'rep-min', index: 69, isBkr: false };
	  this.rules[70] = { name: 'rep-min-max', lower: 'rep-min-max', index: 70, isBkr: false };
	  this.rules[71] = { name: 'rep-max', lower: 'rep-max', index: 71, isBkr: false };
	  this.rules[72] = { name: 'rep-num', lower: 'rep-num', index: 72, isBkr: false };
	  this.rules[73] = { name: 'dString', lower: 'dstring', index: 73, isBkr: false };
	  this.rules[74] = { name: 'xString', lower: 'xstring', index: 74, isBkr: false };
	  this.rules[75] = { name: 'bString', lower: 'bstring', index: 75, isBkr: false };
	  this.rules[76] = { name: 'Dec', lower: 'dec', index: 76, isBkr: false };
	  this.rules[77] = { name: 'Hex', lower: 'hex', index: 77, isBkr: false };
	  this.rules[78] = { name: 'Bin', lower: 'bin', index: 78, isBkr: false };
	  this.rules[79] = { name: 'dmin', lower: 'dmin', index: 79, isBkr: false };
	  this.rules[80] = { name: 'dmax', lower: 'dmax', index: 80, isBkr: false };
	  this.rules[81] = { name: 'bmin', lower: 'bmin', index: 81, isBkr: false };
	  this.rules[82] = { name: 'bmax', lower: 'bmax', index: 82, isBkr: false };
	  this.rules[83] = { name: 'xmin', lower: 'xmin', index: 83, isBkr: false };
	  this.rules[84] = { name: 'xmax', lower: 'xmax', index: 84, isBkr: false };
	  this.rules[85] = { name: 'dnum', lower: 'dnum', index: 85, isBkr: false };
	  this.rules[86] = { name: 'bnum', lower: 'bnum', index: 86, isBkr: false };
	  this.rules[87] = { name: 'xnum', lower: 'xnum', index: 87, isBkr: false };
	  this.rules[88] = { name: 'alphanum', lower: 'alphanum', index: 88, isBkr: false };
	  this.rules[89] = { name: 'owsp', lower: 'owsp', index: 89, isBkr: false };
	  this.rules[90] = { name: 'wsp', lower: 'wsp', index: 90, isBkr: false };
	  this.rules[91] = { name: 'space', lower: 'space', index: 91, isBkr: false };
	  this.rules[92] = { name: 'comment', lower: 'comment', index: 92, isBkr: false };
	  this.rules[93] = { name: 'LineEnd', lower: 'lineend', index: 93, isBkr: false };
	  this.rules[94] = { name: 'LineContinue', lower: 'linecontinue', index: 94, isBkr: false };

	  /* UDTS */
	  this.udts = [];

	  /* OPCODES */
	  /* File */
	  this.rules[0].opcodes = [];
	  this.rules[0].opcodes[0] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[0].opcodes[1] = { type: 1, children: [2,3,4] };// ALT
	  this.rules[0].opcodes[2] = { type: 4, index: 1 };// RNM(BlankLine)
	  this.rules[0].opcodes[3] = { type: 4, index: 2 };// RNM(Rule)
	  this.rules[0].opcodes[4] = { type: 4, index: 12 };// RNM(RuleError)

	  /* BlankLine */
	  this.rules[1].opcodes = [];
	  this.rules[1].opcodes[0] = { type: 2, children: [1,5,7] };// CAT
	  this.rules[1].opcodes[1] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[1].opcodes[2] = { type: 1, children: [3,4] };// ALT
	  this.rules[1].opcodes[3] = { type: 6, string: [32] };// TBS
	  this.rules[1].opcodes[4] = { type: 6, string: [9] };// TBS
	  this.rules[1].opcodes[5] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[1].opcodes[6] = { type: 4, index: 92 };// RNM(comment)
	  this.rules[1].opcodes[7] = { type: 4, index: 93 };// RNM(LineEnd)

	  /* Rule */
	  this.rules[2].opcodes = [];
	  this.rules[2].opcodes[0] = { type: 2, children: [1,2,3,4] };// CAT
	  this.rules[2].opcodes[1] = { type: 4, index: 3 };// RNM(RuleLookup)
	  this.rules[2].opcodes[2] = { type: 4, index: 89 };// RNM(owsp)
	  this.rules[2].opcodes[3] = { type: 4, index: 14 };// RNM(Alternation)
	  this.rules[2].opcodes[4] = { type: 1, children: [5,8] };// ALT
	  this.rules[2].opcodes[5] = { type: 2, children: [6,7] };// CAT
	  this.rules[2].opcodes[6] = { type: 4, index: 89 };// RNM(owsp)
	  this.rules[2].opcodes[7] = { type: 4, index: 93 };// RNM(LineEnd)
	  this.rules[2].opcodes[8] = { type: 2, children: [9,10] };// CAT
	  this.rules[2].opcodes[9] = { type: 4, index: 13 };// RNM(LineEndError)
	  this.rules[2].opcodes[10] = { type: 4, index: 93 };// RNM(LineEnd)

	  /* RuleLookup */
	  this.rules[3].opcodes = [];
	  this.rules[3].opcodes[0] = { type: 2, children: [1,2,3] };// CAT
	  this.rules[3].opcodes[1] = { type: 4, index: 4 };// RNM(RuleNameTest)
	  this.rules[3].opcodes[2] = { type: 4, index: 89 };// RNM(owsp)
	  this.rules[3].opcodes[3] = { type: 4, index: 7 };// RNM(DefinedAsTest)

	  /* RuleNameTest */
	  this.rules[4].opcodes = [];
	  this.rules[4].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[4].opcodes[1] = { type: 4, index: 5 };// RNM(RuleName)
	  this.rules[4].opcodes[2] = { type: 4, index: 6 };// RNM(RuleNameError)

	  /* RuleName */
	  this.rules[5].opcodes = [];
	  this.rules[5].opcodes[0] = { type: 4, index: 88 };// RNM(alphanum)

	  /* RuleNameError */
	  this.rules[6].opcodes = [];
	  this.rules[6].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[6].opcodes[1] = { type: 1, children: [2,3] };// ALT
	  this.rules[6].opcodes[2] = { type: 5, min: 33, max: 60 };// TRG
	  this.rules[6].opcodes[3] = { type: 5, min: 62, max: 126 };// TRG

	  /* DefinedAsTest */
	  this.rules[7].opcodes = [];
	  this.rules[7].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[7].opcodes[1] = { type: 4, index: 9 };// RNM(DefinedAs)
	  this.rules[7].opcodes[2] = { type: 4, index: 8 };// RNM(DefinedAsError)

	  /* DefinedAsError */
	  this.rules[8].opcodes = [];
	  this.rules[8].opcodes[0] = { type: 3, min: 1, max: 2 };// REP
	  this.rules[8].opcodes[1] = { type: 5, min: 33, max: 126 };// TRG

	  /* DefinedAs */
	  this.rules[9].opcodes = [];
	  this.rules[9].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[9].opcodes[1] = { type: 4, index: 11 };// RNM(IncAlt)
	  this.rules[9].opcodes[2] = { type: 4, index: 10 };// RNM(Defined)

	  /* Defined */
	  this.rules[10].opcodes = [];
	  this.rules[10].opcodes[0] = { type: 6, string: [61] };// TBS

	  /* IncAlt */
	  this.rules[11].opcodes = [];
	  this.rules[11].opcodes[0] = { type: 6, string: [61,47] };// TBS

	  /* RuleError */
	  this.rules[12].opcodes = [];
	  this.rules[12].opcodes[0] = { type: 2, children: [1,6] };// CAT
	  this.rules[12].opcodes[1] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[12].opcodes[2] = { type: 1, children: [3,4,5] };// ALT
	  this.rules[12].opcodes[3] = { type: 5, min: 32, max: 126 };// TRG
	  this.rules[12].opcodes[4] = { type: 6, string: [9] };// TBS
	  this.rules[12].opcodes[5] = { type: 4, index: 94 };// RNM(LineContinue)
	  this.rules[12].opcodes[6] = { type: 4, index: 93 };// RNM(LineEnd)

	  /* LineEndError */
	  this.rules[13].opcodes = [];
	  this.rules[13].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[13].opcodes[1] = { type: 1, children: [2,3,4] };// ALT
	  this.rules[13].opcodes[2] = { type: 5, min: 32, max: 126 };// TRG
	  this.rules[13].opcodes[3] = { type: 6, string: [9] };// TBS
	  this.rules[13].opcodes[4] = { type: 4, index: 94 };// RNM(LineContinue)

	  /* Alternation */
	  this.rules[14].opcodes = [];
	  this.rules[14].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[14].opcodes[1] = { type: 4, index: 15 };// RNM(Concatenation)
	  this.rules[14].opcodes[2] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[14].opcodes[3] = { type: 2, children: [4,5,6] };// CAT
	  this.rules[14].opcodes[4] = { type: 4, index: 89 };// RNM(owsp)
	  this.rules[14].opcodes[5] = { type: 4, index: 44 };// RNM(AltOp)
	  this.rules[14].opcodes[6] = { type: 4, index: 15 };// RNM(Concatenation)

	  /* Concatenation */
	  this.rules[15].opcodes = [];
	  this.rules[15].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[15].opcodes[1] = { type: 4, index: 16 };// RNM(Repetition)
	  this.rules[15].opcodes[2] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[15].opcodes[3] = { type: 2, children: [4,5] };// CAT
	  this.rules[15].opcodes[4] = { type: 4, index: 45 };// RNM(CatOp)
	  this.rules[15].opcodes[5] = { type: 4, index: 16 };// RNM(Repetition)

	  /* Repetition */
	  this.rules[16].opcodes = [];
	  this.rules[16].opcodes[0] = { type: 2, children: [1,3] };// CAT
	  this.rules[16].opcodes[1] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[16].opcodes[2] = { type: 4, index: 17 };// RNM(Modifier)
	  this.rules[16].opcodes[3] = { type: 1, children: [4,5,6,7] };// ALT
	  this.rules[16].opcodes[4] = { type: 4, index: 21 };// RNM(Group)
	  this.rules[16].opcodes[5] = { type: 4, index: 25 };// RNM(Option)
	  this.rules[16].opcodes[6] = { type: 4, index: 19 };// RNM(BasicElement)
	  this.rules[16].opcodes[7] = { type: 4, index: 20 };// RNM(BasicElementErr)

	  /* Modifier */
	  this.rules[17].opcodes = [];
	  this.rules[17].opcodes[0] = { type: 1, children: [1,5] };// ALT
	  this.rules[17].opcodes[1] = { type: 2, children: [2,3] };// CAT
	  this.rules[17].opcodes[2] = { type: 4, index: 18 };// RNM(Predicate)
	  this.rules[17].opcodes[3] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[17].opcodes[4] = { type: 4, index: 43 };// RNM(RepOp)
	  this.rules[17].opcodes[5] = { type: 4, index: 43 };// RNM(RepOp)

	  /* Predicate */
	  this.rules[18].opcodes = [];
	  this.rules[18].opcodes[0] = { type: 1, children: [1,2,3,4] };// ALT
	  this.rules[18].opcodes[1] = { type: 4, index: 49 };// RNM(BkaOp)
	  this.rules[18].opcodes[2] = { type: 4, index: 50 };// RNM(BknOp)
	  this.rules[18].opcodes[3] = { type: 4, index: 47 };// RNM(AndOp)
	  this.rules[18].opcodes[4] = { type: 4, index: 48 };// RNM(NotOp)

	  /* BasicElement */
	  this.rules[19].opcodes = [];
	  this.rules[19].opcodes[0] = { type: 1, children: [1,2,3,4,5,6,7,8,9,10] };// ALT
	  this.rules[19].opcodes[1] = { type: 4, index: 40 };// RNM(UdtOp)
	  this.rules[19].opcodes[2] = { type: 4, index: 29 };// RNM(RnmOp)
	  this.rules[19].opcodes[3] = { type: 4, index: 53 };// RNM(TrgOp)
	  this.rules[19].opcodes[4] = { type: 4, index: 54 };// RNM(TbsOp)
	  this.rules[19].opcodes[5] = { type: 4, index: 55 };// RNM(TlsOp)
	  this.rules[19].opcodes[6] = { type: 4, index: 61 };// RNM(ClsOp)
	  this.rules[19].opcodes[7] = { type: 4, index: 30 };// RNM(BkrOp)
	  this.rules[19].opcodes[8] = { type: 4, index: 51 };// RNM(AbgOp)
	  this.rules[19].opcodes[9] = { type: 4, index: 52 };// RNM(AenOp)
	  this.rules[19].opcodes[10] = { type: 4, index: 65 };// RNM(ProsVal)

	  /* BasicElementErr */
	  this.rules[20].opcodes = [];
	  this.rules[20].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[20].opcodes[1] = { type: 1, children: [2,3,4,5] };// ALT
	  this.rules[20].opcodes[2] = { type: 5, min: 33, max: 40 };// TRG
	  this.rules[20].opcodes[3] = { type: 5, min: 42, max: 46 };// TRG
	  this.rules[20].opcodes[4] = { type: 5, min: 48, max: 92 };// TRG
	  this.rules[20].opcodes[5] = { type: 5, min: 94, max: 126 };// TRG

	  /* Group */
	  this.rules[21].opcodes = [];
	  this.rules[21].opcodes[0] = { type: 2, children: [1,2,3] };// CAT
	  this.rules[21].opcodes[1] = { type: 4, index: 23 };// RNM(GroupOpen)
	  this.rules[21].opcodes[2] = { type: 4, index: 14 };// RNM(Alternation)
	  this.rules[21].opcodes[3] = { type: 1, children: [4,5] };// ALT
	  this.rules[21].opcodes[4] = { type: 4, index: 24 };// RNM(GroupClose)
	  this.rules[21].opcodes[5] = { type: 4, index: 22 };// RNM(GroupError)

	  /* GroupError */
	  this.rules[22].opcodes = [];
	  this.rules[22].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[22].opcodes[1] = { type: 1, children: [2,3,4,5] };// ALT
	  this.rules[22].opcodes[2] = { type: 5, min: 33, max: 40 };// TRG
	  this.rules[22].opcodes[3] = { type: 5, min: 42, max: 46 };// TRG
	  this.rules[22].opcodes[4] = { type: 5, min: 48, max: 92 };// TRG
	  this.rules[22].opcodes[5] = { type: 5, min: 94, max: 126 };// TRG

	  /* GroupOpen */
	  this.rules[23].opcodes = [];
	  this.rules[23].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[23].opcodes[1] = { type: 6, string: [40] };// TBS
	  this.rules[23].opcodes[2] = { type: 4, index: 89 };// RNM(owsp)

	  /* GroupClose */
	  this.rules[24].opcodes = [];
	  this.rules[24].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[24].opcodes[1] = { type: 4, index: 89 };// RNM(owsp)
	  this.rules[24].opcodes[2] = { type: 6, string: [41] };// TBS

	  /* Option */
	  this.rules[25].opcodes = [];
	  this.rules[25].opcodes[0] = { type: 2, children: [1,2,3] };// CAT
	  this.rules[25].opcodes[1] = { type: 4, index: 27 };// RNM(OptionOpen)
	  this.rules[25].opcodes[2] = { type: 4, index: 14 };// RNM(Alternation)
	  this.rules[25].opcodes[3] = { type: 1, children: [4,5] };// ALT
	  this.rules[25].opcodes[4] = { type: 4, index: 28 };// RNM(OptionClose)
	  this.rules[25].opcodes[5] = { type: 4, index: 26 };// RNM(OptionError)

	  /* OptionError */
	  this.rules[26].opcodes = [];
	  this.rules[26].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[26].opcodes[1] = { type: 1, children: [2,3,4,5] };// ALT
	  this.rules[26].opcodes[2] = { type: 5, min: 33, max: 40 };// TRG
	  this.rules[26].opcodes[3] = { type: 5, min: 42, max: 46 };// TRG
	  this.rules[26].opcodes[4] = { type: 5, min: 48, max: 92 };// TRG
	  this.rules[26].opcodes[5] = { type: 5, min: 94, max: 126 };// TRG

	  /* OptionOpen */
	  this.rules[27].opcodes = [];
	  this.rules[27].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[27].opcodes[1] = { type: 6, string: [91] };// TBS
	  this.rules[27].opcodes[2] = { type: 4, index: 89 };// RNM(owsp)

	  /* OptionClose */
	  this.rules[28].opcodes = [];
	  this.rules[28].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[28].opcodes[1] = { type: 4, index: 89 };// RNM(owsp)
	  this.rules[28].opcodes[2] = { type: 6, string: [93] };// TBS

	  /* RnmOp */
	  this.rules[29].opcodes = [];
	  this.rules[29].opcodes[0] = { type: 4, index: 88 };// RNM(alphanum)

	  /* BkrOp */
	  this.rules[30].opcodes = [];
	  this.rules[30].opcodes[0] = { type: 2, children: [1,2,4] };// CAT
	  this.rules[30].opcodes[1] = { type: 6, string: [92] };// TBS
	  this.rules[30].opcodes[2] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[30].opcodes[3] = { type: 4, index: 31 };// RNM(bkrModifier)
	  this.rules[30].opcodes[4] = { type: 4, index: 36 };// RNM(bkr-name)

	  /* bkrModifier */
	  this.rules[31].opcodes = [];
	  this.rules[31].opcodes[0] = { type: 1, children: [1,7,13,19] };// ALT
	  this.rules[31].opcodes[1] = { type: 2, children: [2,3] };// CAT
	  this.rules[31].opcodes[2] = { type: 4, index: 32 };// RNM(cs)
	  this.rules[31].opcodes[3] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[31].opcodes[4] = { type: 1, children: [5,6] };// ALT
	  this.rules[31].opcodes[5] = { type: 4, index: 34 };// RNM(um)
	  this.rules[31].opcodes[6] = { type: 4, index: 35 };// RNM(pm)
	  this.rules[31].opcodes[7] = { type: 2, children: [8,9] };// CAT
	  this.rules[31].opcodes[8] = { type: 4, index: 33 };// RNM(ci)
	  this.rules[31].opcodes[9] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[31].opcodes[10] = { type: 1, children: [11,12] };// ALT
	  this.rules[31].opcodes[11] = { type: 4, index: 34 };// RNM(um)
	  this.rules[31].opcodes[12] = { type: 4, index: 35 };// RNM(pm)
	  this.rules[31].opcodes[13] = { type: 2, children: [14,15] };// CAT
	  this.rules[31].opcodes[14] = { type: 4, index: 34 };// RNM(um)
	  this.rules[31].opcodes[15] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[31].opcodes[16] = { type: 1, children: [17,18] };// ALT
	  this.rules[31].opcodes[17] = { type: 4, index: 32 };// RNM(cs)
	  this.rules[31].opcodes[18] = { type: 4, index: 33 };// RNM(ci)
	  this.rules[31].opcodes[19] = { type: 2, children: [20,21] };// CAT
	  this.rules[31].opcodes[20] = { type: 4, index: 35 };// RNM(pm)
	  this.rules[31].opcodes[21] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[31].opcodes[22] = { type: 1, children: [23,24] };// ALT
	  this.rules[31].opcodes[23] = { type: 4, index: 32 };// RNM(cs)
	  this.rules[31].opcodes[24] = { type: 4, index: 33 };// RNM(ci)

	  /* cs */
	  this.rules[32].opcodes = [];
	  this.rules[32].opcodes[0] = { type: 6, string: [37,115] };// TBS

	  /* ci */
	  this.rules[33].opcodes = [];
	  this.rules[33].opcodes[0] = { type: 6, string: [37,105] };// TBS

	  /* um */
	  this.rules[34].opcodes = [];
	  this.rules[34].opcodes[0] = { type: 6, string: [37,117] };// TBS

	  /* pm */
	  this.rules[35].opcodes = [];
	  this.rules[35].opcodes[0] = { type: 6, string: [37,112] };// TBS

	  /* bkr-name */
	  this.rules[36].opcodes = [];
	  this.rules[36].opcodes[0] = { type: 1, children: [1,2,3] };// ALT
	  this.rules[36].opcodes[1] = { type: 4, index: 38 };// RNM(uname)
	  this.rules[36].opcodes[2] = { type: 4, index: 39 };// RNM(ename)
	  this.rules[36].opcodes[3] = { type: 4, index: 37 };// RNM(rname)

	  /* rname */
	  this.rules[37].opcodes = [];
	  this.rules[37].opcodes[0] = { type: 4, index: 88 };// RNM(alphanum)

	  /* uname */
	  this.rules[38].opcodes = [];
	  this.rules[38].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[38].opcodes[1] = { type: 6, string: [117,95] };// TBS
	  this.rules[38].opcodes[2] = { type: 4, index: 88 };// RNM(alphanum)

	  /* ename */
	  this.rules[39].opcodes = [];
	  this.rules[39].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[39].opcodes[1] = { type: 6, string: [101,95] };// TBS
	  this.rules[39].opcodes[2] = { type: 4, index: 88 };// RNM(alphanum)

	  /* UdtOp */
	  this.rules[40].opcodes = [];
	  this.rules[40].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[40].opcodes[1] = { type: 4, index: 42 };// RNM(udt-empty)
	  this.rules[40].opcodes[2] = { type: 4, index: 41 };// RNM(udt-non-empty)

	  /* udt-non-empty */
	  this.rules[41].opcodes = [];
	  this.rules[41].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[41].opcodes[1] = { type: 6, string: [117,95] };// TBS
	  this.rules[41].opcodes[2] = { type: 4, index: 88 };// RNM(alphanum)

	  /* udt-empty */
	  this.rules[42].opcodes = [];
	  this.rules[42].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[42].opcodes[1] = { type: 6, string: [101,95] };// TBS
	  this.rules[42].opcodes[2] = { type: 4, index: 88 };// RNM(alphanum)

	  /* RepOp */
	  this.rules[43].opcodes = [];
	  this.rules[43].opcodes[0] = { type: 1, children: [1,5,8,11,12] };// ALT
	  this.rules[43].opcodes[1] = { type: 2, children: [2,3,4] };// CAT
	  this.rules[43].opcodes[2] = { type: 4, index: 69 };// RNM(rep-min)
	  this.rules[43].opcodes[3] = { type: 4, index: 46 };// RNM(StarOp)
	  this.rules[43].opcodes[4] = { type: 4, index: 71 };// RNM(rep-max)
	  this.rules[43].opcodes[5] = { type: 2, children: [6,7] };// CAT
	  this.rules[43].opcodes[6] = { type: 4, index: 69 };// RNM(rep-min)
	  this.rules[43].opcodes[7] = { type: 4, index: 46 };// RNM(StarOp)
	  this.rules[43].opcodes[8] = { type: 2, children: [9,10] };// CAT
	  this.rules[43].opcodes[9] = { type: 4, index: 46 };// RNM(StarOp)
	  this.rules[43].opcodes[10] = { type: 4, index: 71 };// RNM(rep-max)
	  this.rules[43].opcodes[11] = { type: 4, index: 46 };// RNM(StarOp)
	  this.rules[43].opcodes[12] = { type: 4, index: 70 };// RNM(rep-min-max)

	  /* AltOp */
	  this.rules[44].opcodes = [];
	  this.rules[44].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[44].opcodes[1] = { type: 6, string: [47] };// TBS
	  this.rules[44].opcodes[2] = { type: 4, index: 89 };// RNM(owsp)

	  /* CatOp */
	  this.rules[45].opcodes = [];
	  this.rules[45].opcodes[0] = { type: 4, index: 90 };// RNM(wsp)

	  /* StarOp */
	  this.rules[46].opcodes = [];
	  this.rules[46].opcodes[0] = { type: 6, string: [42] };// TBS

	  /* AndOp */
	  this.rules[47].opcodes = [];
	  this.rules[47].opcodes[0] = { type: 6, string: [38] };// TBS

	  /* NotOp */
	  this.rules[48].opcodes = [];
	  this.rules[48].opcodes[0] = { type: 6, string: [33] };// TBS

	  /* BkaOp */
	  this.rules[49].opcodes = [];
	  this.rules[49].opcodes[0] = { type: 6, string: [38,38] };// TBS

	  /* BknOp */
	  this.rules[50].opcodes = [];
	  this.rules[50].opcodes[0] = { type: 6, string: [33,33] };// TBS

	  /* AbgOp */
	  this.rules[51].opcodes = [];
	  this.rules[51].opcodes[0] = { type: 6, string: [37,94] };// TBS

	  /* AenOp */
	  this.rules[52].opcodes = [];
	  this.rules[52].opcodes[0] = { type: 6, string: [37,36] };// TBS

	  /* TrgOp */
	  this.rules[53].opcodes = [];
	  this.rules[53].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[53].opcodes[1] = { type: 6, string: [37] };// TBS
	  this.rules[53].opcodes[2] = { type: 1, children: [3,8,13] };// ALT
	  this.rules[53].opcodes[3] = { type: 2, children: [4,5,6,7] };// CAT
	  this.rules[53].opcodes[4] = { type: 4, index: 76 };// RNM(Dec)
	  this.rules[53].opcodes[5] = { type: 4, index: 79 };// RNM(dmin)
	  this.rules[53].opcodes[6] = { type: 6, string: [45] };// TBS
	  this.rules[53].opcodes[7] = { type: 4, index: 80 };// RNM(dmax)
	  this.rules[53].opcodes[8] = { type: 2, children: [9,10,11,12] };// CAT
	  this.rules[53].opcodes[9] = { type: 4, index: 77 };// RNM(Hex)
	  this.rules[53].opcodes[10] = { type: 4, index: 83 };// RNM(xmin)
	  this.rules[53].opcodes[11] = { type: 6, string: [45] };// TBS
	  this.rules[53].opcodes[12] = { type: 4, index: 84 };// RNM(xmax)
	  this.rules[53].opcodes[13] = { type: 2, children: [14,15,16,17] };// CAT
	  this.rules[53].opcodes[14] = { type: 4, index: 78 };// RNM(Bin)
	  this.rules[53].opcodes[15] = { type: 4, index: 81 };// RNM(bmin)
	  this.rules[53].opcodes[16] = { type: 6, string: [45] };// TBS
	  this.rules[53].opcodes[17] = { type: 4, index: 82 };// RNM(bmax)

	  /* TbsOp */
	  this.rules[54].opcodes = [];
	  this.rules[54].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[54].opcodes[1] = { type: 6, string: [37] };// TBS
	  this.rules[54].opcodes[2] = { type: 1, children: [3,10,17] };// ALT
	  this.rules[54].opcodes[3] = { type: 2, children: [4,5,6] };// CAT
	  this.rules[54].opcodes[4] = { type: 4, index: 76 };// RNM(Dec)
	  this.rules[54].opcodes[5] = { type: 4, index: 73 };// RNM(dString)
	  this.rules[54].opcodes[6] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[54].opcodes[7] = { type: 2, children: [8,9] };// CAT
	  this.rules[54].opcodes[8] = { type: 6, string: [46] };// TBS
	  this.rules[54].opcodes[9] = { type: 4, index: 73 };// RNM(dString)
	  this.rules[54].opcodes[10] = { type: 2, children: [11,12,13] };// CAT
	  this.rules[54].opcodes[11] = { type: 4, index: 77 };// RNM(Hex)
	  this.rules[54].opcodes[12] = { type: 4, index: 74 };// RNM(xString)
	  this.rules[54].opcodes[13] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[54].opcodes[14] = { type: 2, children: [15,16] };// CAT
	  this.rules[54].opcodes[15] = { type: 6, string: [46] };// TBS
	  this.rules[54].opcodes[16] = { type: 4, index: 74 };// RNM(xString)
	  this.rules[54].opcodes[17] = { type: 2, children: [18,19,20] };// CAT
	  this.rules[54].opcodes[18] = { type: 4, index: 78 };// RNM(Bin)
	  this.rules[54].opcodes[19] = { type: 4, index: 75 };// RNM(bString)
	  this.rules[54].opcodes[20] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[54].opcodes[21] = { type: 2, children: [22,23] };// CAT
	  this.rules[54].opcodes[22] = { type: 6, string: [46] };// TBS
	  this.rules[54].opcodes[23] = { type: 4, index: 75 };// RNM(bString)

	  /* TlsOp */
	  this.rules[55].opcodes = [];
	  this.rules[55].opcodes[0] = { type: 2, children: [1,2,3,4] };// CAT
	  this.rules[55].opcodes[1] = { type: 4, index: 56 };// RNM(TlsCase)
	  this.rules[55].opcodes[2] = { type: 4, index: 57 };// RNM(TlsOpen)
	  this.rules[55].opcodes[3] = { type: 4, index: 59 };// RNM(TlsString)
	  this.rules[55].opcodes[4] = { type: 4, index: 58 };// RNM(TlsClose)

	  /* TlsCase */
	  this.rules[56].opcodes = [];
	  this.rules[56].opcodes[0] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[56].opcodes[1] = { type: 1, children: [2,3] };// ALT
	  this.rules[56].opcodes[2] = { type: 7, string: [37,105] };// TLS
	  this.rules[56].opcodes[3] = { type: 7, string: [37,115] };// TLS

	  /* TlsOpen */
	  this.rules[57].opcodes = [];
	  this.rules[57].opcodes[0] = { type: 6, string: [34] };// TBS

	  /* TlsClose */
	  this.rules[58].opcodes = [];
	  this.rules[58].opcodes[0] = { type: 6, string: [34] };// TBS

	  /* TlsString */
	  this.rules[59].opcodes = [];
	  this.rules[59].opcodes[0] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[59].opcodes[1] = { type: 1, children: [2,3,4] };// ALT
	  this.rules[59].opcodes[2] = { type: 5, min: 32, max: 33 };// TRG
	  this.rules[59].opcodes[3] = { type: 5, min: 35, max: 126 };// TRG
	  this.rules[59].opcodes[4] = { type: 4, index: 60 };// RNM(StringTab)

	  /* StringTab */
	  this.rules[60].opcodes = [];
	  this.rules[60].opcodes[0] = { type: 6, string: [9] };// TBS

	  /* ClsOp */
	  this.rules[61].opcodes = [];
	  this.rules[61].opcodes[0] = { type: 2, children: [1,2,3] };// CAT
	  this.rules[61].opcodes[1] = { type: 4, index: 62 };// RNM(ClsOpen)
	  this.rules[61].opcodes[2] = { type: 4, index: 64 };// RNM(ClsString)
	  this.rules[61].opcodes[3] = { type: 4, index: 63 };// RNM(ClsClose)

	  /* ClsOpen */
	  this.rules[62].opcodes = [];
	  this.rules[62].opcodes[0] = { type: 6, string: [39] };// TBS

	  /* ClsClose */
	  this.rules[63].opcodes = [];
	  this.rules[63].opcodes[0] = { type: 6, string: [39] };// TBS

	  /* ClsString */
	  this.rules[64].opcodes = [];
	  this.rules[64].opcodes[0] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[64].opcodes[1] = { type: 1, children: [2,3,4] };// ALT
	  this.rules[64].opcodes[2] = { type: 5, min: 32, max: 38 };// TRG
	  this.rules[64].opcodes[3] = { type: 5, min: 40, max: 126 };// TRG
	  this.rules[64].opcodes[4] = { type: 4, index: 60 };// RNM(StringTab)

	  /* ProsVal */
	  this.rules[65].opcodes = [];
	  this.rules[65].opcodes[0] = { type: 2, children: [1,2,3] };// CAT
	  this.rules[65].opcodes[1] = { type: 4, index: 66 };// RNM(ProsValOpen)
	  this.rules[65].opcodes[2] = { type: 4, index: 67 };// RNM(ProsValString)
	  this.rules[65].opcodes[3] = { type: 4, index: 68 };// RNM(ProsValClose)

	  /* ProsValOpen */
	  this.rules[66].opcodes = [];
	  this.rules[66].opcodes[0] = { type: 6, string: [60] };// TBS

	  /* ProsValString */
	  this.rules[67].opcodes = [];
	  this.rules[67].opcodes[0] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[67].opcodes[1] = { type: 1, children: [2,3,4] };// ALT
	  this.rules[67].opcodes[2] = { type: 5, min: 32, max: 61 };// TRG
	  this.rules[67].opcodes[3] = { type: 5, min: 63, max: 126 };// TRG
	  this.rules[67].opcodes[4] = { type: 4, index: 60 };// RNM(StringTab)

	  /* ProsValClose */
	  this.rules[68].opcodes = [];
	  this.rules[68].opcodes[0] = { type: 6, string: [62] };// TBS

	  /* rep-min */
	  this.rules[69].opcodes = [];
	  this.rules[69].opcodes[0] = { type: 4, index: 72 };// RNM(rep-num)

	  /* rep-min-max */
	  this.rules[70].opcodes = [];
	  this.rules[70].opcodes[0] = { type: 4, index: 72 };// RNM(rep-num)

	  /* rep-max */
	  this.rules[71].opcodes = [];
	  this.rules[71].opcodes[0] = { type: 4, index: 72 };// RNM(rep-num)

	  /* rep-num */
	  this.rules[72].opcodes = [];
	  this.rules[72].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[72].opcodes[1] = { type: 5, min: 48, max: 57 };// TRG

	  /* dString */
	  this.rules[73].opcodes = [];
	  this.rules[73].opcodes[0] = { type: 4, index: 85 };// RNM(dnum)

	  /* xString */
	  this.rules[74].opcodes = [];
	  this.rules[74].opcodes[0] = { type: 4, index: 87 };// RNM(xnum)

	  /* bString */
	  this.rules[75].opcodes = [];
	  this.rules[75].opcodes[0] = { type: 4, index: 86 };// RNM(bnum)

	  /* Dec */
	  this.rules[76].opcodes = [];
	  this.rules[76].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[76].opcodes[1] = { type: 6, string: [68] };// TBS
	  this.rules[76].opcodes[2] = { type: 6, string: [100] };// TBS

	  /* Hex */
	  this.rules[77].opcodes = [];
	  this.rules[77].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[77].opcodes[1] = { type: 6, string: [88] };// TBS
	  this.rules[77].opcodes[2] = { type: 6, string: [120] };// TBS

	  /* Bin */
	  this.rules[78].opcodes = [];
	  this.rules[78].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[78].opcodes[1] = { type: 6, string: [66] };// TBS
	  this.rules[78].opcodes[2] = { type: 6, string: [98] };// TBS

	  /* dmin */
	  this.rules[79].opcodes = [];
	  this.rules[79].opcodes[0] = { type: 4, index: 85 };// RNM(dnum)

	  /* dmax */
	  this.rules[80].opcodes = [];
	  this.rules[80].opcodes[0] = { type: 4, index: 85 };// RNM(dnum)

	  /* bmin */
	  this.rules[81].opcodes = [];
	  this.rules[81].opcodes[0] = { type: 4, index: 86 };// RNM(bnum)

	  /* bmax */
	  this.rules[82].opcodes = [];
	  this.rules[82].opcodes[0] = { type: 4, index: 86 };// RNM(bnum)

	  /* xmin */
	  this.rules[83].opcodes = [];
	  this.rules[83].opcodes[0] = { type: 4, index: 87 };// RNM(xnum)

	  /* xmax */
	  this.rules[84].opcodes = [];
	  this.rules[84].opcodes[0] = { type: 4, index: 87 };// RNM(xnum)

	  /* dnum */
	  this.rules[85].opcodes = [];
	  this.rules[85].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[85].opcodes[1] = { type: 5, min: 48, max: 57 };// TRG

	  /* bnum */
	  this.rules[86].opcodes = [];
	  this.rules[86].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[86].opcodes[1] = { type: 5, min: 48, max: 49 };// TRG

	  /* xnum */
	  this.rules[87].opcodes = [];
	  this.rules[87].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[87].opcodes[1] = { type: 1, children: [2,3,4] };// ALT
	  this.rules[87].opcodes[2] = { type: 5, min: 48, max: 57 };// TRG
	  this.rules[87].opcodes[3] = { type: 5, min: 65, max: 70 };// TRG
	  this.rules[87].opcodes[4] = { type: 5, min: 97, max: 102 };// TRG

	  /* alphanum */
	  this.rules[88].opcodes = [];
	  this.rules[88].opcodes[0] = { type: 2, children: [1,4] };// CAT
	  this.rules[88].opcodes[1] = { type: 1, children: [2,3] };// ALT
	  this.rules[88].opcodes[2] = { type: 5, min: 97, max: 122 };// TRG
	  this.rules[88].opcodes[3] = { type: 5, min: 65, max: 90 };// TRG
	  this.rules[88].opcodes[4] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[88].opcodes[5] = { type: 1, children: [6,7,8,9] };// ALT
	  this.rules[88].opcodes[6] = { type: 5, min: 97, max: 122 };// TRG
	  this.rules[88].opcodes[7] = { type: 5, min: 65, max: 90 };// TRG
	  this.rules[88].opcodes[8] = { type: 5, min: 48, max: 57 };// TRG
	  this.rules[88].opcodes[9] = { type: 6, string: [45] };// TBS

	  /* owsp */
	  this.rules[89].opcodes = [];
	  this.rules[89].opcodes[0] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[89].opcodes[1] = { type: 4, index: 91 };// RNM(space)

	  /* wsp */
	  this.rules[90].opcodes = [];
	  this.rules[90].opcodes[0] = { type: 3, min: 1, max: Infinity };// REP
	  this.rules[90].opcodes[1] = { type: 4, index: 91 };// RNM(space)

	  /* space */
	  this.rules[91].opcodes = [];
	  this.rules[91].opcodes[0] = { type: 1, children: [1,2,3,4] };// ALT
	  this.rules[91].opcodes[1] = { type: 6, string: [32] };// TBS
	  this.rules[91].opcodes[2] = { type: 6, string: [9] };// TBS
	  this.rules[91].opcodes[3] = { type: 4, index: 92 };// RNM(comment)
	  this.rules[91].opcodes[4] = { type: 4, index: 94 };// RNM(LineContinue)

	  /* comment */
	  this.rules[92].opcodes = [];
	  this.rules[92].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[92].opcodes[1] = { type: 6, string: [59] };// TBS
	  this.rules[92].opcodes[2] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[92].opcodes[3] = { type: 1, children: [4,5] };// ALT
	  this.rules[92].opcodes[4] = { type: 5, min: 32, max: 126 };// TRG
	  this.rules[92].opcodes[5] = { type: 6, string: [9] };// TBS

	  /* LineEnd */
	  this.rules[93].opcodes = [];
	  this.rules[93].opcodes[0] = { type: 1, children: [1,2,3] };// ALT
	  this.rules[93].opcodes[1] = { type: 6, string: [13,10] };// TBS
	  this.rules[93].opcodes[2] = { type: 6, string: [10] };// TBS
	  this.rules[93].opcodes[3] = { type: 6, string: [13] };// TBS

	  /* LineContinue */
	  this.rules[94].opcodes = [];
	  this.rules[94].opcodes[0] = { type: 2, children: [1,5] };// CAT
	  this.rules[94].opcodes[1] = { type: 1, children: [2,3,4] };// ALT
	  this.rules[94].opcodes[2] = { type: 6, string: [13,10] };// TBS
	  this.rules[94].opcodes[3] = { type: 6, string: [10] };// TBS
	  this.rules[94].opcodes[4] = { type: 6, string: [13] };// TBS
	  this.rules[94].opcodes[5] = { type: 1, children: [6,7] };// ALT
	  this.rules[94].opcodes[6] = { type: 6, string: [32] };// TBS
	  this.rules[94].opcodes[7] = { type: 6, string: [9] };// TBS

	  // The `toString()` function will display the original grammar file(s) that produced these opcodes.
	  this.toString = function toString(){
	    let str = "";
	    str += ";\n";
	    str += "; ABNF for JavaScript APG 2.0 SABNF\n";
	    str += "; RFC 5234 with some restrictions and additions.\n";
	    str += "; Updated 11/24/2015 for RFC 7405 case-sensitive literal string notation\n";
	    str += ";  - accepts %s\"string\" as a case-sensitive string\n";
	    str += ";  - accepts %i\"string\" as a case-insensitive string\n";
	    str += ";  - accepts \"string\" as a case-insensitive string\n";
	    str += ";\n";
	    str += "; Some restrictions:\n";
	    str += ";   1. Rules must begin at first character of each line.\n";
	    str += ";      Indentations on first rule and rules thereafter are not allowed.\n";
	    str += ";   2. Relaxed line endings. CRLF, LF or CR are accepted as valid line ending.\n";
	    str += ";   3. Prose values, i.e. <prose value>, are accepted as valid grammar syntax.\n";
	    str += ";      However, a working parser cannot be generated from them.\n";
	    str += ";\n";
	    str += "; Super set (SABNF) additions:\n";
	    str += ";   1. Look-ahead (syntactic predicate) operators are accepted as element prefixes.\n";
	    str += ";      & is the positive look-ahead operator, succeeds and backtracks if the look-ahead phrase is found\n";
	    str += ";      ! is the negative look-ahead operator, succeeds and backtracks if the look-ahead phrase is NOT found\n";
	    str += ";      e.g. &%d13 or &rule or !(A / B)\n";
	    str += ";   2. User-Defined Terminals (UDT) of the form, u_name and e_name are accepted.\n";
	    str += ";      'name' is alpha followed by alpha/num/hyphen just like a rule name.\n";
	    str += ";      u_name may be used as an element but no rule definition is given.\n";
	    str += ";      e.g. rule = A / u_myUdt\n";
	    str += ";           A = \"a\"\n";
	    str += ";      would be a valid grammar.\n";
	    str += ";   3. Case-sensitive, single-quoted strings are accepted.\n";
	    str += ";      e.g. 'abc' would be equivalent to %d97.98.99\n";
	    str += ";      (kept for backward compatibility, but superseded by %s\"abc\")  \n";
	    str += "; New 12/26/2015\n";
	    str += ";   4. Look-behind operators are accepted as element prefixes.\n";
	    str += ";      && is the positive look-behind operator, succeeds and backtracks if the look-behind phrase is found\n";
	    str += ";      !! is the negative look-behind operator, succeeds and backtracks if the look-behind phrase is NOT found\n";
	    str += ";      e.g. &&%d13 or &&rule or !!(A / B)\n";
	    str += ";   5. Back reference operators, i.e. \\rulename, are accepted.\n";
	    str += ";      A back reference operator acts like a TLS or TBS terminal except that the phrase it attempts\n";
	    str += ";      to match is a phrase previously matched by the rule 'rulename'.\n";
	    str += ";      There are two modes of previous phrase matching - the parent-frame mode and the universal mode.\n";
	    str += ";      In universal mode, \\rulename matches the last match to 'rulename' regardless of where it was found.\n";
	    str += ";      In parent-frame mode, \\rulename matches only the last match found on the parent's frame or parse tree level.\n";
	    str += ";      Back reference modifiers can be used to specify case and mode.\n";
	    str += ";      \\A defaults to case-insensitive and universal mode, e.g. \\A === \\%i%uA\n";
	    str += ";      Modifiers %i and %s determine case-insensitive and case-sensitive mode, respectively.\n";
	    str += ";      Modifiers %u and %p determine universal mode and parent frame mode, respectively.\n";
	    str += ";      Case and mode modifiers can appear in any order, e.g. \\%s%pA === \\%p%sA. \n";
	    str += ";   7. String begin anchor, ABG(%^) matches the beginning of the input string location.\n";
	    str += ";      Returns EMPTY or NOMATCH. Never consumes any characters.\n";
	    str += ";   8. String end anchor, AEN(%$) matches the end of the input string location.\n";
	    str += ";      Returns EMPTY or NOMATCH. Never consumes any characters.\n";
	    str += ";\n";
	    str += "File            = *(BlankLine / Rule / RuleError)\n";
	    str += "BlankLine       = *(%d32/%d9) [comment] LineEnd\n";
	    str += "Rule            = RuleLookup owsp Alternation ((owsp LineEnd)\n";
	    str += "                / (LineEndError LineEnd))\n";
	    str += "RuleLookup      = RuleNameTest owsp DefinedAsTest\n";
	    str += "RuleNameTest    = RuleName/RuleNameError\n";
	    str += "RuleName        = alphanum\n";
	    str += "RuleNameError   = 1*(%d33-60/%d62-126)\n";
	    str += "DefinedAsTest   = DefinedAs / DefinedAsError\n";
	    str += "DefinedAsError  = 1*2%d33-126\n";
	    str += "DefinedAs       = IncAlt / Defined\n";
	    str += "Defined         = %d61\n";
	    str += "IncAlt          = %d61.47\n";
	    str += "RuleError       = 1*(%d32-126 / %d9  / LineContinue) LineEnd\n";
	    str += "LineEndError    = 1*(%d32-126 / %d9  / LineContinue)\n";
	    str += "Alternation     = Concatenation *(owsp AltOp Concatenation)\n";
	    str += "Concatenation   = Repetition *(CatOp Repetition)\n";
	    str += "Repetition      = [Modifier] (Group / Option / BasicElement / BasicElementErr)\n";
	    str += "Modifier        = (Predicate [RepOp])\n";
	    str += "                / RepOp\n";
	    str += "Predicate       = BkaOp\n";
	    str += "                / BknOp\n";
	    str += "                / AndOp\n";
	    str += "                / NotOp\n";
	    str += "BasicElement    = UdtOp\n";
	    str += "                / RnmOp\n";
	    str += "                / TrgOp\n";
	    str += "                / TbsOp\n";
	    str += "                / TlsOp\n";
	    str += "                / ClsOp\n";
	    str += "                / BkrOp\n";
	    str += "                / AbgOp\n";
	    str += "                / AenOp\n";
	    str += "                / ProsVal\n";
	    str += "BasicElementErr = 1*(%d33-40/%d42-46/%d48-92/%d94-126)\n";
	    str += "Group           = GroupOpen  Alternation (GroupClose / GroupError)\n";
	    str += "GroupError      = 1*(%d33-40/%d42-46/%d48-92/%d94-126) ; same as BasicElementErr\n";
	    str += "GroupOpen       = %d40 owsp\n";
	    str += "GroupClose      = owsp %d41\n";
	    str += "Option          = OptionOpen Alternation (OptionClose / OptionError)\n";
	    str += "OptionError     = 1*(%d33-40/%d42-46/%d48-92/%d94-126) ; same as BasicElementErr\n";
	    str += "OptionOpen      = %d91 owsp\n";
	    str += "OptionClose     = owsp %d93\n";
	    str += "RnmOp           = alphanum\n";
	    str += "BkrOp           = %d92 [bkrModifier] bkr-name\n";
	    str += "bkrModifier     = (cs [um / pm]) / (ci [um / pm]) / (um [cs /ci]) / (pm [cs / ci])\n";
	    str += "cs              = '%s'\n";
	    str += "ci              = '%i'\n";
	    str += "um              = '%u'\n";
	    str += "pm              = '%p'\n";
	    str += "bkr-name        = uname / ename / rname\n";
	    str += "rname           = alphanum\n";
	    str += "uname           = %d117.95 alphanum\n";
	    str += "ename           = %d101.95 alphanum\n";
	    str += "UdtOp           = udt-empty\n";
	    str += "                / udt-non-empty\n";
	    str += "udt-non-empty   = %d117.95 alphanum\n";
	    str += "udt-empty       = %d101.95 alphanum\n";
	    str += "RepOp           = (rep-min StarOp rep-max)\n";
	    str += "                / (rep-min StarOp)\n";
	    str += "                / (StarOp rep-max)\n";
	    str += "                / StarOp\n";
	    str += "                / rep-min-max\n";
	    str += "AltOp           = %d47 owsp\n";
	    str += "CatOp           = wsp\n";
	    str += "StarOp          = %d42\n";
	    str += "AndOp           = %d38\n";
	    str += "NotOp           = %d33\n";
	    str += "BkaOp           = %d38.38\n";
	    str += "BknOp           = %d33.33\n";
	    str += "AbgOp           = %d37.94\n";
	    str += "AenOp           = %d37.36\n";
	    str += "TrgOp           = %d37 ((Dec dmin %d45 dmax) / (Hex xmin %d45 xmax) / (Bin bmin %d45 bmax))\n";
	    str += "TbsOp           = %d37 ((Dec dString *(%d46 dString)) / (Hex xString *(%d46 xString)) / (Bin bString *(%d46 bString)))\n";
	    str += "TlsOp           = TlsCase TlsOpen TlsString TlsClose\n";
	    str += "TlsCase         = [\"%i\" / \"%s\"]\n";
	    str += "TlsOpen         = %d34\n";
	    str += "TlsClose        = %d34\n";
	    str += "TlsString       = *(%d32-33/%d35-126/StringTab)\n";
	    str += "StringTab       = %d9\n";
	    str += "ClsOp           = ClsOpen ClsString ClsClose\n";
	    str += "ClsOpen         = %d39\n";
	    str += "ClsClose        = %d39\n";
	    str += "ClsString       = *(%d32-38/%d40-126/StringTab)\n";
	    str += "ProsVal         = ProsValOpen ProsValString ProsValClose\n";
	    str += "ProsValOpen     = %d60\n";
	    str += "ProsValString   = *(%d32-61/%d63-126/StringTab)\n";
	    str += "ProsValClose    = %d62\n";
	    str += "rep-min         = rep-num\n";
	    str += "rep-min-max     = rep-num\n";
	    str += "rep-max         = rep-num\n";
	    str += "rep-num         = 1*(%d48-57)\n";
	    str += "dString         = dnum\n";
	    str += "xString         = xnum\n";
	    str += "bString         = bnum\n";
	    str += "Dec             = (%d68/%d100)\n";
	    str += "Hex             = (%d88/%d120)\n";
	    str += "Bin             = (%d66/%d98)\n";
	    str += "dmin            = dnum\n";
	    str += "dmax            = dnum\n";
	    str += "bmin            = bnum\n";
	    str += "bmax            = bnum\n";
	    str += "xmin            = xnum\n";
	    str += "xmax            = xnum\n";
	    str += "dnum            = 1*(%d48-57)\n";
	    str += "bnum            = 1*%d48-49\n";
	    str += "xnum            = 1*(%d48-57 / %d65-70 / %d97-102)\n";
	    str += ";\n";
	    str += "; Basics\n";
	    str += "alphanum        = (%d97-122/%d65-90) *(%d97-122/%d65-90/%d48-57/%d45)\n";
	    str += "owsp            = *space\n";
	    str += "wsp             = 1*space\n";
	    str += "space           = %d32\n";
	    str += "                / %d9\n";
	    str += "                / comment\n";
	    str += "                / LineContinue\n";
	    str += "comment         = %d59 *(%d32-126 / %d9)\n";
	    str += "LineEnd         = %d13.10\n";
	    str += "                / %d10\n";
	    str += "                / %d13\n";
	    str += "LineContinue    = (%d13.10 / %d10 / %d13) (%d32 / %d9)\n";
	    return str;
	  };
	};
	return sabnfGrammar;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var parser;
var hasRequiredParser;

function requireParser () {
	if (hasRequiredParser) return parser;
	hasRequiredParser = 1;
	// This module converts an input SABNF grammar text file into a
	// grammar object that can be used with `apg-lib` in an application parser.
	// **apg** is, in fact itself, an ABNF parser that generates an SABNF parser.
	// It is based on the grammar<br>
	// `./dist/abnf-for-sabnf-grammar.bnf`.<br>
	// In its syntax phase, **apg** analyzes the user's input SABNF grammar for correct syntax, generating an AST as it goes.
	// In its semantic phase, **apg** translates the AST to generate the parser for the input grammar.
	parser = function exportParser() {
	  const thisFileName = 'parser: ';
	  const ApgLib = requireNodeExports$1();
	  const id = ApgLib.ids;
	  const syn = new (requireSyntaxCallbacks())();
	  const sem = new (requireSemanticCallbacks())();
	  const sabnfGrammar = new (requireSabnfGrammar())();
	  // eslint-disable-next-line new-cap
	  const parser = new ApgLib.parser();
	  // eslint-disable-next-line new-cap
	  parser.ast = new ApgLib.ast();
	  parser.callbacks = syn.callbacks;
	  parser.ast.callbacks = sem.callbacks;

	  /* find the line containing the given character index */
	  const findLine = function findLine(lines, charIndex, charLength) {
	    if (charIndex < 0 || charIndex >= charLength) {
	      /* return error if out of range */
	      return -1;
	    }
	    for (let i = 0; i < lines.length; i += 1) {
	      if (charIndex >= lines[i].beginChar && charIndex < lines[i].beginChar + lines[i].length) {
	        return i;
	      }
	    }
	    /* should never reach here */
	    return -1;
	  };
	  const translateIndex = function translateIndex(map, index) {
	    let ret = -1;
	    if (index < map.length) {
	      for (let i = index; i < map.length; i += 1) {
	        if (map[i] !== null) {
	          ret = map[i];
	          break;
	        }
	      }
	    }
	    return ret;
	  };
	  /* helper function when removing redundant opcodes */
	  const reduceOpcodes = function reduceOpcodes(rules) {
	    rules.forEach((rule) => {
	      const opcodes = [];
	      const map = [];
	      let reducedIndex = 0;
	      rule.opcodes.forEach((op) => {
	        if (op.type === id.ALT && op.children.length === 1) {
	          map.push(null);
	        } else if (op.type === id.CAT && op.children.length === 1) {
	          map.push(null);
	        } else if (op.type === id.REP && op.min === 1 && op.max === 1) {
	          map.push(null);
	        } else {
	          map.push(reducedIndex);
	          opcodes.push(op);
	          reducedIndex += 1;
	        }
	      });
	      map.push(reducedIndex);
	      /* translate original opcode indexes to the reduced set. */
	      opcodes.forEach((op) => {
	        if (op.type === id.ALT || op.type === id.CAT) {
	          for (let i = 0; i < op.children.length; i += 1) {
	            op.children[i] = translateIndex(map, op.children[i]);
	          }
	        }
	      });
	      rule.opcodes = opcodes;
	    });
	  };
	  /* Parse the grammar - the syntax phase. */
	  /* SABNF grammar syntax errors are caught and reported here. */
	  this.syntax = function syntax(chars, lines, errors, strict, lite, trace) {
	    if (trace) {
	      if (trace.traceObject !== 'traceObject') {
	        throw new TypeError(`${thisFileName}trace argument is not a trace object`);
	      }
	      parser.trace = trace;
	    }
	    const data = {};
	    data.errors = errors;
	    data.strict = !!strict;
	    data.lite = !!lite;
	    data.lines = lines;
	    data.findLine = findLine;
	    data.charsLength = chars.length;
	    data.ruleCount = 0;
	    const result = parser.parse(sabnfGrammar, 'file', chars, data);
	    if (!result.success) {
	      errors.push({
	        line: 0,
	        char: 0,
	        msg: 'syntax analysis of input grammar failed',
	      });
	    }
	  };
	  /* Parse the grammar - the semantic phase, translates the AST. */
	  /* SABNF grammar syntax errors are caught and reported here. */
	  this.semantic = function semantic(chars, lines, errors) {
	    const data = {};
	    data.errors = errors;
	    data.lines = lines;
	    data.findLine = findLine;
	    data.charsLength = chars.length;
	    parser.ast.translate(data);
	    if (errors.length) {
	      return null;
	    }
	    /* Remove unneeded operators. */
	    /* ALT operators with a single alternate */
	    /* CAT operators with a single phrase to concatenate */
	    /* REP(1,1) operators (`1*1RuleName` or `1RuleName` is the same as just `RuleName`.) */
	    reduceOpcodes(data.rules);
	    return {
	      rules: data.rules,
	      udts: data.udts,
	      lineMap: data.rulesLineMap,
	    };
	  };
	  // Generate a grammar constructor function.
	  // An object instantiated from this constructor is used with the `apg-lib` `parser()` function.
	  this.generateSource = function generateSource(chars, lines, rules, udts, config) {
	    let source = '';
	    let typescript = false;
	    let lite = false;
	    // config may have multiple grammar object type options in which case
	    // --typescript > --lite  > no options
	    if (config) {
	      if (config.typescript) {
	        typescript = true;
	        lite = false;
	      } else if (config.lite) {
	        typescript = false;
	        lite = true;
	      }
	    }
	    let i;
	    let bkrname;
	    let bkrlower;
	    let opcodeCount = 0;
	    let charCodeMin = Infinity;
	    let charCodeMax = 0;
	    const ruleNames = [];
	    const udtNames = [];
	    let alt = 0;
	    let cat = 0;
	    let rnm = 0;
	    let udt = 0;
	    let rep = 0;
	    let and = 0;
	    let not = 0;
	    let tls = 0;
	    let tbs = 0;
	    let trg = 0;
	    let bkr = 0;
	    let bka = 0;
	    let bkn = 0;
	    let abg = 0;
	    let aen = 0;
	    rules.forEach((rule) => {
	      ruleNames.push(rule.lower);
	      opcodeCount += rule.opcodes.length;
	      rule.opcodes.forEach((op) => {
	        switch (op.type) {
	          case id.ALT:
	            alt += 1;
	            break;
	          case id.CAT:
	            cat += 1;
	            break;
	          case id.RNM:
	            rnm += 1;
	            break;
	          case id.UDT:
	            udt += 1;
	            break;
	          case id.REP:
	            rep += 1;
	            break;
	          case id.AND:
	            and += 1;
	            break;
	          case id.NOT:
	            not += 1;
	            break;
	          case id.BKA:
	            bka += 1;
	            break;
	          case id.BKN:
	            bkn += 1;
	            break;
	          case id.BKR:
	            bkr += 1;
	            break;
	          case id.ABG:
	            abg += 1;
	            break;
	          case id.AEN:
	            aen += 1;
	            break;
	          case id.TLS:
	            tls += 1;
	            for (i = 0; i < op.string.length; i += 1) {
	              if (op.string[i] < charCodeMin) {
	                charCodeMin = op.string[i];
	              }
	              if (op.string[i] > charCodeMax) {
	                charCodeMax = op.string[i];
	              }
	            }
	            break;
	          case id.TBS:
	            tbs += 1;
	            for (i = 0; i < op.string.length; i += 1) {
	              if (op.string[i] < charCodeMin) {
	                charCodeMin = op.string[i];
	              }
	              if (op.string[i] > charCodeMax) {
	                charCodeMax = op.string[i];
	              }
	            }
	            break;
	          case id.TRG:
	            trg += 1;
	            if (op.min < charCodeMin) {
	              charCodeMin = op.min;
	            }
	            if (op.max > charCodeMax) {
	              charCodeMax = op.max;
	            }
	            break;
	          default:
	            throw new Error('generateSource: unrecognized opcode');
	        }
	      });
	    });
	    ruleNames.sort();
	    if (udts.length > 0) {
	      udts.forEach((udtFunc) => {
	        udtNames.push(udtFunc.lower);
	      });
	      udtNames.sort();
	    }
	    source += '// copyright: Copyright (c) 2024 Lowell D. Thomas, all rights reserved<br>\n';
	    source += '//   license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)<br>\n';
	    source += '//\n';
	    source += '// Generated by apg-js, Version 4.4.0 [apg-js](https://github.com/ldthomas/apg-js)\n';
	    if (config) {
	      if (config.funcName) {
	        source += `const ${config.funcName} = function grammar(){\n`;
	      } else if (typescript) {
	        source += 'export function grammar(){\n';
	      } else if (lite) {
	        source += 'export default function grammar(){\n';
	      } else {
	        source += `module.exports = function grammar(){\n`;
	      }
	    } else {
	      source += `module.exports = function grammar(){\n`;
	    }
	    source += '  // ```\n';
	    source += '  // SUMMARY\n';
	    source += `  //      rules = ${rules.length}\n`;
	    source += `  //       udts = ${udts.length}\n`;
	    source += `  //    opcodes = ${opcodeCount}\n`;
	    source += '  //        ---   ABNF original opcodes\n';
	    source += `  //        ALT = ${alt}\n`;
	    source += `  //        CAT = ${cat}\n`;
	    source += `  //        REP = ${rep}\n`;
	    source += `  //        RNM = ${rnm}\n`;
	    source += `  //        TLS = ${tls}\n`;
	    source += `  //        TBS = ${tbs}\n`;
	    source += `  //        TRG = ${trg}\n`;
	    source += '  //        ---   SABNF superset opcodes\n';
	    source += `  //        UDT = ${udt}\n`;
	    source += `  //        AND = ${and}\n`;
	    source += `  //        NOT = ${not}\n`;
	    if (!lite) {
	      source += `  //        BKA = ${bka}\n`;
	      source += `  //        BKN = ${bkn}\n`;
	      source += `  //        BKR = ${bkr}\n`;
	      source += `  //        ABG = ${abg}\n`;
	      source += `  //        AEN = ${aen}\n`;
	    }
	    source += '  // characters = [';
	    if (tls + tbs + trg === 0) {
	      source += ' none defined ]';
	    } else {
	      source += `${charCodeMin} - ${charCodeMax}]`;
	    }
	    if (udt > 0) {
	      source += ' + user defined';
	    }
	    source += '\n';
	    source += '  // ```\n';
	    source += '  /* OBJECT IDENTIFIER (for internal parser use) */\n';
	    source += "  this.grammarObject = 'grammarObject';\n";
	    source += '\n';
	    source += '  /* RULES */\n';
	    source += '  this.rules = [];\n';
	    rules.forEach((rule, ii) => {
	      let thisRule = '  this.rules[';
	      thisRule += ii;
	      thisRule += "] = { name: '";
	      thisRule += rule.name;
	      thisRule += "', lower: '";
	      thisRule += rule.lower;
	      thisRule += "', index: ";
	      thisRule += rule.index;
	      thisRule += ', isBkr: ';
	      thisRule += rule.isBkr;
	      thisRule += ' };\n';
	      source += thisRule;
	    });
	    source += '\n';
	    source += '  /* UDTS */\n';
	    source += '  this.udts = [];\n';
	    if (udts.length > 0) {
	      udts.forEach((udtFunc, ii) => {
	        let thisUdt = '  this.udts[';
	        thisUdt += ii;
	        thisUdt += "] = { name: '";
	        thisUdt += udtFunc.name;
	        thisUdt += "', lower: '";
	        thisUdt += udtFunc.lower;
	        thisUdt += "', index: ";
	        thisUdt += udtFunc.index;
	        thisUdt += ', empty: ';
	        thisUdt += udtFunc.empty;
	        thisUdt += ', isBkr: ';
	        thisUdt += udtFunc.isBkr;
	        thisUdt += ' };\n';
	        source += thisUdt;
	      });
	    }
	    source += '\n';
	    source += '  /* OPCODES */\n';
	    rules.forEach((rule, ruleIndex) => {
	      if (ruleIndex > 0) {
	        source += '\n';
	      }
	      source += `  /* ${rule.name} */\n`;
	      source += `  this.rules[${ruleIndex}].opcodes = [];\n`;
	      rule.opcodes.forEach((op, opIndex) => {
	        let prefix;
	        switch (op.type) {
	          case id.ALT:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
	              op.type
	            }, children: [${op.children.toString()}] };// ALT\n`;
	            break;
	          case id.CAT:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
	              op.type
	            }, children: [${op.children.toString()}] };// CAT\n`;
	            break;
	          case id.RNM:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, index: ${
	              op.index
	            } };// RNM(${rules[op.index].name})\n`;
	            break;
	          case id.BKR:
	            if (op.index >= rules.length) {
	              bkrname = udts[op.index - rules.length].name;
	              bkrlower = udts[op.index - rules.length].lower;
	            } else {
	              bkrname = rules[op.index].name;
	              bkrlower = rules[op.index].lower;
	            }
	            prefix = '%i';
	            if (op.bkrCase === id.BKR_MODE_CS) {
	              prefix = '%s';
	            }
	            if (op.bkrMode === id.BKR_MODE_UM) {
	              prefix += '%u';
	            } else {
	              prefix += '%p';
	            }
	            bkrname = prefix + bkrname;
	            source +=
	              `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, index: ${op.index}, lower: '${bkrlower}'` +
	              `, bkrCase: ${op.bkrCase}, bkrMode: ${op.bkrMode} };// BKR(\\${bkrname})\n`;
	            break;
	          case id.UDT:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, empty: ${
	              op.empty
	            }, index: ${op.index} };// UDT(${udts[op.index].name})\n`;
	            break;
	          case id.REP:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, min: ${op.min}, max: ${op.max} };// REP\n`;
	            break;
	          case id.AND:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type} };// AND\n`;
	            break;
	          case id.NOT:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type} };// NOT\n`;
	            break;
	          case id.ABG:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type} };// ABG(%^)\n`;
	            break;
	          case id.AEN:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type} };// AEN(%$)\n`;
	            break;
	          case id.BKA:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type} };// BKA\n`;
	            break;
	          case id.BKN:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type} };// BKN\n`;
	            break;
	          case id.TLS:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
	              op.type
	            }, string: [${op.string.toString()}] };// TLS\n`;
	            break;
	          case id.TBS:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
	              op.type
	            }, string: [${op.string.toString()}] };// TBS\n`;
	            break;
	          case id.TRG:
	            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, min: ${op.min}, max: ${op.max} };// TRG\n`;
	            break;
	          default:
	            throw new Error('parser.js: ~143: unrecognized opcode');
	        }
	      });
	    });
	    source += '\n';
	    source += '  // The `toString()` function will display the original grammar file(s) that produced these opcodes.\n';
	    source += '  this.toString = function toString(){\n';
	    source += '    let str = "";\n';
	    let str;
	    lines.forEach((line) => {
	      const end = line.beginChar + line.length;
	      str = '';
	      source += '    str += "';
	      for (let ii = line.beginChar; ii < end; ii += 1) {
	        switch (chars[ii]) {
	          case 9:
	            str = ' ';
	            break;
	          case 10:
	            str = '\\n';
	            break;
	          case 13:
	            str = '\\r';
	            break;
	          case 34:
	            str = '\\"';
	            break;
	          case 92:
	            str = '\\\\';
	            break;
	          default:
	            str = String.fromCharCode(chars[ii]);
	            break;
	        }
	        source += str;
	      }
	      source += '";\n';
	    });
	    source += '    return str;\n';
	    source += '  }\n';
	    source += '}\n';
	    return source;
	  };
	  // Generate a grammar file object.
	  // Returns the same object as instantiating the constructor function returned by<br>
	  // `this.generateSource()`.<br>
	  this.generateObject = function generateObject(stringArg, rules, udts) {
	    const obj = {};
	    const ruleNames = [];
	    const udtNames = [];
	    const string = stringArg.slice(0);
	    obj.grammarObject = 'grammarObject';
	    rules.forEach((rule) => {
	      ruleNames.push(rule.lower);
	    });
	    ruleNames.sort();
	    if (udts.length > 0) {
	      udts.forEach((udtFunc) => {
	        udtNames.push(udtFunc.lower);
	      });
	      udtNames.sort();
	    }
	    obj.callbacks = [];
	    ruleNames.forEach((name) => {
	      obj.callbacks[name] = false;
	    });
	    if (udts.length > 0) {
	      udtNames.forEach((name) => {
	        obj.callbacks[name] = false;
	      });
	    }
	    obj.rules = rules;
	    obj.udts = udts;
	    obj.toString = function toStringFunc() {
	      return string;
	    };
	    return obj;
	  };
	};
	return parser;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var ruleAttributes;
var hasRequiredRuleAttributes;

function requireRuleAttributes () {
	if (hasRequiredRuleAttributes) return ruleAttributes;
	hasRequiredRuleAttributes = 1;
	// This module does the heavy lifting for attribute generation.
	ruleAttributes = (function exportRuleAttributes() {
	  const id = requireIdentifiers();
	  const thisFile = 'rule-attributes.js';
	  let state = null;
	  function isEmptyOnly(attr) {
	    if (attr.left || attr.nested || attr.right || attr.cyclic) {
	      return false;
	    }
	    return attr.empty;
	  }
	  function isRecursive(attr) {
	    if (attr.left || attr.nested || attr.right || attr.cyclic) {
	      return true;
	    }
	    return false;
	  }
	  function isCatNested(attrs, count) {
	    let i = 0;
	    let j = 0;
	    let k = 0;
	    /* 1. if any child is nested, CAT is nested */
	    for (i = 0; i < count; i += 1) {
	      if (attrs[i].nested) {
	        return true;
	      }
	    }
	    /* 2.) the left-most right recursive child
	               is followed by at least one non-empty child */
	    for (i = 0; i < count; i += 1) {
	      if (attrs[i].right && !attrs[i].leaf) {
	        for (j = i + 1; j < count; j += 1) {
	          if (!isEmptyOnly(attrs[j])) {
	            return true;
	          }
	        }
	      }
	    }
	    /* 3.) the right-most left recursive child
	               is preceded by at least one non-empty child */
	    for (i = count - 1; i >= 0; i -= 1) {
	      if (attrs[i].left && !attrs[i].leaf) {
	        for (j = i - 1; j >= 0; j -= 1) {
	          if (!isEmptyOnly(attrs[j])) {
	            return true;
	          }
	        }
	      }
	    }
	    /* 4. there is at lease one recursive child between
	              the left-most and right-most non-recursive, non-empty children */
	    for (i = 0; i < count; i += 1) {
	      if (!attrs[i].empty && !isRecursive(attrs[i])) {
	        for (j = i + 1; j < count; j += 1) {
	          if (isRecursive(attrs[j])) {
	            for (k = j + 1; k < count; k += 1) {
	              if (!attrs[k].empty && !isRecursive(attrs[k])) {
	                return true;
	              }
	            }
	          }
	        }
	      }
	    }

	    /* none of the above */
	    return false;
	  }
	  function isCatCyclic(attrs, count) {
	    /* if all children are cyclic, CAT is cyclic */
	    for (let i = 0; i < count; i += 1) {
	      if (!attrs[i].cyclic) {
	        return false;
	      }
	    }
	    return true;
	  }
	  function isCatLeft(attrs, count) {
	    /* if the left-most non-empty is left, CAT is left */
	    for (let i = 0; i < count; i += 1) {
	      if (attrs[i].left) {
	        return true;
	      }
	      if (!attrs[i].empty) {
	        return false;
	      }
	      /* keep looking */
	    }
	    return false; /* all left-most are empty */
	  }
	  function isCatRight(attrs, count) {
	    /* if the right-most non-empty is right, CAT is right */
	    for (let i = count - 1; i >= 0; i -= 1) {
	      if (attrs[i].right) {
	        return true;
	      }
	      if (!attrs[i].empty) {
	        return false;
	      }
	      /* keep looking */
	    }
	    return false;
	  }
	  function isCatEmpty(attrs, count) {
	    /* if all children are empty, CAT is empty */
	    for (let i = 0; i < count; i += 1) {
	      if (!attrs[i].empty) {
	        return false;
	      }
	    }
	    return true;
	  }
	  function isCatFinite(attrs, count) {
	    /* if all children are finite, CAT is finite */
	    for (let i = 0; i < count; i += 1) {
	      if (!attrs[i].finite) {
	        return false;
	      }
	    }
	    return true;
	  }
	  function cat(stateArg, opcodes, opIndex, iAttr) {
	    let i = 0;
	    const opCat = opcodes[opIndex];
	    const count = opCat.children.length;

	    /* generate an empty array of child attributes */
	    const childAttrs = [];
	    for (i = 0; i < count; i += 1) {
	      childAttrs.push(stateArg.attrGen());
	    }
	    for (i = 0; i < count; i += 1) {
	      // eslint-disable-next-line no-use-before-define
	      opEval(stateArg, opcodes, opCat.children[i], childAttrs[i]);
	    }
	    iAttr.left = isCatLeft(childAttrs, count);
	    iAttr.right = isCatRight(childAttrs, count);
	    iAttr.nested = isCatNested(childAttrs, count);
	    iAttr.empty = isCatEmpty(childAttrs, count);
	    iAttr.finite = isCatFinite(childAttrs, count);
	    iAttr.cyclic = isCatCyclic(childAttrs, count);
	  }
	  function alt(stateArg, opcodes, opIndex, iAttr) {
	    let i = 0;
	    const opAlt = opcodes[opIndex];
	    const count = opAlt.children.length;

	    /* generate an empty array of child attributes */
	    const childAttrs = [];
	    for (i = 0; i < count; i += 1) {
	      childAttrs.push(stateArg.attrGen());
	    }
	    for (i = 0; i < count; i += 1) {
	      // eslint-disable-next-line no-use-before-define
	      opEval(stateArg, opcodes, opAlt.children[i], childAttrs[i]);
	    }

	    /* if any child attribute is true, ALT is true */
	    iAttr.left = false;
	    iAttr.right = false;
	    iAttr.nested = false;
	    iAttr.empty = false;
	    iAttr.finite = false;
	    iAttr.cyclic = false;
	    for (i = 0; i < count; i += 1) {
	      if (childAttrs[i].left) {
	        iAttr.left = true;
	      }
	      if (childAttrs[i].nested) {
	        iAttr.nested = true;
	      }
	      if (childAttrs[i].right) {
	        iAttr.right = true;
	      }
	      if (childAttrs[i].empty) {
	        iAttr.empty = true;
	      }
	      if (childAttrs[i].finite) {
	        iAttr.finite = true;
	      }
	      if (childAttrs[i].cyclic) {
	        iAttr.cyclic = true;
	      }
	    }
	  }
	  function bkr(stateArg, opcodes, opIndex, iAttr) {
	    const opBkr = opcodes[opIndex];
	    if (opBkr.index >= stateArg.ruleCount) {
	      /* use UDT values */
	      iAttr.empty = stateArg.udts[opBkr.index - stateArg.ruleCount].empty;
	      iAttr.finite = true;
	    } else {
	      /* use the empty and finite values from the back referenced rule */
	      // eslint-disable-next-line no-use-before-define
	      ruleAttrsEval(stateArg, opBkr.index, iAttr);

	      /* however, this is a terminal node like TLS */
	      iAttr.left = false;
	      iAttr.nested = false;
	      iAttr.right = false;
	      iAttr.cyclic = false;
	    }
	  }

	  function opEval(stateArg, opcodes, opIndex, iAttr) {
	    stateArg.attrInit(iAttr);
	    const opi = opcodes[opIndex];
	    switch (opi.type) {
	      case id.ALT:
	        alt(stateArg, opcodes, opIndex, iAttr);
	        break;
	      case id.CAT:
	        cat(stateArg, opcodes, opIndex, iAttr);
	        break;
	      case id.REP:
	        opEval(stateArg, opcodes, opIndex + 1, iAttr);
	        if (opi.min === 0) {
	          iAttr.empty = true;
	          iAttr.finite = true;
	        }
	        break;
	      case id.RNM:
	        // eslint-disable-next-line no-use-before-define
	        ruleAttrsEval(stateArg, opcodes[opIndex].index, iAttr);
	        break;
	      case id.BKR:
	        bkr(stateArg, opcodes, opIndex, iAttr);
	        break;
	      case id.AND:
	      case id.NOT:
	      case id.BKA:
	      case id.BKN:
	        opEval(stateArg, opcodes, opIndex + 1, iAttr);
	        iAttr.empty = true;
	        break;
	      case id.TLS:
	        iAttr.empty = !opcodes[opIndex].string.length;
	        iAttr.finite = true;
	        iAttr.cyclic = false;
	        break;
	      case id.TBS:
	      case id.TRG:
	        iAttr.empty = false;
	        iAttr.finite = true;
	        iAttr.cyclic = false;
	        break;
	      case id.UDT:
	        iAttr.empty = opi.empty;
	        iAttr.finite = true;
	        iAttr.cyclic = false;
	        break;
	      case id.ABG:
	      case id.AEN:
	        iAttr.empty = true;
	        iAttr.finite = true;
	        iAttr.cyclic = false;
	        break;
	      default:
	        throw new Error(`unknown opcode type: ${opi}`);
	    }
	  }
	  // The main logic for handling rules that:
	  //  - have already be evaluated
	  //  - have not been evaluated and is the first occurrence on this branch
	  //  - second occurrence on this branch for the start rule
	  //  - second occurrence on this branch for non-start rules
	  function ruleAttrsEval(stateArg, ruleIndex, iAttr) {
	    const attri = stateArg.attrsWorking[ruleIndex];
	    if (attri.isComplete) {
	      /* just use the completed values */
	      stateArg.attrCopy(iAttr, attri);
	    } else if (!attri.isOpen) {
	      /* open the rule and traverse it */
	      attri.isOpen = true;
	      opEval(stateArg, attri.rule.opcodes, 0, iAttr);
	      /* complete this rule's attributes */
	      attri.left = iAttr.left;
	      attri.right = iAttr.right;
	      attri.nested = iAttr.nested;
	      attri.empty = iAttr.empty;
	      attri.finite = iAttr.finite;
	      attri.cyclic = iAttr.cyclic;
	      attri.leaf = false;
	      attri.isOpen = false;
	      attri.isComplete = true;
	    } else if (ruleIndex === stateArg.startRule) {
	      /* use recursive leaf values */
	      if (ruleIndex === stateArg.startRule) {
	        iAttr.left = true;
	        iAttr.right = true;
	        iAttr.cyclic = true;
	        iAttr.leaf = true;
	      }
	    } else {
	      /* non-start rule terminal leaf */
	      iAttr.finite = true;
	    }
	  }
	  // The main driver for the attribute generation.
	  const ruleAttributes = (stateArg) => {
	    state = stateArg;
	    let i = 0;
	    let j = 0;
	    const iAttr = state.attrGen();
	    for (i = 0; i < state.ruleCount; i += 1) {
	      /* initialize working attributes */
	      for (j = 0; j < state.ruleCount; j += 1) {
	        state.attrInit(state.attrsWorking[j]);
	      }
	      state.startRule = i;
	      ruleAttrsEval(state, i, iAttr);

	      /* save off the working attributes for this rule */
	      state.attrCopy(state.attrs[i], state.attrsWorking[i]);
	    }
	    state.attributesComplete = true;
	    let attri = null;
	    for (i = 0; i < state.ruleCount; i += 1) {
	      attri = state.attrs[i];
	      if (attri.left || !attri.finite || attri.cyclic) {
	        const temp = state.attrGen(attri.rule);
	        state.attrCopy(temp, attri);
	        state.attrsErrors.push(temp);
	        state.attrsErrorCount += 1;
	      }
	    }
	  };
	  const truth = (val) => (val ? 't' : 'f');
	  const tError = (val) => (val ? 'e' : 'f');
	  const fError = (val) => (val ? 't' : 'e');
	  const showAttr = (seq, index, attr, dep) => {
	    let str = `${seq}:${index}:`;
	    str += `${tError(attr.left)} `;
	    str += `${truth(attr.nested)} `;
	    str += `${truth(attr.right)} `;
	    str += `${tError(attr.cyclic)} `;
	    str += `${fError(attr.finite)} `;
	    str += `${truth(attr.empty)}:`;
	    str += `${state.typeToString(dep.recursiveType)}:`;
	    str += dep.recursiveType === id.ATTR_MR ? dep.groupNumber : '-';
	    str += `:${attr.rule.name}\n`;
	    return str;
	  };

	  const showLegend = () => {
	    let str = 'LEGEND - t=true, f=false, e=error\n';
	    str += 'sequence:rule index:left nested right cyclic finite empty:type:group number:rule name\n';
	    return str;
	  };
	  const showAttributeErrors = () => {
	    let attri = null;
	    let depi = null;
	    let str = '';
	    str += 'RULE ATTRIBUTES WITH ERRORS\n';
	    str += showLegend();
	    if (state.attrsErrorCount) {
	      for (let i = 0; i < state.attrsErrorCount; i += 1) {
	        attri = state.attrsErrors[i];
	        depi = state.ruleDeps[attri.rule.index];
	        str += showAttr(i, attri.rule.index, attri, depi);
	      }
	    } else {
	      str += '<none>\n';
	    }
	    return str;
	  };

	  const show = (type) => {
	    let i = 0;
	    let ii = 0;
	    let attri = null;
	    let depi = null;
	    let str = '';
	    let { ruleIndexes } = state;
	    // let udtIndexes = state.udtIndexes;
	    if (type === 97) {
	      ruleIndexes = state.ruleAlphaIndexes;
	      // udtIndexes = state.udtAlphaIndexes;
	    } else if (type === 116) {
	      ruleIndexes = state.ruleTypeIndexes;
	      // udtIndexes = state.udtAlphaIndexes;
	    }
	    /* show all attributes */
	    for (i = 0; i < state.ruleCount; i += 1) {
	      ii = ruleIndexes[i];
	      attri = state.attrs[ii];
	      depi = state.ruleDeps[ii];
	      str += showAttr(i, ii, attri, depi);
	    }
	    return str;
	  };

	  // Display the rule attributes.
	  // - order
	  //      - "index" or "i", index order (default)
	  //      - "alpha" or "a", alphabetical order
	  //      - "type" or "t", ordered by type (alphabetical within each type/group)
	  //      - none of above, index order (default)
	  const showAttributes = (order = 'index') => {
	    if (!state.attributesComplete) {
	      throw new Error(`${thisFile}:showAttributes: attributes not available`);
	    }
	    let str = '';
	    const leader = 'RULE ATTRIBUTES\n';
	    if (order.charCodeAt(0) === 97) {
	      str += 'alphabetical by rule name\n';
	      str += leader;
	      str += showLegend();
	      str += show(97);
	    } else if (order.charCodeAt(0) === 116) {
	      str += 'ordered by rule type\n';
	      str += leader;
	      str += showLegend();
	      str += show(116);
	    } else {
	      str += 'ordered by rule index\n';
	      str += leader;
	      str += showLegend();
	      str += show();
	    }
	    return str;
	  };

	  /* Destructuring assignment - see MDN Web Docs */
	  return { ruleAttributes, showAttributes, showAttributeErrors };
	})();
	return ruleAttributes;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var ruleDependencies;
var hasRequiredRuleDependencies;

function requireRuleDependencies () {
	if (hasRequiredRuleDependencies) return ruleDependencies;
	hasRequiredRuleDependencies = 1;
	// Determine rule dependencies and types.
	// For each rule, determine which other rules it refers to
	// and which of the other rules refer back to it.
	//
	// Rule types are:
	//  - non-recursive - the rule never refers to itself, even indirectly
	//  - recursive - the rule refers to itself, possibly indirectly
	//  - mutually-recursive - belongs to a group of two or more rules, each of which refers to every other rule in the group, including itself.
	ruleDependencies = (() => {
	  const id = requireIdentifiers();
	  let state = null; /* keep a global reference to the state for the show functions */

	  /* scan the opcodes of the indexed rule and discover which rules it references and which rule refer back to it */
	  const scan = (ruleCount, ruleDeps, index, isScanned) => {
	    let i = 0;
	    let j = 0;
	    const rdi = ruleDeps[index];
	    isScanned[index] = true;
	    const op = rdi.rule.opcodes;
	    for (i = 0; i < op.length; i += 1) {
	      const opi = op[i];
	      if (opi.type === id.RNM) {
	        rdi.refersTo[opi.index] = true;
	        if (!isScanned[opi.index]) {
	          scan(ruleCount, ruleDeps, opi.index, isScanned);
	        }
	        for (j = 0; j < ruleCount; j += 1) {
	          if (ruleDeps[opi.index].refersTo[j]) {
	            rdi.refersTo[j] = true;
	          }
	        }
	      } else if (opi.type === id.UDT) {
	        rdi.refersToUdt[opi.index] = true;
	      } else if (opi.type === id.BKR) {
	        if (opi.index < ruleCount) {
	          rdi.refersTo[opi.index] = true;
	          if (!isScanned[opi.index]) {
	            scan(ruleCount, ruleDeps, opi.index, isScanned);
	          }
	        } else {
	          rdi.refersToUdt[ruleCount - opi.index] = true;
	        }
	      }
	    }
	  };
	  // Determine the rule dependencies, types and mutually recursive groups.
	  const ruleDependencies = (stateArg) => {
	    state = stateArg; /* make it global */
	    let i = 0;
	    let j = 0;
	    let groupCount = 0;
	    let rdi = null;
	    let rdj = null;
	    let newGroup = false;
	    state.dependenciesComplete = false;

	    /* make a working array of rule scanned markers */
	    const isScanned = state.falseArray(state.ruleCount);

	    /* discover the rule dependencies */
	    for (i = 0; i < state.ruleCount; i += 1) {
	      state.falsifyArray(isScanned);
	      scan(state.ruleCount, state.ruleDeps, i, isScanned);
	    }
	    /* discover all rules referencing each rule */
	    for (i = 0; i < state.ruleCount; i += 1) {
	      for (j = 0; j < state.ruleCount; j += 1) {
	        if (i !== j) {
	          if (state.ruleDeps[j].refersTo[i]) {
	            state.ruleDeps[i].referencedBy[j] = true;
	          }
	        }
	      }
	    }
	    /* find the non-recursive and recursive types */
	    for (i = 0; i < state.ruleCount; i += 1) {
	      state.ruleDeps[i].recursiveType = id.ATTR_N;
	      if (state.ruleDeps[i].refersTo[i]) {
	        state.ruleDeps[i].recursiveType = id.ATTR_R;
	      }
	    }

	    /* find the mutually-recursive groups, if any */
	    groupCount = -1;
	    for (i = 0; i < state.ruleCount; i += 1) {
	      rdi = state.ruleDeps[i];
	      if (rdi.recursiveType === id.ATTR_R) {
	        newGroup = true;
	        for (j = 0; j < state.ruleCount; j += 1) {
	          if (i !== j) {
	            rdj = state.ruleDeps[j];
	            if (rdj.recursiveType === id.ATTR_R) {
	              if (rdi.refersTo[j] && rdj.refersTo[i]) {
	                if (newGroup) {
	                  groupCount += 1;
	                  rdi.recursiveType = id.ATTR_MR;
	                  rdi.groupNumber = groupCount;
	                  newGroup = false;
	                }
	                rdj.recursiveType = id.ATTR_MR;
	                rdj.groupNumber = groupCount;
	              }
	            }
	          }
	        }
	      }
	    }
	    state.isMutuallyRecursive = groupCount > -1;

	    /* sort the rules/UDTS */
	    state.ruleAlphaIndexes.sort(state.compRulesAlpha);
	    state.ruleTypeIndexes.sort(state.compRulesAlpha);
	    state.ruleTypeIndexes.sort(state.compRulesType);
	    if (state.isMutuallyRecursive) {
	      state.ruleTypeIndexes.sort(state.compRulesGroup);
	    }
	    if (state.udtCount) {
	      state.udtAlphaIndexes.sort(state.compUdtsAlpha);
	    }

	    state.dependenciesComplete = true;
	  };
	  const show = (type = null) => {
	    let i = 0;
	    let j = 0;
	    let count = 0;
	    let startSeg = 0;
	    const maxRule = state.ruleCount - 1;
	    const maxUdt = state.udtCount - 1;
	    const lineLength = 100;
	    let str = '';
	    let pre = '';
	    const toArrow = '=> ';
	    const byArrow = '<= ';
	    let first = false;
	    let rdi = null;
	    let { ruleIndexes } = state;
	    let { udtIndexes } = state;
	    if (type === 97) {
	      ruleIndexes = state.ruleAlphaIndexes;
	      udtIndexes = state.udtAlphaIndexes;
	    } else if (type === 116) {
	      ruleIndexes = state.ruleTypeIndexes;
	      udtIndexes = state.udtAlphaIndexes;
	    }
	    for (i = 0; i < state.ruleCount; i += 1) {
	      rdi = state.ruleDeps[ruleIndexes[i]];
	      pre = `${ruleIndexes[i]}:${state.typeToString(rdi.recursiveType)}:`;
	      if (state.isMutuallyRecursive) {
	        pre += rdi.groupNumber > -1 ? rdi.groupNumber : '-';
	        pre += ':';
	      }
	      pre += ' ';
	      str += `${pre + state.rules[ruleIndexes[i]].name}\n`;
	      first = true;
	      count = 0;
	      startSeg = str.length;
	      str += pre;
	      for (j = 0; j < state.ruleCount; j += 1) {
	        if (rdi.refersTo[ruleIndexes[j]]) {
	          if (first) {
	            str += toArrow;
	            first = false;
	            str += state.ruleDeps[ruleIndexes[j]].rule.name;
	          } else {
	            str += `, ${state.ruleDeps[ruleIndexes[j]].rule.name}`;
	          }
	          count += 1;
	        }
	        if (str.length - startSeg > lineLength && j !== maxRule) {
	          str += `\n${pre}${toArrow}`;
	          startSeg = str.length;
	        }
	      }
	      if (state.udtCount) {
	        for (j = 0; j < state.udtCount; j += 1) {
	          if (rdi.refersToUdt[udtIndexes[j]]) {
	            if (first) {
	              str += toArrow;
	              first = false;
	              str += state.udts[udtIndexes[j]].name;
	            } else {
	              str += `, ${state.udts[udtIndexes[j]].name}`;
	            }
	            count += 1;
	          }
	          if (str.length - startSeg > lineLength && j !== maxUdt) {
	            str += `\n${pre}${toArrow}`;
	            startSeg = str.length;
	          }
	        }
	      }
	      if (count === 0) {
	        str += '=> <none>\n';
	      }
	      if (first === false) {
	        str += '\n';
	      }
	      first = true;
	      count = 0;
	      startSeg = str.length;
	      str += pre;
	      for (j = 0; j < state.ruleCount; j += 1) {
	        if (rdi.referencedBy[ruleIndexes[j]]) {
	          if (first) {
	            str += byArrow;
	            first = false;
	            str += state.ruleDeps[ruleIndexes[j]].rule.name;
	          } else {
	            str += `, ${state.ruleDeps[ruleIndexes[j]].rule.name}`;
	          }
	          count += 1;
	        }
	        if (str.length - startSeg > lineLength && j !== maxRule) {
	          str += `\n${pre}${toArrow}`;
	          startSeg = str.length;
	        }
	      }
	      if (count === 0) {
	        str += '<= <none>\n';
	      }
	      if (first === false) {
	        str += '\n';
	      }
	      str += '\n';
	    }
	    return str;
	  };
	  // Display the rule dependencies.
	  // - order
	  //      - "index" or "i", index order (default)
	  //      - "alpha" or "a", alphabetical order
	  //      - "type" or "t", ordered by type (alphabetical within each type/group)
	  //      - none of above, index order (default)
	  const showRuleDependencies = (order = 'index') => {
	    let str = 'RULE DEPENDENCIES(index:type:[group number:])\n';
	    str += '=> refers to rule names\n';
	    str += '<= referenced by rule names\n';
	    if (!state.dependenciesComplete) {
	      return str;
	    }

	    if (order.charCodeAt(0) === 97) {
	      str += 'alphabetical by rule name\n';
	      str += show(97);
	    } else if (order.charCodeAt(0) === 116) {
	      str += 'ordered by rule type\n';
	      str += show(116);
	    } else {
	      str += 'ordered by rule index\n';
	      str += show(null);
	    }
	    return str;
	  };

	  /* Destructuring assignment - see MDN Web Docs */
	  return { ruleDependencies, showRuleDependencies };
	})();
	return ruleDependencies;
}

/* eslint-disable class-methods-use-this */

var attributes;
var hasRequiredAttributes;

function requireAttributes () {
	if (hasRequiredAttributes) return attributes;
	hasRequiredAttributes = 1;
	/*  *************************************************************************************
	 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
	 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
	 *   ********************************************************************************* */
	// Attributes Validation
	//
	// It is well known that recursive-descent parsers will fail if a rule is left recursive.
	// Besides left recursion, there are a couple of other fatal attributes that need to be disclosed as well.
	// There are several non-fatal attributes that are of interest also.
	// This module will determine six different attributes listed here with simple examples.
	//
	// **fatal attributes**<br>
	// left recursion<br>
	// S = S "x" / "y"
	//
	// cyclic<br>
	// S = S
	//
	// infinite<br>
	// S = "y" S
	//
	// **non-fatal attributes** (but nice to know)<br>
	// nested recursion<br>
	// S = "a" S "b" / "y"
	//
	// right recursion<br>
	// S = "x" S / "y"
	//
	// empty string<br>
	// S = "x" S / ""
	//
	// Note that these are “aggregate” attributes, in that if the attribute is true it only means that it can be true,
	// not that it will always be true for every input string.
	// In the simple examples above the attributes may be obvious and definite – always true or false.
	// However, for a large grammar with possibly hundreds of rules and parse tree branches,
	// it can be obscure which branches lead to which attributes.
	// Furthermore, different input strings will lead the parser down different branches.
	// One input string may parse perfectly while another will hit a left-recursive branch and bottom out the call stack.
	//
	// It is for this reason that the APG parser generator computes these attributes.
	// When using the API the attributes call is optional but generating a parser without checking the attributes - proceed at your own peril.
	//
	// Additionally, the attribute phase will identify rule dependencies and mutually-recursive groups. For example,
	//
	// S = "a" A "b" / "y"<br>
	// A = "x"
	//
	// S is dependent on A but A is not dependent on S.
	//
	// S = "a" A "b" / "c"<br>
	// A = "x" S "y" / "z"
	//
	// S and A are dependent on one another and are mutually recursive.
	attributes = (function exportAttributes() {
	  const id = requireIdentifiers();
	  const { ruleAttributes, showAttributes, showAttributeErrors } = requireRuleAttributes();
	  const { ruleDependencies, showRuleDependencies } = requireRuleDependencies();
	  class State {
	    constructor(rules, udts) {
	      this.rules = rules;
	      this.udts = udts;
	      this.ruleCount = rules.length;
	      this.udtCount = udts.length;
	      this.startRule = 0;
	      this.dependenciesComplete = false;
	      this.attributesComplete = false;
	      this.isMutuallyRecursive = false;
	      this.ruleIndexes = this.indexArray(this.ruleCount);
	      this.ruleAlphaIndexes = this.indexArray(this.ruleCount);
	      this.ruleTypeIndexes = this.indexArray(this.ruleCount);
	      this.udtIndexes = this.indexArray(this.udtCount);
	      this.udtAlphaIndexes = this.indexArray(this.udtCount);
	      this.attrsErrorCount = 0;
	      this.attrs = [];
	      this.attrsErrors = [];
	      this.attrsWorking = [];
	      this.ruleDeps = [];
	      for (let i = 0; i < this.ruleCount; i += 1) {
	        this.attrs.push(this.attrGen(this.rules[i]));
	        this.attrsWorking.push(this.attrGen(this.rules[i]));
	        this.ruleDeps.push(this.rdGen(rules[i], this.ruleCount, this.udtCount));
	      }
	      this.compRulesAlpha = this.compRulesAlpha.bind(this);
	      this.compUdtsAlpha = this.compUdtsAlpha.bind(this);
	      this.compRulesType = this.compRulesType.bind(this);
	      this.compRulesGroup = this.compRulesGroup.bind(this);
	    }

	    // eslint-disable-next-line class-methods-use-this
	    attrGen(rule) {
	      return {
	        left: false,
	        nested: false,
	        right: false,
	        empty: false,
	        finite: false,
	        cyclic: false,
	        leaf: false,
	        isOpen: false,
	        isComplete: false,
	        rule,
	      };
	    }

	    // eslint-disable-next-line class-methods-use-this
	    attrInit(attr) {
	      attr.left = false;
	      attr.nested = false;
	      attr.right = false;
	      attr.empty = false;
	      attr.finite = false;
	      attr.cyclic = false;
	      attr.leaf = false;
	      attr.isOpen = false;
	      attr.isComplete = false;
	    }

	    attrCopy(dst, src) {
	      dst.left = src.left;
	      dst.nested = src.nested;
	      dst.right = src.right;
	      dst.empty = src.empty;
	      dst.finite = src.finite;
	      dst.cyclic = src.cyclic;
	      dst.leaf = src.leaf;
	      dst.isOpen = src.isOpen;
	      dst.isComplete = src.isComplete;
	      dst.rule = src.rule;
	    }

	    rdGen(rule, ruleCount, udtCount) {
	      const ret = {
	        rule,
	        recursiveType: id.ATTR_N,
	        groupNumber: -1,
	        refersTo: this.falseArray(ruleCount),
	        refersToUdt: this.falseArray(udtCount),
	        referencedBy: this.falseArray(ruleCount),
	      };
	      return ret;
	    }

	    typeToString(recursiveType) {
	      switch (recursiveType) {
	        case id.ATTR_N:
	          return ' N';
	        case id.ATTR_R:
	          return ' R';
	        case id.ATTR_MR:
	          return 'MR';
	        default:
	          return 'UNKNOWN';
	      }
	    }

	    falseArray(length) {
	      const ret = [];
	      if (length > 0) {
	        for (let i = 0; i < length; i += 1) {
	          ret.push(false);
	        }
	      }
	      return ret;
	    }

	    falsifyArray(a) {
	      for (let i = 0; i < a.length; i += 1) {
	        a[i] = false;
	      }
	    }

	    indexArray(length) {
	      const ret = [];
	      if (length > 0) {
	        for (let i = 0; i < length; i += 1) {
	          ret.push(i);
	        }
	      }
	      return ret;
	    }

	    compRulesAlpha(left, right) {
	      if (this.rules[left].lower < this.rules[right].lower) {
	        return -1;
	      }
	      if (this.rules[left].lower > this.rules[right].lower) {
	        return 1;
	      }
	      return 0;
	    }

	    compUdtsAlpha(left, right) {
	      if (this.udts[left].lower < this.udts[right].lower) {
	        return -1;
	      }
	      if (this.udts[left].lower > this.udts[right].lower) {
	        return 1;
	      }
	      return 0;
	    }

	    compRulesType(left, right) {
	      if (this.ruleDeps[left].recursiveType < this.ruleDeps[right].recursiveType) {
	        return -1;
	      }
	      if (this.ruleDeps[left].recursiveType > this.ruleDeps[right].recursiveType) {
	        return 1;
	      }
	      return 0;
	    }

	    compRulesGroup(left, right) {
	      if (this.ruleDeps[left].recursiveType === id.ATTR_MR && this.ruleDeps[right].recursiveType === id.ATTR_MR) {
	        if (this.ruleDeps[left].groupNumber < this.ruleDeps[right].groupNumber) {
	          return -1;
	        }
	        if (this.ruleDeps[left].groupNumber > this.ruleDeps[right].groupNumber) {
	          return 1;
	        }
	      }
	      return 0;
	    }
	  }
	  // eslint-disable-next-line no-unused-vars
	  const attributes = function attributes(rules = [], udts = [], lineMap = [], errors = []) {
	    // let i = 0;
	    // Initialize the state. The state of the computation get passed around to multiple functions in multiple files.
	    const state = new State(rules, udts);

	    // Determine all rule dependencies
	    //  - which rules each rule refers to
	    //  - which rules reference each rule
	    ruleDependencies(state);

	    // Determine the attributes for each rule.
	    ruleAttributes(state);
	    if (state.attrsErrorCount) {
	      errors.push({ line: 0, char: 0, msg: `${state.attrsErrorCount} attribute errors` });
	    }

	    // Return the number of attribute errors to the caller.
	    return state.attrsErrorCount;
	  };

	  /* Destructuring assignment - see MDN Web Docs */
	  return { attributes, showAttributes, showAttributeErrors, showRuleDependencies };
	})();
	return attributes;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var showRules;
var hasRequiredShowRules;

function requireShowRules () {
	if (hasRequiredShowRules) return showRules;
	hasRequiredShowRules = 1;
	showRules = (function exfn() {
	  const thisFileName = 'show-rules.js';
	  // Display the rules.
	  // This function may be called before the attributes calculation.
	  // Sorting is done independently from the attributes.
	  // - order
	  //      - "index" or "i", index order (default)
	  //      - "alpha" or "a", alphabetical order
	  //      - none of above, index order (default)
	  const showRules = function showRules(rulesIn = [], udtsIn = [], order = 'index') {
	    const thisFuncName = 'showRules';
	    let alphaArray = [];
	    let udtAlphaArray = [];
	    const indexArray = [];
	    const udtIndexArray = [];
	    const rules = rulesIn;
	    const udts = udtsIn;
	    const ruleCount = rulesIn.length;
	    const udtCount = udtsIn.length;
	    let str = 'RULE/UDT NAMES';
	    let i;
	    function compRulesAlpha(left, right) {
	      if (rules[left].lower < rules[right].lower) {
	        return -1;
	      }
	      if (rules[left].lower > rules[right].lower) {
	        return 1;
	      }
	      return 0;
	    }
	    function compUdtsAlpha(left, right) {
	      if (udts[left].lower < udts[right].lower) {
	        return -1;
	      }
	      if (udts[left].lower > udts[right].lower) {
	        return 1;
	      }
	      return 0;
	    }
	    if (!(Array.isArray(rulesIn) && rulesIn.length)) {
	      throw new Error(`${thisFileName}:${thisFuncName}: rules arg must be array with length > 0`);
	    }
	    if (!Array.isArray(udtsIn)) {
	      throw new Error(`${thisFileName}:${thisFuncName}: udts arg must be array`);
	    }

	    for (i = 0; i < ruleCount; i += 1) {
	      indexArray.push(i);
	    }
	    alphaArray = indexArray.slice(0);
	    alphaArray.sort(compRulesAlpha);
	    if (udtCount) {
	      for (i = 0; i < udtCount; i += 1) {
	        udtIndexArray.push(i);
	      }
	      udtAlphaArray = udtIndexArray.slice(0);
	      udtAlphaArray.sort(compUdtsAlpha);
	    }
	    if (order.charCodeAt(0) === 97) {
	      str += ' - alphabetical by rule/UDT name\n';
	      for (i = 0; i < ruleCount; i += 1) {
	        str += `${i}: ${alphaArray[i]}: ${rules[alphaArray[i]].name}\n`;
	      }
	      if (udtCount) {
	        for (i = 0; i < udtCount; i += 1) {
	          str += `${i}: ${udtAlphaArray[i]}: ${udts[udtAlphaArray[i]].name}\n`;
	        }
	      }
	    } else {
	      str += ' - ordered by rule/UDT index\n';
	      for (i = 0; i < ruleCount; i += 1) {
	        str += `${i}: ${rules[i].name}\n`;
	      }
	      if (udtCount) {
	        for (i = 0; i < udtCount; i += 1) {
	          str += `${i}: ${udts[i].name}\n`;
	        }
	      }
	    }
	    return str;
	  };
	  return showRules;
	})();
	return showRules;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var api;
var hasRequiredApi;

function requireApi () {
	if (hasRequiredApi) return api;
	hasRequiredApi = 1;
	// This module is Application Programming Interface (API) for **APG** - the ABNF Parser Generator.
	//
	// *Note on teminology.*
	// APG is a parser generator.
	// However, it really only generates a "grammar object" (see below) from the defining SABNF grammar.
	// The generated parser is incomplete at this stage.
	// Remaining, it is the job of the user to develop the generated parser from the grammar object and the **APG** Library (**apg-lib**).
	//
	// The following terminology my help clear up any confusion between the idea of a "generated parser" versus a "generated grammar object".

	// - The generating parser: **APG** is an **APG** parser (yes, there is a circular dependence between **apg-api** and **apg-lib**). We'll call it the generating parser.
	// - The target parser: **APG**'s goal is to generate a parser. We'll call it the target parser.
	// - The target grammar: this is the (ASCII) SABNF grammar defining the target parser.
	// - The target grammar object: **APG** parses the SABNF grammar and generates the JavaScript source for a target grammar object constructor function
	// and/or an actual grammar object.
	// - The final target parser: The user then develops the final target parser using the generated target grammar
	// object and the **APG** parsing library, **apg-lib**.
	// Throws execeptions on fatal errors.
	//
	// src: the input SABNF grammar<br>
	// may be one of:
	// - Buffer of bytes
	// - JavaScript string
	// - Array of integer character codes
	api = function api(src) {
	  const { Buffer } = requireBuffer();
	  const thisFileName = 'api.js: ';
	  const thisObject = this;

	  /* PRIVATE PROPERTIES */
	  const apglib = requireNodeExports$1();
	  const converter = requireConverter();
	  const scanner = requireScanner();
	  const parser = new (requireParser())();
	  const { attributes, showAttributes, showAttributeErrors, showRuleDependencies } = requireAttributes();
	  const showRules = requireShowRules();

	  /* PRIVATE MEMBERS (FUNCTIONS) */
	  /* Convert a phrase (array of character codes) to HTML. */
	  const abnfToHtml = function abnfToHtml(chars, beg, len) {
	    const NORMAL = 0;
	    const CONTROL = 1;
	    const INVALID = 2;
	    const CONTROL_BEG = `<span class="${apglib.style.CLASS_CTRLCHAR}">`;
	    const CONTROL_END = '</span>';
	    const INVALID_BEG = `<span class="${apglib.style.CLASS_NOMATCH}">`;
	    const INVALID_END = '</span>';
	    let end;
	    let html = '';
	    const TRUE = true;
	    while (TRUE) {
	      if (!Array.isArray(chars) || chars.length === 0) {
	        break;
	      }
	      if (typeof beg !== 'number') {
	        throw new Error('abnfToHtml: beg must be type number');
	      }
	      if (beg >= chars.length) {
	        break;
	      }
	      if (typeof len !== 'number' || beg + len >= chars.length) {
	        end = chars.length;
	      } else {
	        end = beg + len;
	      }
	      let state = NORMAL;
	      for (let i = beg; i < end; i += 1) {
	        const ch = chars[i];
	        if (ch >= 32 && ch <= 126) {
	          /* normal - printable ASCII characters */
	          if (state === CONTROL) {
	            html += CONTROL_END;
	            state = NORMAL;
	          } else if (state === INVALID) {
	            html += INVALID_END;
	            state = NORMAL;
	          }
	          /* handle reserved HTML entity characters */
	          switch (ch) {
	            case 32:
	              html += '&nbsp;';
	              break;
	            case 60:
	              html += '&lt;';
	              break;
	            case 62:
	              html += '&gt;';
	              break;
	            case 38:
	              html += '&amp;';
	              break;
	            case 34:
	              html += '&quot;';
	              break;
	            case 39:
	              html += '&#039;';
	              break;
	            case 92:
	              html += '&#092;';
	              break;
	            default:
	              html += String.fromCharCode(ch);
	              break;
	          }
	        } else if (ch === 9 || ch === 10 || ch === 13) {
	          /* control characters */
	          if (state === NORMAL) {
	            html += CONTROL_BEG;
	            state = CONTROL;
	          } else if (state === INVALID) {
	            html += INVALID_END + CONTROL_BEG;
	            state = CONTROL;
	          }
	          if (ch === 9) {
	            html += 'TAB';
	          }
	          if (ch === 10) {
	            html += 'LF';
	          }
	          if (ch === 13) {
	            html += 'CR';
	          }
	        } else {
	          /* invalid characters */
	          if (state === NORMAL) {
	            html += INVALID_BEG;
	            state = INVALID;
	          } else if (state === CONTROL) {
	            html += CONTROL_END + INVALID_BEG;
	            state = INVALID;
	          }
	          /* display character as hexadecimal value */
	          html += `\\x${apglib.utils.charToHex(ch)}`;
	        }
	      }
	      if (state === INVALID) {
	        html += INVALID_END;
	      }
	      if (state === CONTROL) {
	        html += CONTROL_END;
	      }
	      break;
	    }
	    return html;
	  };
	  /* Convert a phrase (array of character codes) to ASCII text. */
	  const abnfToAscii = function abnfToAscii(chars, beg, len) {
	    let str = '';
	    for (let i = beg; i < beg + len; i += 1) {
	      const ch = chars[i];
	      if (ch >= 32 && ch <= 126) {
	        str += String.fromCharCode(ch);
	      } else {
	        switch (ch) {
	          case 9:
	            str += '\\t';
	            break;
	          case 10:
	            str += '\\n';
	            break;
	          case 13:
	            str += '\\r';
	            break;
	          default:
	            str += '\\unknown';
	            break;
	        }
	      }
	    }
	    return str;
	  };
	  /* translate lines (SABNF grammar) to ASCII text */
	  const linesToAscii = function linesToAscii(lines) {
	    let str = 'Annotated Input Grammar';
	    lines.forEach((val) => {
	      str += '\n';
	      str += `line no: ${val.lineNo}`;
	      str += ` : char index: ${val.beginChar}`;
	      str += ` : length: ${val.length}`;
	      str += ` : abnf: ${abnfToAscii(thisObject.chars, val.beginChar, val.length)}`;
	    });
	    str += '\n';
	    return str;
	  };
	  /* translate lines (SABNF grammar) to HTML */
	  const linesToHtml = function linesToHtml(lines) {
	    let html = '';
	    html += `<table class="${apglib.style.CLASS_GRAMMAR}">\n`;
	    const title = 'Annotated Input Grammar';
	    html += `<caption>${title}</caption>\n`;
	    html += '<tr>';
	    html += '<th>line<br>no.</th><th>first<br>char</th><th><br>length</th><th><br>text</th>';
	    html += '</tr>\n';
	    lines.forEach((val) => {
	      html += '<tr>';
	      html += `<td>${val.lineNo}`;
	      html += `</td><td>${val.beginChar}`;
	      html += `</td><td>${val.length}`;
	      html += `</td><td>${abnfToHtml(thisObject.chars, val.beginChar, val.length)}`;
	      html += '</td>';
	      html += '</tr>\n';
	    });

	    html += '</table>\n';
	    return html;
	  };
	  /* Format the error messages to HTML, for page display. */
	  const errorsToHtml = function errorsToHtml(errors, lines, chars, title) {
	    const [style] = apglib;
	    let html = '';
	    const errorArrow = `<span class="${style.CLASS_NOMATCH}">&raquo;</span>`;
	    html += `<p><table class="${style.CLASS_GRAMMAR}">\n`;
	    if (title && typeof title === 'string') {
	      html += `<caption>${title}</caption>\n`;
	    }
	    html += '<tr><th>line<br>no.</th><th>line<br>offset</th><th>error<br>offset</th><th><br>text</th></tr>\n';
	    errors.forEach((val) => {
	      let line;
	      let relchar;
	      let beg;
	      let end;
	      let text;
	      let prefix = '';
	      let suffix = '';
	      if (lines.length === 0) {
	        text = errorArrow;
	        relchar = 0;
	      } else {
	        line = lines[val.line];
	        beg = line.beginChar;
	        if (val.char > beg) {
	          prefix = abnfToHtml(chars, beg, val.char - beg);
	        }
	        beg = val.char;
	        end = line.beginChar + line.length;
	        if (beg < end) {
	          suffix = abnfToHtml(chars, beg, end - beg);
	        }
	        text = prefix + errorArrow + suffix;
	        relchar = val.char - line.beginChar;
	        html += '<tr>';
	        html += `<td>${val.line}</td><td>${line.beginChar}</td><td>${relchar}</td><td>${text}</td>`;
	        html += '</tr>\n';
	        html += '<tr>';
	        html += `<td colspan="3"></td><td>&uarr;:&nbsp;${apglib.utils.stringToAsciiHtml(val.msg)}</td>`;
	        html += '</tr>\n';
	      }
	    });
	    html += '</table></p>\n';
	    return html;
	  };
	  /* Display an array of errors in ASCII text */
	  const errorsToAscii = function errorsToAscii(errors, lines, chars) {
	    let str;
	    let line;
	    let beg;
	    let len;
	    str = '';
	    errors.forEach((error) => {
	      line = lines[error.line];
	      str += `${line.lineNo}: `;
	      str += `${line.beginChar}: `;
	      str += `${error.char - line.beginChar}: `;
	      beg = line.beginChar;
	      len = error.char - line.beginChar;
	      str += abnfToAscii(chars, beg, len);
	      str += ' >> ';
	      beg = error.char;
	      len = line.beginChar + line.length - error.char;
	      str += abnfToAscii(chars, beg, len);
	      str += '\n';
	      str += `${line.lineNo}: `;
	      str += `${line.beginChar}: `;
	      str += `${error.char - line.beginChar}: `;
	      str += 'error: ';
	      str += error.msg;
	      str += '\n';
	    });
	    return str;
	  };
	  let isScanned = false;
	  let isParsed = false;
	  let isTranslated = false;
	  let haveAttributes = false;
	  let attributeErrors = 0;
	  let lineMap;

	  /* PUBLIC PROPERTIES */
	  // The input SABNF grammar as a JavaScript string.
	  // this.sabnf;
	  // The input SABNF grammar as an array of character codes.
	  // this.chars;
	  // An array of line objects, defining each line of the input SABNF grammar
	  // - lineNo : the zero-based line number
	  // - beginChar : offset (into `this.chars`) of the first character in the line
	  // - length : the number of characters in the line
	  // - textLength : the number of characters of text in the line, excluding the line ending characters
	  // - endType : "CRLF", "LF", "CR" or "none" if the last line has no line ending characters
	  // - invalidChars : `true` if the line contains invalid characters, `false` otherwise
	  // this.lines;
	  // An array of rule names and data.
	  // - name : the rule name
	  // - lower : the rule name in lower case
	  // - index : the index of the rule (ordered by appearance in SABNF grammar)
	  // - isBkr : `true` if this rule has been back referenced, `false` otherwise
	  // - opcodes : array of opcodes for this rule
	  // - attrs : the rule attributes
	  // - ctrl : system data
	  // this.rules;
	  // An array of UDT names and data.
	  // this.udts;
	  // An array of errors, if any.
	  // - line : the line number containing the error
	  // - char : the character offset of the error
	  // - msg : the error message
	  this.errors = [];

	  /* CONSTRUCTOR */
	  if (Buffer.isBuffer(src)) {
	    this.chars = converter.decode('BINARY', src);
	  } else if (Array.isArray(src)) {
	    this.chars = src.slice();
	  } else if (typeof src === 'string') {
	    this.chars = converter.decode('STRING', src);
	  } else {
	    throw new Error(`${thisFileName}input source is not a string, byte Buffer or character array`);
	  }
	  this.sabnf = converter.encode('STRING', this.chars);

	  /* PUBLIC MEMBERS (FUNCTIONS) */
	  // Scan the input SABNF grammar for invalid characters and catalog the lines via `this.lines`.
	  // - strict : (optional) if `true`, all lines, including the last must end with CRLF (\r\n),
	  // if `false` (in any JavaScript sense) then line endings may be any mix of CRLF, LF, CR, or end-of-file.
	  // - trace (*) : (optional) a parser trace object, which will trace the parser that does the scan
	  this.scan = function scan(strict, trace) {
	    this.lines = scanner(this.chars, this.errors, strict, trace);
	    isScanned = true;
	  };
	  // Parse the input SABNF grammar for correct syntax.
	  // - strict : (optional) if `true`, the input grammar must be strict ABNF, conforming to [RFC 5234](https://tools.ietf.org/html/rfc5234)
	  // and [RFC 7405](https://tools.ietf.org/html/rfc7405). No superset features allowed.
	  // - trace (\*) : (optional) a parser trace object, which will trace the syntax parser
	  //
	  // <i>(*)NOTE: the trace option was used primarily during development.
	  // Error detection and reporting is now fairly robust and tracing should be unnecessary. Use at your own peril.</i>
	  this.parse = function parse(strict, lite, trace) {
	    if (!isScanned) {
	      throw new Error(`${thisFileName}grammar not scanned`);
	    }
	    parser.syntax(this.chars, this.lines, this.errors, strict, lite, trace);
	    isParsed = true;
	  };
	  // Translate the SABNF grammar syntax into the opcodes that will guide the parser for this grammar.
	  this.translate = function translate() {
	    if (!isParsed) {
	      throw new Error(`${thisFileName}grammar not scanned and parsed`);
	    }
	    const ret = parser.semantic(this.chars, this.lines, this.errors);
	    if (this.errors.length === 0) {
	      this.rules = ret.rules;
	      this.udts = ret.udts;
	      lineMap = ret.lineMap;
	      isTranslated = true;
	    }
	  };
	  // Compute the attributes of each rule.
	  this.attributes = function attrs() {
	    if (!isTranslated) {
	      throw new Error(`${thisFileName}grammar not scanned, parsed and translated`);
	    }
	    attributeErrors = attributes(this.rules, this.udts, lineMap, this.errors);
	    haveAttributes = true;
	    return attributeErrors;
	  };
	  // This function will perform the full suite of steps required to generate a parser grammar object
	  // from the input SABNF grammar.
	  this.generate = function generate(strict) {
	    this.lines = scanner(this.chars, this.errors, strict);
	    if (this.errors.length) {
	      return;
	    }
	    parser.syntax(this.chars, this.lines, this.errors, strict);
	    if (this.errors.length) {
	      return;
	    }
	    const ret = parser.semantic(this.chars, this.lines, this.errors);
	    if (this.errors.length) {
	      return;
	    }
	    this.rules = ret.rules;
	    this.udts = ret.udts;
	    lineMap = ret.lineMap;

	    attributeErrors = attributes(this.rules, this.udts, lineMap, this.errors);
	    haveAttributes = true;
	  };
	  // Display the rules.
	  // Must scan, parse and translate before calling this function, otherwise there are no rules to display.
	  // - order
	  //      - "index" or "i", index order (default)
	  //      - "alpha" or "a", alphabetical order
	  //      - none of above, index order (default)
	  this.displayRules = function displayRules(order = 'index') {
	    if (!isTranslated) {
	      throw new Error(`${thisFileName}grammar not scanned, parsed and translated`);
	    }
	    return showRules(this.rules, this.udts, order);
	  };
	  // Display the rule dependencies.
	  // Must scan, parse, translate and compute attributes before calling this function.
	  // Otherwise the rule dependencies are not known.
	  // - order
	  //      - "index" or "i", index order (default)
	  //      - "alpha" or "a", alphabetical order
	  //      - "type" or "t", ordered by type (alphabetical within each type/group)
	  //      - none of above, index order (default)
	  this.displayRuleDependencies = function displayRuleDependencies(order = 'index') {
	    if (!haveAttributes) {
	      throw new Error(`${thisFileName}no attributes - must be preceeded by call to attributes()`);
	    }
	    return showRuleDependencies(order);
	  };
	  // Display the attributes.
	  // Must scan, parse, translate and compute attributes before calling this function.
	  // - order
	  //      - "index" or "i", index order (default)
	  //      - "alpha" or "a", alphabetical order
	  //      - "type" or "t", ordered by type (alphabetical within each type/group)
	  //      - none of above, type order (default)
	  this.displayAttributes = function displayAttributes(order = 'index') {
	    if (!haveAttributes) {
	      throw new Error(`${thisFileName}no attributes - must be preceeded by call to attributes()`);
	    }
	    if (attributeErrors) {
	      showAttributeErrors(order);
	    }
	    return showAttributes(order);
	  };
	  this.displayAttributeErrors = function displayAttributeErrors() {
	    if (!haveAttributes) {
	      throw new Error(`${thisFileName}no attributes - must be preceeded by call to attributes()`);
	    }
	    return showAttributeErrors();
	  };
	  // Returns a parser grammar object constructor function as a JavaScript string.
	  // This object can then be used to construct a parser.
	  this.toSource = function toSource(config = undefined) {
	    if (!haveAttributes) {
	      throw new Error(`${thisFileName}can't generate parser source - must be preceeded by call to attributes()`);
	    }
	    if (attributeErrors) {
	      throw new Error(`${thisFileName}can't generate parser source - attributes have ${attributeErrors} errors`);
	    }
	    return parser.generateSource(this.chars, this.lines, this.rules, this.udts, config);
	  };
	  // Returns a parser grammar object.
	  // This grammar object may be used by the application to construct a parser.
	  this.toObject = function toObject() {
	    if (!haveAttributes) {
	      throw new Error(`${thisFileName}can't generate parser source - must be preceeded by call to attributes()`);
	    }
	    if (attributeErrors) {
	      throw new Error(`${thisFileName}can't generate parser source - attributes have ${attributeErrors} errors`);
	    }
	    return parser.generateObject(this.sabnf, this.rules, this.udts);
	  };
	  // Display errors in text format, suitable for `console.log()`.
	  this.errorsToAscii = function errorsToAsciiFunc() {
	    return errorsToAscii(this.errors, this.lines, this.chars);
	  };
	  // Display errors in HTML format, suitable for web page display.
	  // (`apg-lib.css` required for proper styling)
	  this.errorsToHtml = function errorsToHtmlFunc(title) {
	    return errorsToHtml(this.errors, this.lines, this.chars, title);
	  };
	  // Generate an annotated the SABNF grammar display in text format.
	  this.linesToAscii = function linesToAsciiFunc() {
	    return linesToAscii(this.lines);
	  };
	  // Generate an annotated the SABNF grammar display in HTML format.
	  // (`apg-lib.css` required for proper styling)
	  this.linesToHtml = function linesToHtmlFunc() {
	    return linesToHtml(this.lines);
	  };
	  // This function was only used by apg.html which has been abandoned.
	  /*
	    this.getAttributesObject = function () {
	        return null;
	    };
	    */
	};
	return api;
}

const unsupported$1 = new Proxy({}, {
  get(_target, property) {
    throw new Error(
      'Node built-in module ' + "path" +
      ' is unavailable in browsers; attempted to access "' + String(property) + '".'
    );
  },
});

var _browserBuiltinShim_path = /*#__PURE__*/Object.freeze({
	__proto__: null,
	default: unsupported$1
});

var require$$1 = /*@__PURE__*/getAugmentedNamespace(_browserBuiltinShim_path);

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var commandLine;
var hasRequiredCommandLine;

function requireCommandLine () {
	if (hasRequiredCommandLine) return commandLine;
	hasRequiredCommandLine = 1;
	// This module processes the command line arguments into a completed configuration
	// and returns a `config` object.
	// It takes the  `node` command line arguments less the first two. e.g. `process.argv.slice(2)`
	// and can be a free mix of keys and key/value pairs.
	//
	// Run<br>
	// `npm run apg -- --help`<br>
	// or<br>
	// `./bin/apg.sh -- help`<br>
	// to see all the options.
	commandLine = function commandLine(args) {
	  const fs = require$$1$1;
	  const path = require$$1;
	  const { Buffer } = requireBuffer();
	  const converter = requireConverter();
	  const helpScreen = function helpScreen(helpArgs) {
	    let help = 'Usage: apg options\n';
	    let options = '';
	    helpArgs.forEach((arg) => {
	      options += `${arg} `;
	    });
	    help += `options: ${options}\n`;
	    help += '-h, --help                 : print this help screen\n';
	    help += '-v, --version              : display version information\n';
	    help += '-s, --strict               : only ABNF grammar (RFC 5234 & 7405) allowed, no Superset features\n';
	    help += '-l, --lite                 : generate an apg-lite ES Modules grammar object*\n';
	    help += '-t, --typescript           : generate a typescript grammar object*\n';
	    help += '-i <path>[,<path>[,...]]   : input file(s)**\n';
	    help += '--in=<path>[,<path>[,...]] : input file(s)**\n';
	    help += '-o <path>                  : output filename***\n';
	    help += '--out=<path>               : output filename***\n';
	    help += '-n <function name>         : the grammar function name****\n';
	    help += '--name=<function name>     : the grammar function name****\n';
	    help += '--display-rules            : display the rule names\n';
	    help += '--display-rule-dependencies: display => rules referenced <= rules referring to this rule\n';
	    help += '--display-attributes       : display the attributes\n';
	    help += '\n';
	    help += 'Options are case insensitive.\n';
	    help += '*   --typescript - a typescript grammar object is exported with\n';
	    help += '        export function grammar(){}\n';
	    help += '*   --lite - an apg-lite ES Modules grammar object is exported with\n';
	    help += '        export default function grammar(){}\n';
	    help += '    --typescript and --lite are mutually exclusive and\n';
	    help += '    --typescript superceeds --lite if both are specified.\n';
	    help += '    If neither are specified a CommonJS object is exported with.\n';
	    help += '        module.exports = function grammar(){}\n';
	    help += '**  Multiple input files allowed.\n';
	    help += '    Multiple file names must be comma separated with no spaces.\n';
	    help += '    File names from multiple input options are concatenated.\n';
	    help += '    Content of all resulting input files is concatenated.\n';
	    help += '*** Output file name is optional.\n';
	    help += '    If no output file name is given, no parser is generated.\n';
	    help += '    If the output file name is specified, the existing extension,\n';
	    help += '    if any, is stripped and ".js" is added unless the --typescript option\n';
	    help += '    is present in which case ".ts" is added.\n';
	    help += '****If --name=fname is present, a named function is created\n';
	    help += '      const fname = function grammar(){}\n';
	    help += '    typically for scripting directly into a web page.\n';
	    help += '    \n';
	    return help;
	  };
	  const version = function version() {
	    return 'JavaScript APG, version 4.4.0\nCopyright (C) 2024 Lowell D. Thomas, all rights reserved\n';
	  };
	  const STRICTL = '--strict';
	  const STRICTS = '-s';
	  const LITEL = '--lite';
	  const LITES = '-l';
	  const TYPEL = '--typescript';
	  const TYPES = '-t';
	  const HELPL = '--help';
	  const HELPS = '-h';
	  const VERSIONL = '--version';
	  const VERSIONS = '-v';
	  const DISPLAY_RULES = '--display-rules';
	  const DISPLAY_RULE_DEPENDENCIES = '--display-rule-dependencies';
	  const DISPLAY_ATTRIBUTES = '--display-attributes';
	  const INL = '--in';
	  const INS = '-i';
	  const OUTL = '--out';
	  const OUTS = '-o';
	  const NAMEL = '--name';
	  const NAMES = '-n';
	  let inFilenames = [];
	  const config = {
	    help: '',
	    version: '',
	    error: '',
	    strict: false,
	    lite: false,
	    typescript: false,
	    noAttrs: false,
	    displayRules: false,
	    displayRuleDependencies: false,
	    displayAttributes: false,
	    src: null,
	    outFilename: '',
	    outfd: process.stdout.fd,
	    funcName: null,
	  };
	  let key;
	  let value;
	  let i = 0;
	  try {
	    while (i < args.length) {
	      const kv = args[i].split('=');
	      if (kv.length === 2) {
	        key = kv[0].toLowerCase();
	        // eslint-disable-next-line prefer-destructuring
	        value = kv[1];
	      } else if (kv.length === 1) {
	        key = kv[0].toLowerCase();
	        value = i + 1 < args.length ? args[i + 1] : '';
	      } else {
	        throw new Error(`command line error: ill-formed option: ${args[i]}`);
	      }
	      switch (key) {
	        case HELPL:
	        case HELPS:
	          config.help = helpScreen(args);
	          return config;
	        case VERSIONL:
	        case VERSIONS:
	          config.version = version();
	          return config;
	        case DISPLAY_RULES:
	          config.displayRules = true;
	          i += 1;
	          break;
	        case DISPLAY_RULE_DEPENDENCIES:
	          config.displayRuleDependencies = true;
	          i += 1;
	          break;
	        case DISPLAY_ATTRIBUTES:
	          config.displayAttributes = true;
	          i += 1;
	          break;
	        case STRICTL:
	        case STRICTS:
	          config.strict = true;
	          i += 1;
	          break;
	        case LITEL:
	        case LITES:
	          config.lite = true;
	          i += 1;
	          break;
	        case TYPEL:
	        case TYPES:
	          config.typescript = true;
	          i += 1;
	          break;
	        case INL:
	        case INS:
	          if (!value) {
	            throw new Error(`command line error: input file name has no value: ${args[i]}`);
	          }
	          inFilenames = inFilenames.concat(value.split(','));
	          i += key === INL ? 1 : 2;
	          break;
	        case OUTL:
	        case OUTS:
	          if (!value) {
	            throw new Error(`command line error: output file name has no valu: ${args[i]}`);
	          }
	          config.outFilename = value;
	          i += key === OUTL ? 1 : 2;
	          break;
	        case NAMEL:
	        case NAMES:
	          if (!value) {
	            throw new Error(`command line error: output file name has no value: ${args[i]}`);
	          }
	          config.funcName = value;
	          i += key === NAMEL ? 1 : 2;
	          break;
	        default:
	          throw new Error(`command line error: unrecognized arg: ${args[i]}`);
	      }
	    }

	    /* get the SABNF input */
	    if (inFilenames.length === 0) {
	      throw new Error('command line error: no input file(s)');
	    }

	    let buf = Buffer.alloc(0);
	    inFilenames.forEach((name) => {
	      buf = Buffer.concat([buf, fs.readFileSync(name)]);
	    });
	    config.src = converter.decode('BINARY', buf);

	    /* validate & open the output file, if any */
	    config.outfd = null;
	    if (config.outFilename) {
	      const info = path.parse(config.outFilename);
	      const ext = config.typescript ? 'ts' : 'js';
	      if (info.dir) {
	        config.outFilename = `${info.dir}/${info.name}.${ext}`;
	      } else {
	        config.outFilename = `${info.name}.${ext}`;
	      }
	      config.outfd = fs.openSync(config.outFilename, 'w');
	    }
	  } catch (e) {
	    config.error = `CONFIG EXCEPTION: ${e.message}`;
	    config.help = helpScreen(args);
	  }
	  return config;
	};
	return commandLine;
}

const unsupported = new Proxy({}, {
  get(_target, property) {
    throw new Error(
      'Node built-in module ' + "util" +
      ' is unavailable in browsers; attempted to access "' + String(property) + '".'
    );
  },
});

var _browserBuiltinShim_util = /*#__PURE__*/Object.freeze({
	__proto__: null,
	default: unsupported
});

var require$$3 = /*@__PURE__*/getAugmentedNamespace(_browserBuiltinShim_util);

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var apg;
var hasRequiredApg;

function requireApg () {
	if (hasRequiredApg) return apg;
	hasRequiredApg = 1;
	// This is the main or driver function for the parser generator.
	// It handles:
	//    - verification and interpretation of the command line parameters
	//    - execution of immediate commands (help, version)
	//    - reading and verifying the input SABNF grammar file(s)
	//    - parsing the input SABNF grammar and reporting errors, if any
	//    - evaluation of the input grammar's attributes
	//    - if all is OK, generating the source code for a grammar object
	//    - writing the source to a specified file
	//
	// Note on teminology.
	//
	// APG is a parser generator.
	// However, it really only generates a "grammar object" (see below) from the defining SABNF grammar.
	// The generated parser is incomplete at this stage.
	// Remaining, it is the job of the user to develop the generated parser from the grammar object and the APG Library (**apg-lib**).
	//
	// The following terminology my help clear up the confusion between the idea of a "generated parser" versus a "generated grammar object".
	// - The generating parser: APG is an APG parser (yes, there is a circular dependence between **apg** and **apg-lib**). We'll call it the generating parser.
	// - The target parser: APG's goal is to generate a parser. We'll call it the target parser.
	// - The target grammar: this is the (ASCII) SABNF grammar defining the target parser.
	// - The target grammar object: APG parses the SABNF grammar and generates the JavaScript source for a target grammar object.
	// - The final target parser: The user then develops the final target parser using the generated target grammar
	// object and the APG parsing library, **apg-lib**.
	apg = function apg(args) {
	  const fs = require$$1$1;
	  const ApiCtor = requireApi();
	  const getConfig = requireCommandLine();
	  const thisFileName = 'apg.js: ';
	  const util = require$$3;
	  function logErrors(api, header) {
	    console.log('\nORIGINAL GRAMMAR:');
	    console.log(api.linesToAscii());
	    console.log(`\n${header}:`);
	    console.log(api.errorsToAscii());
	  }
	  try {
	    /* Get command line parameters and set up the configuration accordingly. */
	    const config = getConfig(args);
	    if (config.error) {
	      console.log(config.error);
	      console.log(config.help);
	      return;
	    }
	    if (config.help) {
	      console.log(config.help);
	      return;
	    }
	    if (config.version) {
	      console.log(config.version);
	      return;
	    }

	    /* Get and validate the input SABNF grammar. */
	    const api = new ApiCtor(config.src);

	    api.scan(config.strict);
	    if (api.errors.length) {
	      logErrors(api, 'GRAMMAR CHARACTER ERRORS');
	      throw new Error(`${thisFileName}invalid input grammar`);
	    }

	    /* parse the grammar - the syntax phase */
	    api.parse(config.strict, config.lite);
	    if (api.errors.length) {
	      logErrors(api, 'GRAMMAR SYNTAX ERRORS');
	      throw new Error(`${thisFileName}grammar has syntax errors`);
	    }

	    /* translate the AST - the semantic phase */
	    api.translate();
	    if (api.errors.length) {
	      logErrors(api, 'GRAMMAR SEMANTIC ERRORS');
	      throw new Error(`${thisFileName}grammar has semantic errors`);
	    }

	    if (config.displayRules) {
	      console.log(api.displayRules('alpha'));
	      console.log();
	    }

	    /* attribute generation */
	    const errorCount = api.attributes();
	    if (errorCount > 0) {
	      console.log('GRAMMAR ATTRIBUTE ERRORS');
	      console.log(api.displayAttributeErrors());
	      console.log();
	      if (config.displayAttributes) {
	        console.log(api.displayAttributes('type'));
	        console.log();
	      }
	      throw new Error(`${thisFileName}grammar has attribute errors`);
	    }
	    if (config.displayRuleDependencies) {
	      console.log(api.displayRuleDependencies('type'));
	      console.log();
	    }
	    if (config.displayAttributes) {
	      console.log(api.displayAttributes('type'));
	      console.log();
	    }

	    /* generate a JavaScript parser, if requested */
	    if (config.outfd) {
	      fs.writeSync(config.outfd, api.toSource(config));
	      if (config.lite) {
	        console.log(`\napg-lite grammar object generated: ${config.outFilename}`);
	      } else {
	        console.log(`\napg-js grammar object generated: ${config.outFilename}`);
	      }
	    }
	  } catch (e) {
	    let msg = 'EXCEPTION THROWN: ';
	    if (e instanceof Error) {
	      msg += `${e.name}: ${e.message}`;
	    } else if (typeof e === 'string') {
	      msg += e;
	    } else {
	      msg += '\n';
	      msg += util.inspect(e, {
	        showHidden: true,
	        depth: null,
	        colors: true,
	      });
	    }
	    console.log(msg);
	  }
	};
	return apg;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var nodeExports;
var hasRequiredNodeExports;

function requireNodeExports () {
	if (hasRequiredNodeExports) return nodeExports;
	hasRequiredNodeExports = 1;
	// Exports the converter and transformer objects.
	nodeExports = {
	  converter: requireConverter(),
	  transformers: requireTransformers(),
	};
	return nodeExports;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var help;
var hasRequiredHelp;

function requireHelp () {
	if (hasRequiredHelp) return help;
	hasRequiredHelp = 1;
	// This module simply houses the help and version text and functions used by `apg-conv`.
	//
	// `module.help()` - returns the help text.
	// Called if the `-h` or `--help` argument is present
	// or if there are any input argument errors.
	//
	// `module.version()` - returns the version text.
	// Called if the `-v` or `--version` argument is present.
	//
	help = {
	  help: function help() {
	    let str = 'Usage:\n';
	    str += 'apg-conv [options]\n';
	    str += '(--help     | -h) display this help screen\n';
	    str += '(--version  | -v) display version number\n';
	    str += '(--src      | -s) <path>, the file to convert, default stdin\n';
	    str += '(--src-type | -st) type, the source file type, default UTF8\n';
	    str += '(--dst      | -d) <path>, the converted file, default stdout\n';
	    str += '(--dst-type | -dt) type, the converted file type, default UTF8\n';
	    str += '(--err      | -e) <path>, the error reporting file, default stderr\n';
	    str += '\n';
	    str += 'type - the byte stream encoding: may be one of:\n';
	    str += 'UTF8\n';
	    str += 'UTF16\n';
	    str += 'UTF16BE\n';
	    str += 'UTF16LE\n';
	    str += 'UTF32\n';
	    str += 'UTF32BE\n';
	    str += 'UTF32LE\n';
	    str += 'UINT7    (7-bit bytes)\n';
	    str += 'ASCII    (alias for UINT7)\n';
	    str += 'UINT8    (8-bit bytes or ISO 8859-1)\n';
	    str += 'BINARY   (alias for UINT8)\n';
	    str += 'UINT16   (alias for UINT16BE)\n';
	    str += 'UINT16BE\n';
	    str += 'UINT16LE\n';
	    str += 'UINT32   (alias for UINT32BE)\n';
	    str += 'UINT32BE\n';
	    str += 'UINT32LE\n';
	    str += 'STRING\n';
	    str += 'ESCAPED\n';
	    str += '\n';
	    str += 'Type notes:\n';
	    str += '- The type names are case insensitive.\n';
	    str += '- Source types may be prefixed with BASE64:.\n';
	    str += '  The input will be treated as base64 encoded.\n';
	    str += '  It will be stripped of white space and control characters (\\t, \\r, \\n),\n';
	    str += '  then base 64 decoded as an initial step.\n';
	    str += '- Destination types may have a :BASE64 suffix.\n';
	    str += '  The output will be base 64 encoded as a final step.\n';
	    str += '- Destination types my be prefixed with CRLF:.\n';
	    str += '  This will cause a line ending transformation prior to decoding.\n';
	    str += '  CRLF(\\r\\n), CR(\\r) or LF(\\n) will be interpreted as line ends and transformed to CRLF.\n';
	    str += '  CRLF will be added to the end if the last line end is missing.\n';
	    str += '- Destination types my be prefixed with LF:.\n';
	    str += '  This will cause a line ending transformation prior to decoding.\n';
	    str += '  CRLF(\\r\\n), CR(\\r) or LF(\\n) will be interpreted as line ends and transformed to LF.\n';
	    str += '  LF will be added to the end if the last line end is missing.\n';
	    str += '- UTF type input data may have an optional Byte Order Mark (BOM)\n';
	    str += '  - [Unicode Standard](http://www.unicode.org/versions/Unicode9.0.0/ch03.pdf#G7404).\n';
	    str += '- UTF output data will not have a BOM.\n';
	    str += '- UTF16 defaults to UTF16BE if there is no BOM.\n';
	    str += '- UTF32 defaults to UTF32BE if there is no BOM.\n';
	    str += "- An exception is thrown if a BOM is present and doesn't match the specified data type.\n";
	    str += '- ASCII is an alias for UINT7, 7-bit unsigned integers.\n';
	    str += '- BINARY is an alias for UINT8, 8-bit unsigned integers.\n';
	    str += '- UINT16 is an alias for UINT16BE, big-endian, 16-bit unsigned integers.\n';
	    str += '- UINT32 is an alias for UINT32BE, big-endian, 32-bit unsigned integers.\n';
	    str += '- STRING is a JavaScript string\n';
	    str += '- The ESCAPED format is identical to JavaScript string escaping except that\n';
	    str += '  the grave accent (`) is used instead of the backslash (\\).\n';
	    str += '  e.g \\xHH -> `xHH, \\uHHHH -> `uHHHH, \\u{HHHHHH} -> `u{HHHHHH}.\n';
	    str += '  Its design is for special use in HTML <textarea> elements.\n';
	    str += '\n';
	    str += 'Examples:\n';
	    str += '\n';
	    str += 'apg-conv -s <inpath> -d <outpath> -st BINARY -dt UTF8\n';
	    str += '  Convert a binary (Latin 1 or UINT8) file to UTF8.\n';
	    str += '  That is, any characters > 0x7f will get two-byte, UTF8 encoding.\n';
	    str += '\n';
	    str += 'apg-conv -s <inpath> -d <outpath> -st ASCII -dt CRLF:ASCII\n';
	    str += '  Convert all line ends(CRLF, LF or CR) of the ASCII file to CRLF(\\r\\n),\n';
	    str += '  including the last even if missing in the input file.\n';
	    str += '\n';
	    str += 'apg-conv -s <inpath> -d <outpath> -st BASE64:UTF8 -dt UTF32\n';
	    str += '  Perform an initial base 64 decoding of the input file,\n';
	    str += '  then convert it from UTF8 to UTF32(BE) encoding.\n';
	    str += '\n';
	    str += 'apg-conv -s <inpath> -d <outpath> -st UTF8 -dt UTF32LE:BASE64\n';
	    str += '  The input file is converted from UTF8 to UTF32LE and base 64 encoded as a final step.\n';
	    str += '\n';
	    str += 'apg-conv -s <inpath> -d <outpath> -st BASE64:UTF8 -dt LF:UTF16:BASE64\n';
	    str += '  The input file is base 64 decoded. All line ends(CRLF, LF or CR) are converted to LF(\\n),\n';
	    str += '  then converted to wide characters (UTF16) and finally base64 encoded.\n';
	    str += '\n';
	    return str;
	  },
	  version: function version() {
	    return 'Version 4.0.0\nCopyright (c) 2021 Lowell D. Thomas, all rights reserved';
	  },
	};
	return help;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var apgConv;
var hasRequiredApgConv;

function requireApgConv () {
	if (hasRequiredApgConv) return apgConv;
	hasRequiredApgConv = 1;
	// This module is the main function for command line usage.
	// It reads a source file and writes a destination file, converting the source format to the destination format.
	// The files are all treated as byte streams.
	// `stdin` and `stdout` are the default input and output streams.
	//
	// Run<br>
	// `npm run apg-conv -- --help`<br>
	// or<br>
	// `./bin/apg-conv.sh --help`<br>
	// to see the options.

	apgConv = function exfn() {
	  'use strict;';

	  const { Buffer } = requireBuffer();
	  const SRC_FILEL = '--src';
	  const SRC_FILES = '-s';
	  const SRC_TYPEL = '--src-type';
	  const SRC_TYPES = '-st';
	  const DST_FILEL = '--dst';
	  const DST_FILES = '-d';
	  const DST_TYPEL = '--dst-type';
	  const DST_TYPES = '-dt';
	  const ERR_FILEL = '--err';
	  const ERR_FILES = '-e';
	  const HELPL = '--help';
	  const HELPS = '-h';
	  const VERSIONL = '--version';
	  const VERSIONS = '-v';
	  let srcType = 'UTF8';
	  let dstType = 'UTF8';
	  let srcFile = '';
	  let dstFile = '';
	  let errFile = '';
	  const fs = require$$1$1;
	  const api = requireNodeExports();
	  const help = requireHelp();
	  const { convert } = api.converter;
	  let srcStream = process.stdin;
	  let dstStream = process.stdout;
	  let errStream = process.stderr;
	  let srcBuf;
	  let dstBuf;
	  const args = process.argv.slice(2);
	  try {
	    /* get the input arguments */
	    if (!args || args.length === 0) {
	      console.log(help.help());
	      return;
	    }
	    for (let i = 0; i < args.length; i += 2) {
	      const key = args[i].toLowerCase();
	      if (key === HELPL || key === HELPS) {
	        console.log(help.help());
	        return;
	      }
	      if (key === VERSIONL || key === VERSIONS) {
	        console.log(help.version());
	        return;
	      }
	      const i1 = i + 1;
	      if (i1 >= args.length) {
	        throw new TypeError(`no matching value for option: ${key}`);
	      }
	      const value = args[i1];
	      switch (key) {
	        case SRC_FILEL:
	        case SRC_FILES:
	          srcFile = value;
	          break;
	        case SRC_TYPEL:
	        case SRC_TYPES:
	          srcType = value;
	          break;
	        case DST_FILEL:
	        case DST_FILES:
	          dstFile = value;
	          break;
	        case DST_TYPEL:
	        case DST_TYPES:
	          dstType = value;
	          break;
	        case ERR_FILEL:
	        case ERR_FILES:
	          errFile = value;
	          break;
	        default:
	          throw new TypeError(`unrecognized option: ${key}`);
	      }
	    }

	    /* disable STRING type, allowed by converter, but not here */
	    /* create file streams, if necessary */
	    if (srcFile) {
	      srcStream = fs.createReadStream(srcFile, { flags: 'r' });
	    }
	    if (dstFile) {
	      dstStream = fs.createWriteStream(dstFile, { flags: 'w' });
	    }
	    if (errFile) {
	      errStream = fs.createWriteStream(errFile, { flags: 'w' });
	    }

	    /* read the input data */
	    srcBuf = Buffer.alloc(0);
	    srcStream.on('data', (chunkBuf) => {
	      srcBuf = Buffer.concat([srcBuf, chunkBuf]);
	    });

	    srcStream.on('end', () => {
	      try {
	        /* translate the data */
	        dstBuf = convert(srcType, srcBuf, dstType);

	        /* write the translated the data */
	        dstStream.write(dstBuf);
	        if (dstFile) {
	          dstStream.end();
	        }
	      } catch (e) {
	        errStream.write(`EXCEPTION: on srcStream end: ${e.message}\n`);
	      }
	    });
	    srcStream.on('error', (e) => {
	      errStream.write(`srcStream error: ${e.message}\n`);
	    });
	    dstStream.on('error', (e) => {
	      errStream.write(`dstStream error: ${e.message}\n`);
	    });
	  } catch (e) {
	    errStream.write(`EXCEPTION: ${e.message}\n`);
	    errStream.write(help.help());
	  }
	  if (errFile) {
	    errStream.end();
	  }
	};
	return apgConv;
}

var exec = {};

/* eslint-disable no-underscore-dangle */

var result;
var hasRequiredResult;

function requireResult () {
	if (hasRequiredResult) return result;
	hasRequiredResult = 1;

	const apglib = requireNodeExports$1();

	// const utils = apglib.utils;
	// const style = apglib.style;
	const { utils, style } = apglib;
	const MODE_HEX = 16;
	const MODE_DEC = 10;
	const MODE_ASCII = 8;
	const MODE_UNICODE = 32;
	/* add style to HTML phrases */
	const phraseStyle = function phraseStyle(phrase, styleArg) {
	  if (phrase === '') {
	    return `<span class="${style.CLASS_EMPTY}">&#120634;</span>`;
	  }
	  if (phrase === undefined) {
	    return `<span class="${style.CLASS_REMAINDER}">undefined</span>`;
	  }
	  let classStyle = style.CLASS_REMAINDER;
	  if (typeof styleArg === 'string') {
	    if (styleArg.toLowerCase() === 'match') {
	      classStyle = style.CLASS_MATCH;
	    } else if (styleArg.toLowerCase() === 'nomatch') {
	      classStyle = style.CLASS_NOMATCH;
	    }
	  }
	  const chars = apglib.utils.stringToChars(phrase);
	  let html = `<span class="${classStyle}">`;
	  html += apglib.utils.charsToAsciiHtml(chars);
	  return `${html}</span>`;
	};
	/* result object - string phrases to ASCII text */
	const sResultToText = function sResultToText(result) {
	  let txt = '';
	  txt += '    result:\n';
	  txt += '       [0]: ';
	  txt += result[0];
	  txt += '\n';
	  txt += `     input: ${result.input}`;
	  txt += '\n';
	  txt += `     index: ${result.index}`;
	  txt += '\n';
	  txt += `    length: ${result.length}`;
	  txt += '\n';
	  txt += `tree depth: ${result.treeDepth}`;
	  txt += '\n';
	  txt += ` node hits: ${result.nodeHits}`;
	  txt += '\n';
	  txt += '     rules: ';
	  let prefix = '';
	  const indent = '          : ';
	  const { rules } = result;
	  // eslint-disable-next-line no-restricted-syntax
	  // eslint-disable-next-line guard-for-in
	  for (const name in rules) {
	    const rule = rules[name];
	    if (rule) {
	      for (let i = 0; i < rule.length; i += 1) {
	        const ruleobj = rule[i];
	        txt += `${prefix + name} : ${ruleobj.index}: `;
	        txt += ruleobj.phrase;
	        txt += '\n';
	        prefix = indent;
	      }
	    } else {
	      txt += `${prefix + name}: `;
	      txt += 'undefined';
	      txt += '\n';
	    }
	    prefix = indent;
	  }
	  return txt;
	};
	/* result object - string to HTML text */
	const sResultToHtml = function sResultToHtml(result) {
	  let html = '';
	  const caption = 'result:';
	  html += `<table class="${style.CLASS_STATE}">\n`;
	  html += `<caption>${caption}</caption>\n`;
	  html += '<tr>';
	  html += '<th>item</th><th>value</th><th>phrase</th>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>[0]</td>';
	  html += `<td>${result.index}</td>`;
	  html += `<td>${phraseStyle(result[0], 'match')}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>input</td>';
	  html += '<td>0</td>';
	  html += `<td>${phraseStyle(result.input)}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += `<td>index</td><td>${result.index}</td>`;
	  html += '<td></td>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += `<td>length</td><td>${result.length}</td>`;
	  html += '<td></td>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += `<td>tree depth</td><td>${result.treeDepth}</td>`;
	  html += '<td></td>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += `<td>node hits</td><td>${result.nodeHits}</td>`;
	  html += '<td></td>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<th>rules</th><th>index</th><th>phrase</th>';
	  html += '</tr>\n';

	  const { rules } = result;
	  for (const name in rules) {
	    const rule = rules[name];
	    if (rule) {
	      for (let i = 0; i < rule.length; i += 1) {
	        const ruleobj = rule[i];
	        html += '<tr>';
	        html += `<td>${name}</td>`;
	        html += `<td>${ruleobj.index}</td>`;
	        html += `<td>${phraseStyle(ruleobj.phrase, 'match')}</td>`;
	        html += '\n';
	      }
	    } else {
	      html += '<tr>';
	      html += `<td>${name}</td>`;
	      html += '<td></td>';
	      html += `<td>${phraseStyle(undefined)}</td>`;
	      html += '\n';
	    }
	  }
	  html += '</table>\n';
	  return html;
	};
	/* result object - string to HTML page */
	const sResultToHtmlPage = function sResultToHtmlPage(result) {
	  return utils.htmlToPage(sResultToHtml(result), 'apg-exp result');
	};
	/* apg-exp object - string to ASCII text */
	const sLastMatchToText = function sLastMatchToText(exp) {
	  let txt = '';
	  txt += '  last match:\n';
	  txt += '   lastIndex: ';
	  txt += exp.lastIndex;
	  txt += '\n';
	  txt += '       flags: "';
	  txt += `${exp.flags}"`;
	  txt += '\n';
	  txt += '      global: ';
	  txt += exp.global;
	  txt += '\n';
	  txt += '      sticky: ';
	  txt += exp.sticky;
	  txt += '\n';
	  txt += '     unicode: ';
	  txt += exp.unicode;
	  txt += '\n';
	  txt += '       debug: ';
	  txt += exp.debug;
	  txt += '\n';
	  if (exp['$&'] === undefined) {
	    txt += '   last match: undefined';
	    txt += '\n';
	    return txt;
	  }
	  txt += '       input: ';
	  txt += exp.input;
	  txt += '\n';
	  txt += ' leftContext: ';
	  txt += exp.leftContext;
	  txt += '\n';
	  txt += '   lastMatch: ';
	  txt += exp.lastMatch;
	  txt += '\n';
	  txt += 'rightContext: ';
	  txt += exp.rightContext;
	  txt += '\n';
	  txt += '       rules: ';
	  let prefix = '';
	  const indent = '            : ';
	  for (const name in exp.rules) {
	    txt += `${prefix + name} : `;
	    txt += exp.rules[name];
	    txt += '\n';
	    prefix = indent;
	  }
	  txt += '\n';
	  txt += 'alias:\n';
	  txt += ' ["$_"]: ';
	  // eslint-disable-next-line no-underscore-dangle
	  txt += exp.$_;
	  txt += '\n';
	  txt += ' ["$`"]: ';
	  txt += exp['$`'];
	  txt += '\n';
	  txt += ' ["$&"]: ';
	  txt += exp['$&'];
	  txt += '\n';
	  txt += ' ["$\'"]: ';
	  txt += exp["$'"];
	  txt += '\n';
	  for (const name in exp.rules) {
	    txt += ` ["\${${name}}"]: `;
	    txt += exp[`\${${name}}`];
	    txt += '\n';
	  }
	  return txt;
	};
	/* apg-exp object - string to HTML text */
	const sLastMatchToHtml = function sLastMatchToHtml(exp) {
	  let html = '';
	  const caption = 'last match:';
	  html += `<table class="${style.CLASS_STATE}">\n`;
	  html += `<caption>${caption}</caption>\n`;
	  html += '<tr>';
	  html += '<th>item</th><th>value</th>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>lastIndex</td>';
	  html += `<td>${exp.lastIndex}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>flags</td>';
	  html += `<td>&#34;${exp.flags}&#34;</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>global</td>';
	  html += `<td>${exp.global}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>sticky</td>';
	  html += `<td>${exp.sticky}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>unicode</td>';
	  html += `<td>${exp.unicode}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>debug</td>';
	  html += `<td>${exp.debug}</td>`;
	  html += '</tr>\n';

	  if (exp['$&'] === undefined) {
	    html += '<tr>';
	    html += '<td>lastMatch</td>';
	    html += `<td>${phraseStyle(undefined)}</td>`;
	    html += '</tr>\n';
	    html += '</table>\n';
	    return html;
	  }
	  html += '<th>item</th><th>phrase</th>';
	  html += '</tr>\n';
	  html += '<tr>';
	  html += '<td>input</td>';
	  html += `<td>${phraseStyle(exp.input)}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>leftContext</td>';
	  html += `<td>${phraseStyle(exp.leftContext)}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>lastMatch</td>';
	  html += `<td>${phraseStyle(exp.lastMatch, 'match')}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>rightContext</td>';
	  html += `<td>${phraseStyle(exp.rightContext)}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<th>rule</th><th>phrase</th>';
	  html += '</tr>\n';

	  for (const name in exp.rules) {
	    html += '<tr>';
	    html += `<td>${name}</td>`;
	    html += `<td>${phraseStyle(exp.rules[name])}</td>`;
	    html += '</tr>\n';
	  }

	  html += '<tr>';
	  html += '<th>alias</th><th>phrase</th>';
	  html += '</tr>\n';
	  html += '<tr>';
	  html += '<td>["$_"]</td>';
	  // eslint-disable-next-line no-underscore-dangle
	  html += `<td>${phraseStyle(exp.$_)}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>["$`"]</td>';
	  html += `<td>${phraseStyle(exp['$`'])}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>["$&"]</td>';
	  html += `<td>${phraseStyle(exp['$&'], 'match')}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>["$\'"]</td>';
	  html += `<td>${phraseStyle(exp["$'"])}</td>`;
	  html += '</tr>\n';

	  for (const name in exp.rules) {
	    html += '<tr>';
	    html += `<td>["\${${name}}"]</td>`;
	    html += `<td>${phraseStyle(exp[`\${${name}}`])}</td>`;
	    html += '</tr>\n';
	  }
	  html += '</table>\n';
	  return html;
	};
	/* apg-exp object - string to HTML page */
	const sLastMatchToHtmlPage = function sLastMatchToHtmlPage(exp) {
	  return utils.htmlToPage(sLastMatchToHtml(exp), 'apg-exp last result');
	};
	/* translates ASCII string to integer mode identifier - defaults to ASCII */
	const getMode = function getMode(modearg) {
	  let mode = MODE_ASCII;
	  if (typeof modearg === 'string' && modearg.length >= 3) {
	    const modein = modearg.toLowerCase().slice(0, 3);
	    if (modein === 'hex') {
	      mode = MODE_HEX;
	    } else if (modein === 'dec') {
	      mode = MODE_DEC;
	    } else if (modein === 'uni') {
	      mode = MODE_UNICODE;
	    }
	  }
	  return mode;
	};
	/* translate integer mode identifier to standard text string */
	const modeToText = function modeToText(mode) {
	  let txt;
	  switch (mode) {
	    case MODE_ASCII:
	      txt = 'ascii';
	      break;
	    case MODE_HEX:
	      txt = 'hexadecimal';
	      break;
	    case MODE_DEC:
	      txt = 'decimal';
	      break;
	    case MODE_UNICODE:
	      txt = 'Unicode';
	      break;
	    default:
	      throw new Error('recognized mode');
	  }
	  return txt;
	};
	/* convert integer to hex with leading 0 if necessary */
	const charToHex = function charToHex(char) {
	  let ch = char.toString(16);
	  if (ch.length % 2 !== 0) {
	    ch = `0${ch}`;
	  }
	  return ch;
	};
	/* convert integer character code array to formatted text string */
	const charsToMode = function charsToMode(chars, mode) {
	  let txt = '';
	  if (mode === MODE_ASCII) {
	    txt += apglib.utils.charsToString(chars);
	  } else if (mode === MODE_DEC) {
	    txt += '[';
	    if (chars.length > 0) {
	      txt += chars[0];
	      for (let i = 1; i < chars.length; i += 1) {
	        txt += `,${chars[i]}`;
	      }
	    }
	    txt += ']';
	  } else if (mode === MODE_HEX) {
	    txt += '[';
	    if (chars.length > 0) {
	      txt += `\\x${charToHex(chars[0])}`;
	      for (let i = 1; i < chars.length; i += 1) {
	        txt += `,\\x${charToHex(chars[i])}`;
	      }
	    }
	    txt += ']';
	  } else if (mode === MODE_UNICODE) {
	    txt += '[';
	    if (chars.length > 0) {
	      txt += `\\u${charToHex(chars[0])}`;
	      for (let i = 1; i < chars.length; i += 1) {
	        txt += `,\\u${charToHex(chars[i])}`;
	      }
	    }
	    txt += ']';
	  }
	  return txt;
	};
	/* result object - Unicode mode to ASCII text */
	const uResultToText = function uResultToText(result, modeArg) {
	  const mode = getMode(modeArg);
	  let txt = '';
	  txt += `    result(${modeToText(mode)})\n`;
	  txt += '       [0]: ';
	  txt += charsToMode(result[0], mode);
	  txt += '\n';
	  txt += `     input: ${charsToMode(result.input, mode)}`;
	  txt += '\n';
	  txt += `     index: ${result.index}`;
	  txt += '\n';
	  txt += `    length: ${result.length}`;
	  txt += '\n';
	  txt += `tree depth: ${result.treeDepth}`;
	  txt += '\n';
	  txt += ` node hits: ${result.nodeHits}`;
	  txt += '\n';
	  txt += '     rules: ';
	  txt += '\n';
	  const { rules } = result;
	  for (const name in rules) {
	    const rule = rules[name];
	    if (rule) {
	      for (let i = 0; i < rule.length; i += 1) {
	        const ruleobj = rule[i];
	        txt += `          :${name} : ${ruleobj.index}: `;
	        txt += charsToMode(ruleobj.phrase, mode);
	        txt += '\n';
	      }
	    } else {
	      txt += `          :${name}: `;
	      txt += 'undefined';
	      txt += '\n';
	    }
	  }
	  return txt;
	};
	/* result object - Unicode mode to HTML text */
	const uResultToHtml = function uResultToHtml(result, modeArg) {
	  const mode = getMode(modeArg);
	  let html = '';
	  let caption = 'result:';
	  caption += `(${modeToText(mode)})`;
	  html += `<table class="${style.CLASS_STATE}">\n`;
	  html += `<caption>${caption}</caption>\n`;
	  html += '<tr>';
	  html += '<th>item</th><th>value</th><th>phrase</th>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>[0]</td>';
	  html += `<td>${result.index}</td>`;
	  html += `<td>${phraseStyle(charsToMode(result[0], mode), 'match')}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>input</td>';
	  html += '<td>0</td>';
	  html += `<td>${phraseStyle(charsToMode(result.input, mode))}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += `<td>index</td><td>${result.index}</td>`;
	  html += '<td></td>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += `<td>length</td><td>${result.length}</td>`;
	  html += '<td></td>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += `<td>tree depth</td><td>${result.treeDepth}</td>`;
	  html += '<td></td>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += `<td>node hits</td><td>${result.nodeHits}</td>`;
	  html += '<td></td>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<th>rules</th><th>index</th><th>phrase</th>';
	  html += '</tr>\n';

	  const { rules } = result;
	  for (const name in rules) {
	    const rule = rules[name];
	    if (rule) {
	      for (let i = 0; i < rule.length; i += 1) {
	        const ruleobj = rule[i];
	        html += '<tr>';
	        html += `<td>${name}</td>`;
	        html += `<td>${ruleobj.index}</td>`;
	        html += `<td>${phraseStyle(charsToMode(ruleobj.phrase, mode), 'match')}</td>`;
	        html += '\n';
	      }
	    } else {
	      html += '<tr>';
	      html += `<td>${name}</td>`;
	      html += '<td></td>';
	      html += `<td>${phraseStyle(undefined)}</td>`;
	      html += '\n';
	    }
	  }
	  html += '</table>\n';
	  return html;
	};
	/* result object - Unicode mode to HTML page */
	const uResultToHtmlPage = function uResultToHtmlPage(result, mode) {
	  return utils.htmlToPage(uResultToHtml(result, mode));
	};
	/* apg-exp object - Unicode mode to ASCII text */
	const uLastMatchToText = function uLastMatchToText(exp, modeArg) {
	  const mode = getMode(modeArg);
	  let txt = '';
	  txt += `  last match(${modeToText(mode)})\n`;
	  txt += `   lastIndex: ${exp.lastIndex}`;
	  txt += '\n';
	  txt += `       flags: "${exp.flags}"`;
	  txt += '\n';
	  txt += `      global: ${exp.global}`;
	  txt += '\n';
	  txt += `      sticky: ${exp.sticky}`;
	  txt += '\n';
	  txt += `     unicode: ${exp.unicode}`;
	  txt += '\n';
	  txt += `       debug: ${exp.debug}`;
	  txt += '\n';
	  if (exp['$&'] === undefined) {
	    txt += '   lastMatch: undefined';
	    txt += '\n';
	    return txt;
	  }
	  txt += '       input: ';
	  txt += charsToMode(exp.input, mode);
	  txt += '\n';
	  txt += ' leftContext: ';
	  txt += charsToMode(exp.leftContext, mode);
	  txt += '\n';
	  txt += '   lastMatch: ';
	  txt += charsToMode(exp.lastMatch, mode);
	  txt += '\n';
	  txt += 'rightContext: ';
	  txt += charsToMode(exp.rightContext, mode);
	  txt += '\n';

	  txt += '       rules:';
	  let prefix = '';
	  const indent = '            :';
	  for (const name in exp.rules) {
	    txt += `${prefix + name} : `;
	    txt += exp.rules[name] ? charsToMode(exp.rules[name], mode) : 'undefined';
	    txt += '\n';
	    prefix = indent;
	  }
	  txt += '\n';
	  txt += '  alias:\n';
	  txt += '   ["$_"]: ';
	  txt += charsToMode(exp.$_, mode);
	  txt += '\n';
	  txt += '   ["$`"]: ';
	  txt += charsToMode(exp['$`'], mode);
	  txt += '\n';
	  txt += '   ["$&"]: ';
	  txt += charsToMode(exp['$&'], mode);
	  txt += '\n';
	  txt += '   ["$\'"]: ';
	  txt += charsToMode(exp["$'"], mode);
	  txt += '\n';
	  for (const name in exp.rules) {
	    txt += `   ["\${${name}}"]: `;
	    txt += exp[`\${${name}}`] ? charsToMode(exp[`\${${name}}`], mode) : 'undefined';
	    txt += '\n';
	  }
	  return txt;
	};
	/* apg-exp object - Unicode mode to HTML text */
	const uLastMatchToHtml = function uLastMatchToHtml(exp, modeArg) {
	  const mode = getMode(modeArg);
	  let html = '';
	  let caption = 'last match:';
	  caption += `(${modeToText(mode)})`;
	  html += `<table class="${style.CLASS_STATE}">\n`;
	  html += `<caption>${caption}</caption>\n`;
	  html += '<tr>';
	  html += '<th>item</th><th>value</th>';
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>lastIndex</td>';
	  html += `<td>${exp.lastIndex}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>flags</td>';
	  html += `<td>&#34;${exp.flags}&#34;</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>global</td>';
	  html += `<td>${exp.global}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>sticky</td>';
	  html += `<td>${exp.sticky}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>unicode</td>';
	  html += `<td>${exp.unicode}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>debug</td>';
	  html += `<td>${exp.debug}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<th>item</th><th>phrase</th>';
	  html += '</tr>\n';
	  if (exp['$&'] === undefined) {
	    html += '<tr>';
	    html += '<td>lastMatch</td>';
	    html += `<td>${phraseStyle(undefined)}</td>`;
	    html += '</tr>\n';
	    html += '</table>\n';
	    return html;
	  }
	  html += '<tr>';
	  html += '<td>input</td>';
	  html += `<td>${phraseStyle(charsToMode(exp.input, mode))}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>leftContext</td>';
	  html += `<td>${phraseStyle(charsToMode(exp.leftContext, mode))}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>lastMatch</td>';
	  html += `<td>${phraseStyle(charsToMode(exp.lastMatch, mode), 'match')}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>rightContext</td>';
	  html += `<td>${phraseStyle(charsToMode(exp.rightContext, mode))}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<th>rules</th><th>phrase</th>';
	  html += '</tr>\n';

	  for (const name in exp.rules) {
	    html += '<tr>';
	    html += `<td>${name}</td>`;
	    if (exp.rules[name]) {
	      html += `<td>${phraseStyle(charsToMode(exp.rules[name], mode))}</td>`;
	    } else {
	      html += `<td>${phraseStyle(undefined)}</td>`;
	    }
	    html += '</tr>\n';
	  }

	  html += '<tr>';
	  html += '<th>alias</th><th>phrase</th>';
	  html += '</tr>\n';
	  html += '<tr>';
	  html += '<td>["$_"]</td>';
	  html += `<td>${phraseStyle(charsToMode(exp.$_, mode))}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>["$`"]</td>';
	  html += `<td>${phraseStyle(charsToMode(exp['$`'], mode))}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>["$&"]</td>';
	  html += `<td>${phraseStyle(charsToMode(exp['$&'], mode), 'match')}</td>`;
	  html += '</tr>\n';

	  html += '<tr>';
	  html += '<td>["$\'"]</td>';
	  html += `<td>${phraseStyle(charsToMode(exp["$'"], mode))}</td>`;
	  html += '</tr>\n';

	  for (const name in exp.rules) {
	    html += '<tr>';
	    html += `<td>["\${${name}}"]</td>`;
	    if (exp[`\${${name}}`]) {
	      html += `<td>${phraseStyle(charsToMode(exp[`\${${name}}`], mode))}</td>`;
	    } else {
	      html += `<td>${phraseStyle(undefined)}</td>`;
	    }
	    html += '</tr>\n';
	  }
	  html += '</table>\n';
	  return html;
	};
	/* apg-exp object - Unicode mode to HTML page */
	const uLastMatchToHtmlPage = function uLastMatchToHtmlPage(exp, mode) {
	  return utils.htmlToPage(uLastMatchToHtml(exp, mode));
	};
	/* SABNF grammar souce to ASCII text */
	const sourceToText = function sourceToText(exp) {
	  return exp.source;
	};
	/* SABNF grammar souce to HTML */
	const sourceToHtml = function sourceToHtml(exp) {
	  const rx = /.*(\r\n|\n|\r)/g;
	  let result;
	  let chars;
	  let html;
	  html = '<pre>\n';
	  const TRUE = true;
	  while (TRUE) {
	    result = rx.exec(exp.source);
	    if (result === null || result[0] === '') {
	      break;
	    }
	    chars = apglib.utils.stringToChars(result[0]);
	    html += apglib.utils.charsToAsciiHtml(chars);
	    html += '\n';
	  }
	  html += '</pre>\n';
	  return html;
	};
	/* SABNF grammar souce to HTML page */
	const sourceToHtmlPage = function sourceToHtmlPage(exp) {
	  return apglib.utils.htmlToPage(sourceToHtml(exp), 'apg-exp source');
	};
	/* export modules needed by the apg-exp and result objects to display their values */
	result = {
	  s: {
	    resultToText: sResultToText,
	    resultToHtml: sResultToHtml,
	    resultToHtmlPage: sResultToHtmlPage,
	    expToText: sLastMatchToText,
	    expToHtml: sLastMatchToHtml,
	    expToHtmlPage: sLastMatchToHtmlPage,
	    sourceToText,
	    sourceToHtml,
	    sourceToHtmlPage,
	  },
	  u: {
	    resultToText: uResultToText,
	    resultToHtml: uResultToHtml,
	    resultToHtmlPage: uResultToHtmlPage,
	    expToText: uLastMatchToText,
	    expToHtml: uLastMatchToHtml,
	    expToHtmlPage: uLastMatchToHtmlPage,
	  },
	};
	return result;
}

/* eslint-disable guard-for-in */

var hasRequiredExec;

function requireExec () {
	if (hasRequiredExec) return exec;
	hasRequiredExec = 1;

	const funcs = requireResult();

	/* turns on or off the read-only attribute of the `last result` properties of the object */
	const setProperties = function seProperties(p, readonly) {
	  const exp = p.thisThis;
	  const prop = {
	    writable: readonly,
	    enumerable: false,
	    configurable: true,
	  };
	  Object.defineProperty(exp, 'input', prop);
	  Object.defineProperty(exp, 'leftContext', prop);
	  Object.defineProperty(exp, 'lastMatch', prop);
	  Object.defineProperty(exp, 'rightContext', prop);
	  Object.defineProperty(exp, '$_', prop);
	  Object.defineProperty(exp, '$`', prop);
	  Object.defineProperty(exp, '$&', prop);
	  Object.defineProperty(exp, "$'", prop);
	  prop.enumerable = true;
	  Object.defineProperty(exp, 'rules', prop);
	  if (!exp.rules) {
	    exp.rules = [];
	  }
	  for (const name in exp.rules) {
	    const des = `\${${name}}`;
	    Object.defineProperty(exp, des, prop);
	    Object.defineProperty(exp.rules, name, prop);
	  }
	};
	/* generate the results object for JavaScript strings */
	const sResult = function sResult(p) {
	  const ret = {
	    index: p.result.index,
	    length: p.result.length,
	    input: p.charsToString(p.chars, 0),
	    treeDepth: p.result.treeDepth,
	    nodeHits: p.result.nodeHits,
	    rules: [],
	    toText() {
	      return funcs.s.resultToText(this);
	    },
	    toHtml() {
	      return funcs.s.resultToHtml(this);
	    },
	    toHtmlPage() {
	      return funcs.s.resultToHtmlPage(this);
	    },
	  };
	  ret[0] = p.charsToString(p.chars, p.result.index, p.result.length);
	  /* each rule is either 'undefined' or an array of phrases */
	  for (const name in p.result.rules) {
	    const rule = p.result.rules[name];
	    if (rule) {
	      ret.rules[name] = [];
	      for (let i = 0; i < rule.length; i += 1) {
	        ret.rules[name][i] = {
	          index: rule[i].index,
	          phrase: p.charsToString(p.chars, rule[i].index, rule[i].length),
	        };
	      }
	    } else {
	      ret.rules[name] = undefined;
	    }
	  }
	  return ret;
	};
	/* generate the results object for integer arrays of character codes */
	const uResult = function uResult(p) {
	  const { chars } = p;
	  const { result } = p;
	  let beg;
	  let end;
	  const ret = {
	    index: result.index,
	    length: result.length,
	    input: chars.slice(0),
	    treeDepth: result.treeDepth,
	    nodeHits: result.nodeHits,
	    rules: [],
	    toText(mode) {
	      return funcs.u.resultToText(this, mode);
	    },
	    toHtml(mode) {
	      return funcs.u.resultToHtml(this, mode);
	    },
	    toHtmlPage(mode) {
	      return funcs.u.resultToHtmlPage(this, mode);
	    },
	  };
	  beg = result.index;
	  end = beg + result.length;
	  ret[0] = chars.slice(beg, end);
	  /* each rule is either 'undefined' or an array of phrases */
	  for (const name in result.rules) {
	    const rule = result.rules[name];
	    if (rule) {
	      ret.rules[name] = [];
	      for (let i = 0; i < rule.length; i += 1) {
	        beg = rule[i].index;
	        end = beg + rule[i].length;
	        ret.rules[name][i] = {
	          index: beg,
	          phrase: chars.slice(beg, end),
	        };
	      }
	    } else {
	      ret.rules[name] = undefined;
	    }
	  }
	  return ret;
	};
	/* generate the apg-exp properties or "last match" object for JavaScript strings */
	const sLastMatch = function sLastMatch(p, result) {
	  const exp = p.thisThis;
	  let temp;
	  // eslint-disable-next-line prefer-destructuring
	  exp.lastMatch = result[0];
	  temp = p.chars.slice(0, result.index);
	  exp.leftContext = p.charsToString(temp);
	  temp = p.chars.slice(result.index + result.length);
	  exp.rightContext = p.charsToString(temp);
	  exp.input = result.input.slice(0);
	  // eslint-disable-next-line no-underscore-dangle
	  exp.$_ = exp.input;
	  exp['$&'] = exp.lastMatch;
	  exp['$`'] = exp.leftContext;
	  exp["$'"] = exp.rightContext;
	  exp.rules = {};
	  for (const name in result.rules) {
	    const rule = result.rules[name];
	    if (rule) {
	      exp.rules[name] = rule[rule.length - 1].phrase;
	    } else {
	      exp.rules[name] = undefined;
	    }
	    exp[`\${${name}}`] = exp.rules[name];
	  }
	};
	/* generate the apg-exp properties or "last match" object for integer arrays of character codes */
	const uLastMatch = function uLastMatch(p, result) {
	  const exp = p.thisThis;
	  const { chars } = p;
	  let beg;
	  beg = 0;
	  const end = beg + result.index;
	  exp.leftContext = chars.slice(beg, end);
	  exp.lastMatch = result[0].slice(0);
	  beg = result.index + result.length;
	  exp.rightContext = chars.slice(beg);
	  exp.input = result.input.slice(0);
	  // eslint-disable-next-line no-underscore-dangle
	  exp.$_ = exp.input;
	  exp['$&'] = exp.lastMatch;
	  exp['$`'] = exp.leftContext;
	  exp["$'"] = exp.rightContext;
	  exp.rules = {};
	  for (const name in result.rules) {
	    const rule = result.rules[name];
	    if (rule) {
	      exp.rules[name] = rule[rule.length - 1].phrase;
	    } else {
	      exp.rules[name] = undefined;
	    }
	    exp[`\${${name}}`] = exp.rules[name];
	  }
	};
	/* set the returned result properties, and the `last result` properties of the object */
	const setResult = function setResult(p, parserResult) {
	  let result;
	  p.result = {
	    index: parserResult.index,
	    length: parserResult.length,
	    treeDepth: parserResult.treeDepth,
	    nodeHits: parserResult.nodeHits,
	    rules: [],
	  };
	  /* set result in APG phrases {phraseIndex, phraseLength} */
	  /* p.ruleNames are all names in the grammar */
	  /* p.thisThis.ast.callbacks[name] only defined for 'included' rule names */
	  const obj = p.parser.ast.phrases();
	  for (const name in p.thisThis.ast.callbacks) {
	    // const cap = p.ruleNames[name];
	    if (p.thisThis.ast.callbacks[name]) {
	      const cap = p.ruleNames[name];
	      if (Array.isArray(obj[cap])) {
	        p.result.rules[cap] = obj[cap];
	      } else {
	        p.result.rules[cap] = undefined;
	      }
	    }
	  }
	  /* p.result now has everything we need to know about the result of exec() */
	  /* generate the Unicode or JavaScript string version of the result & last match objects */
	  setProperties(p, true);
	  if (p.thisThis.unicode) {
	    result = uResult(p);
	    uLastMatch(p, result);
	  } else {
	    result = sResult(p);
	    sLastMatch(p, result);
	  }
	  setProperties(p, false);
	  return result;
	};

	/* create an unsuccessful parser result object */
	const resultInit = function resultInit() {
	  return {
	    success: false,
	  };
	};

	/* create a successful parser result object */
	const resultSuccess = function resultSuccess(index, parserResult) {
	  return {
	    success: true,
	    index,
	    length: parserResult.matched,
	    treeDepth: parserResult.maxTreeDepth,
	    nodeHits: parserResult.nodeHits,
	  };
	};
	/* search forward from `lastIndex` until a match is found or the end of string is reached */
	const forward = function forward(p) {
	  let result = resultInit();
	  for (let i = p.thisThis.lastIndex; i < p.chars.length; i += 1) {
	    const re = p.parser.parseSubstring(p.grammarObject, 0, p.chars, i, p.chars.length - i);
	    if (p.match(re.state)) {
	      result = resultSuccess(i, re);
	      break;
	    }
	  }
	  return result;
	};
	/* reset lastIndex after a search */
	const setLastIndex = function setLastIndex(lastIndex, flag, parserResult) {
	  if (flag) {
	    if (parserResult.success) {
	      let ret = parserResult.index;
	      /* bump-along mode - increment is never zero */
	      ret += parserResult.length > 0 ? parserResult.length : 1;
	      return ret;
	    }
	    return 0;
	  }
	  return lastIndex;
	};
	/* attempt a match at lastIndex only - does look further if a match is not found */
	const anchor = function anchor(p) {
	  let result = resultInit();
	  if (p.thisThis.lastIndex < p.chars.length) {
	    const re = p.parser.parseSubstring(
	      p.grammarObject,
	      0,
	      p.chars,
	      p.thisThis.lastIndex,
	      p.chars.length - p.thisThis.lastIndex
	    );
	    if (p.match(re.state)) {
	      result = resultSuccess(p.thisThis.lastIndex, re);
	    }
	  }
	  return result;
	};
	/* called by exec() for a forward search */
	exec.execForward = function execForward(p) {
	  const parserResult = forward(p);
	  let result = null;
	  if (parserResult.success) {
	    result = setResult(p, parserResult);
	  }
	  p.thisThis.lastIndex = setLastIndex(p.thisThis.lastIndex, p.thisThis.global, parserResult);
	  return result;
	};
	/* called by exec() for an anchored search */
	exec.execAnchor = function execAnchor(p) {
	  const parserResult = anchor(p);
	  let result = null;
	  if (parserResult.success) {
	    result = setResult(p, parserResult);
	  }
	  p.thisThis.lastIndex = setLastIndex(p.thisThis.lastIndex, p.thisThis.sticky, parserResult);
	  return result;
	};
	/* search forward from lastIndex looking for a match */
	exec.testForward = function testForward(p) {
	  const parserResult = forward(p);
	  p.thisThis.lastIndex = setLastIndex(p.thisThis.lastIndex, p.thisThis.global, parserResult);
	  return parserResult.success;
	};
	/* test for a match at lastIndex only, do not look further if no match is found */
	exec.testAnchor = function testAnchor(p) {
	  const parserResult = anchor(p);
	  p.thisThis.lastIndex = setLastIndex(p.thisThis.lastIndex, p.thisThis.sticky, parserResult);
	  return parserResult.success;
	};
	return exec;
}

var replace = {};

var replaceGrammar;
var hasRequiredReplaceGrammar;

function requireReplaceGrammar () {
	if (hasRequiredReplaceGrammar) return replaceGrammar;
	hasRequiredReplaceGrammar = 1;
	// copyright: Copyright (c) 2024 Lowell D. Thomas, all rights reserved<br>
	//   license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)<br>
	//
	// Generated by apg-js, Version 4.4.0 [apg-js](https://github.com/ldthomas/apg-js)
	replaceGrammar = function grammar(){
	  // ```
	  // SUMMARY
	  //      rules = 11
	  //       udts = 0
	  //    opcodes = 39
	  //        ---   ABNF original opcodes
	  //        ALT = 4
	  //        CAT = 4
	  //        REP = 4
	  //        RNM = 12
	  //        TLS = 7
	  //        TBS = 2
	  //        TRG = 6
	  //        ---   SABNF superset opcodes
	  //        UDT = 0
	  //        AND = 0
	  //        NOT = 0
	  //        BKA = 0
	  //        BKN = 0
	  //        BKR = 0
	  //        ABG = 0
	  //        AEN = 0
	  // characters = [10 - 65535]
	  // ```
	  /* OBJECT IDENTIFIER (for internal parser use) */
	  this.grammarObject = 'grammarObject';

	  /* RULES */
	  this.rules = [];
	  this.rules[0] = { name: 'rule', lower: 'rule', index: 0, isBkr: false };
	  this.rules[1] = { name: 'error', lower: 'error', index: 1, isBkr: false };
	  this.rules[2] = { name: 'escape', lower: 'escape', index: 2, isBkr: false };
	  this.rules[3] = { name: 'match', lower: 'match', index: 3, isBkr: false };
	  this.rules[4] = { name: 'prefix', lower: 'prefix', index: 4, isBkr: false };
	  this.rules[5] = { name: 'suffix', lower: 'suffix', index: 5, isBkr: false };
	  this.rules[6] = { name: 'xname', lower: 'xname', index: 6, isBkr: false };
	  this.rules[7] = { name: 'name', lower: 'name', index: 7, isBkr: false };
	  this.rules[8] = { name: 'alpha', lower: 'alpha', index: 8, isBkr: false };
	  this.rules[9] = { name: 'digit', lower: 'digit', index: 9, isBkr: false };
	  this.rules[10] = { name: 'any-other', lower: 'any-other', index: 10, isBkr: false };

	  /* UDTS */
	  this.udts = [];

	  /* OPCODES */
	  /* rule */
	  this.rules[0].opcodes = [];
	  this.rules[0].opcodes[0] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[0].opcodes[1] = { type: 2, children: [2,4] };// CAT
	  this.rules[0].opcodes[2] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[0].opcodes[3] = { type: 4, index: 10 };// RNM(any-other)
	  this.rules[0].opcodes[4] = { type: 3, min: 0, max: 1 };// REP
	  this.rules[0].opcodes[5] = { type: 1, children: [6,7,8,9,10,11] };// ALT
	  this.rules[0].opcodes[6] = { type: 4, index: 2 };// RNM(escape)
	  this.rules[0].opcodes[7] = { type: 4, index: 3 };// RNM(match)
	  this.rules[0].opcodes[8] = { type: 4, index: 4 };// RNM(prefix)
	  this.rules[0].opcodes[9] = { type: 4, index: 5 };// RNM(suffix)
	  this.rules[0].opcodes[10] = { type: 4, index: 6 };// RNM(xname)
	  this.rules[0].opcodes[11] = { type: 4, index: 1 };// RNM(error)

	  /* error */
	  this.rules[1].opcodes = [];
	  this.rules[1].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[1].opcodes[1] = { type: 7, string: [36] };// TLS
	  this.rules[1].opcodes[2] = { type: 4, index: 10 };// RNM(any-other)

	  /* escape */
	  this.rules[2].opcodes = [];
	  this.rules[2].opcodes[0] = { type: 7, string: [36,36] };// TLS

	  /* match */
	  this.rules[3].opcodes = [];
	  this.rules[3].opcodes[0] = { type: 7, string: [36,38] };// TLS

	  /* prefix */
	  this.rules[4].opcodes = [];
	  this.rules[4].opcodes[0] = { type: 7, string: [36,96] };// TLS

	  /* suffix */
	  this.rules[5].opcodes = [];
	  this.rules[5].opcodes[0] = { type: 7, string: [36,39] };// TLS

	  /* xname */
	  this.rules[6].opcodes = [];
	  this.rules[6].opcodes[0] = { type: 2, children: [1,2,3] };// CAT
	  this.rules[6].opcodes[1] = { type: 7, string: [36,123] };// TLS
	  this.rules[6].opcodes[2] = { type: 4, index: 7 };// RNM(name)
	  this.rules[6].opcodes[3] = { type: 7, string: [125] };// TLS

	  /* name */
	  this.rules[7].opcodes = [];
	  this.rules[7].opcodes[0] = { type: 2, children: [1,2] };// CAT
	  this.rules[7].opcodes[1] = { type: 4, index: 8 };// RNM(alpha)
	  this.rules[7].opcodes[2] = { type: 3, min: 0, max: Infinity };// REP
	  this.rules[7].opcodes[3] = { type: 1, children: [4,5,6,7] };// ALT
	  this.rules[7].opcodes[4] = { type: 4, index: 8 };// RNM(alpha)
	  this.rules[7].opcodes[5] = { type: 4, index: 9 };// RNM(digit)
	  this.rules[7].opcodes[6] = { type: 6, string: [45] };// TBS
	  this.rules[7].opcodes[7] = { type: 6, string: [95] };// TBS

	  /* alpha */
	  this.rules[8].opcodes = [];
	  this.rules[8].opcodes[0] = { type: 1, children: [1,2] };// ALT
	  this.rules[8].opcodes[1] = { type: 5, min: 97, max: 122 };// TRG
	  this.rules[8].opcodes[2] = { type: 5, min: 65, max: 90 };// TRG

	  /* digit */
	  this.rules[9].opcodes = [];
	  this.rules[9].opcodes[0] = { type: 5, min: 48, max: 57 };// TRG

	  /* any-other */
	  this.rules[10].opcodes = [];
	  this.rules[10].opcodes[0] = { type: 1, children: [1,2,3] };// ALT
	  this.rules[10].opcodes[1] = { type: 5, min: 32, max: 35 };// TRG
	  this.rules[10].opcodes[2] = { type: 5, min: 37, max: 65535 };// TRG
	  this.rules[10].opcodes[3] = { type: 5, min: 10, max: 13 };// TRG

	  // The `toString()` function will display the original grammar file(s) that produced these opcodes.
	  this.toString = function toString(){
	    let str = "";
	    str += ";\n";
	    str += "; SABNF grammar for parsing out the replacement string parameters\n";
	    str += ";\n";
	    str += "rule = *(*any-other [(escape / match / prefix/ suffix/ xname / error)])\n";
	    str += "error = \"$\" any-other\n";
	    str += "escape = \"$$\"\n";
	    str += "match  = \"$&\"\n";
	    str += "prefix = \"$`\"\n";
	    str += "suffix = \"$'\"\n";
	    str += "xname = \"${\" name \"}\"\n";
	    str += "name = alpha *(alpha/digit/%d45/%d95)\n";
	    str += "alpha = %d97-122 / %d65-90\n";
	    str += "digit = %d48-57\n";
	    str += "any-other = %x20-23 / %x25-FFFF / %xA-D\n";
	    return str;
	  };
	};
	return replaceGrammar;
}

/* eslint-disable new-cap */

var parseReplacement;
var hasRequiredParseReplacement;

function requireParseReplacement () {
	if (hasRequiredParseReplacement) return parseReplacement;
	hasRequiredParseReplacement = 1;

	const errorName = 'apgex: replace(): ';
	const synError = function synError(result, chars, phraseIndex, data) {
	  if (data.isMatch(result.state)) {
	    const value = data.charsToString(chars, phraseIndex, result.phraseLength);
	    data.items.push({ type: 'error', index: phraseIndex, length: result.phraseLength, error: value });
	    data.errors += 1;
	    data.count += 1;
	  }
	};
	const synEscape = function synExcape(result, chars, phraseIndex, data) {
	  if (data.isMatch(result.state)) {
	    data.items.push({ type: 'escape', index: phraseIndex, length: result.phraseLength });
	    data.escapes += 1;
	    data.count += 1;
	  }
	};
	const synMatch = function synMatch(result, chars, phraseIndex, data) {
	  if (data.isMatch(result.state)) {
	    data.items.push({ type: 'match', index: phraseIndex, length: result.phraseLength });
	    data.matches += 1;
	    data.count += 1;
	  }
	};
	const synPrefix = function synPrefix(result, chars, phraseIndex, data) {
	  if (data.isMatch(result.state)) {
	    data.items.push({ type: 'prefix', index: phraseIndex, length: result.phraseLength });
	    data.prefixes += 1;
	    data.count += 1;
	  }
	};
	const synSuffix = function synSuffix(result, chars, phraseIndex, data) {
	  if (data.isMatch(result.state)) {
	    data.items.push({ type: 'suffix', index: phraseIndex, length: result.phraseLength });
	    data.suffixes += 1;
	    data.count += 1;
	  }
	};
	const synXName = function synXName(result, chars, phraseIndex, data) {
	  if (data.isMatch(result.state)) {
	    data.items.push({ type: 'name', index: phraseIndex, length: result.phraseLength, name: data.name });
	    data.names += 1;
	    data.count += 1;
	  }
	};
	const synName = function synName(result, chars, phraseIndex, data) {
	  if (data.isMatch(result.state)) {
	    const nameStr = data.charsToString(chars, phraseIndex, result.phraseLength);
	    const nameChars = chars.slice(phraseIndex, phraseIndex + result.phraseLength);
	    data.name = { nameString: nameStr, nameChars };
	  }
	};
	parseReplacement = function parseReplacement(p, str) {
	  const grammar = new (requireReplaceGrammar())();
	  const apglib = requireNodeExports$1();
	  const parser = new apglib.parser();
	  const data = {
	    name: '',
	    count: 0,
	    errors: 0,
	    escapes: 0,
	    prefixes: 0,
	    matches: 0,
	    suffixes: 0,
	    names: 0,
	    isMatch: p.match,
	    charsToString: apglib.utils.charsToString,
	    items: [],
	  };
	  parser.callbacks.error = synError;
	  parser.callbacks.escape = synEscape;
	  parser.callbacks.prefix = synPrefix;
	  parser.callbacks.match = synMatch;
	  parser.callbacks.suffix = synSuffix;
	  parser.callbacks.xname = synXName;
	  parser.callbacks.name = synName;
	  const chars = apglib.utils.stringToChars(str);
	  const result = parser.parse(grammar, 0, chars, data);
	  if (!result.success) {
	    throw new Error(`${errorName}unexpected error parsing replacement string`);
	  }
	  const ret = data.items;
	  if (data.errors > 0) {
	    let msg = '[';
	    let i = 0;
	    let e = 0;
	    for (; i < data.items.length; i += 1) {
	      const item = data.items[i];
	      if (item.type === 'error') {
	        if (e > 0) {
	          msg += `, ${item.error}`;
	        } else {
	          msg += item.error;
	        }
	        e += 1;
	      }
	    }
	    msg += ']';
	    throw new Error(`${errorName}special character sequences ($...) errors: ${msg}`);
	  }
	  if (data.names > 0) {
	    const badNames = [];
	    let i = 0;
	    for (; i < data.items.length; i += 1) {
	      const item = data.items[i];
	      if (item.type === 'name') {
	        const name = item.name.nameString;
	        const lower = name.toLowerCase();
	        if (!p.parser.ast.callbacks[lower]) {
	          /* name not in callback list, either a bad rule name or an excluded rule name */
	          badNames.push(name);
	        }
	        /* convert all item rule names to lower case */
	        item.name.nameString = lower;
	      }
	    }
	    if (badNames.length > 0) {
	      let msg = '[';
	      for (let ii = 0; ii < badNames.length; ii += 1) {
	        if (ii > 0) {
	          msg += `, ${badNames[ii]}`;
	        } else {
	          msg += badNames[ii];
	        }
	      }
	      msg += ']';
	      throw new Error(`${errorName}special character sequences \${name}: names not found: ${msg}`);
	    }
	  }
	  return ret;
	};
	return parseReplacement;
}

/* eslint-disable no-restricted-syntax */

var hasRequiredReplace;

function requireReplace () {
	if (hasRequiredReplace) return replace;
	hasRequiredReplace = 1;

	const errorName = 'apg-exp: replace(): ';
	const parseReplacementString = requireParseReplacement();
	/* replace special replacement patterns, `$&`, etc. */
	const generateReplacementString = function generateReplacementString(p, rstr, items) {
	  const exp = p.thisThis;
	  if (items.length === 0) {
	    /* no special characters in the replacement string */
	    /* just return a copy of the replacement string */
	    return rstr;
	  }
	  let replace = rstr.slice(0);
	  let first;
	  let last;
	  let ruleName;
	  items.reverse();
	  items.forEach((item) => {
	    first = replace.slice(0, item.index);
	    last = replace.slice(item.index + item.length);
	    switch (item.type) {
	      case 'escape':
	        replace = first.concat('$', last);
	        break;
	      case 'prefix':
	        replace = first.concat(exp.leftContext, last);
	        break;
	      case 'match':
	        replace = first.concat(exp.lastMatch, last);
	        break;
	      case 'suffix':
	        replace = first.concat(exp.rightContext, last);
	        break;
	      case 'name':
	        /* If there are multiple matches to this rule name, only the last is used */
	        /* If this is a problem, modify the grammar and use different rule names for the different places. */
	        ruleName = p.ruleNames[item.name.nameString];
	        replace = first.concat(exp.rules[ruleName], last);
	        break;
	      default:
	        throw new Error(`${errorName}generateREplacementString(): unrecognized item type: ${item.type}`);
	    }
	  });
	  return replace;
	};
	/* creates a special object with the apg-exp object's "last match" properites */
	const lastObj = function lastObj(exp) {
	  const obj = {};
	  obj.ast = exp.ast;
	  obj.input = exp.input;
	  obj.leftContext = exp.leftContext;
	  obj.lastMatch = exp.lastMatch;
	  obj.rightContext = exp.rightContext;
	  // eslint-disable-next-line no-underscore-dangle
	  obj.$_ = exp.input;
	  obj['$`'] = exp.leftContext;
	  obj['$&'] = exp.lastMatch;
	  obj["$'"] = exp.rightContext;
	  obj.rules = [];
	  // eslint-disable-next-line no-restricted-syntax
	  // eslint-disable-next-line guard-for-in
	  for (const name in exp.rules) {
	    const el = `\${${name}}`;
	    obj[el] = exp[el];
	    obj.rules[name] = exp.rules[name];
	  }
	  return obj;
	};
	/* call the user's replacement function for a single pattern match */
	const singleReplaceFunction = function singleReplaceFunction(p, ostr, func) {
	  const result = p.thisThis.exec(ostr);
	  if (result === null) {
	    return ostr;
	  }
	  const rstr = func(result, lastObj(p.thisThis));
	  const ret = p.thisThis.leftContext.concat(rstr, p.thisThis.rightContext);
	  return ret;
	};
	/* call the user's replacement function to replace all pattern matches */
	const globalReplaceFunction = function globalReplaceFunction(p, ostr, func) {
	  const exp = p.thisThis;
	  let retstr = ostr.slice(0);
	  const TRUE = true;
	  while (TRUE) {
	    const result = exp.exec(retstr);
	    if (result === null) {
	      break;
	    }
	    const newrstr = func(result, lastObj(exp));
	    retstr = exp.leftContext.concat(newrstr, exp.rightContext);
	    exp.lastIndex = exp.leftContext.length + newrstr.length;
	    if (result[0].length === 0) {
	      /* an empty string IS a match and is replaced */
	      /* but use "bump-along" mode to prevent infinite loop */
	      exp.lastIndex += 1;
	    }
	  }
	  return retstr;
	};
	/* do a single replacement with the caller's replacement string */
	const singleReplaceString = function singleReplaceString(p, ostr, rstr) {
	  const exp = p.thisThis;
	  const result = exp.exec(ostr);
	  if (result === null) {
	    return ostr;
	  }
	  const ritems = parseReplacementString(p, rstr);
	  const rep = generateReplacementString(p, rstr, ritems);
	  const ret = exp.leftContext.concat(rep, exp.rightContext);
	  return ret;
	};
	/* do a global replacement of all matches with the caller's replacement string */
	const globalReplaceString = function globalReplaceString(p, ostr, rstr) {
	  const exp = p.thisThis;
	  let retstr = ostr.slice(0);
	  let ritems = null;
	  const TRUE = true;
	  while (TRUE) {
	    const result = exp.exec(retstr);
	    if (result == null) {
	      break;
	    }
	    if (ritems === null) {
	      ritems = parseReplacementString(p, rstr);
	    }
	    const newrstr = generateReplacementString(p, rstr, ritems);
	    retstr = exp.leftContext.concat(newrstr, exp.rightContext);
	    exp.lastIndex = exp.leftContext.length + newrstr.length;
	    if (result[0].length === 0) {
	      /* an empty string IS a match and is replaced */
	      /* but use "bump-along" mode to prevent infinite loop */
	      exp.lastIndex += 1;
	    }
	  }
	  return retstr;
	};
	/* the replace() function calls this to replace the matched patterns with a string */
	replace.replaceString = function replaceString(p, str, replacement) {
	  if (p.thisThis.global || p.thisThis.sticky) {
	    return globalReplaceString(p, str, replacement);
	  }
	  return singleReplaceString(p, str, replacement);
	};
	/* the replace() function calls this to replace the matched patterns with a function */
	replace.replaceFunction = function replaceFunction(p, str, func) {
	  if (p.thisThis.global || p.thisThis.sticky) {
	    return globalReplaceFunction(p, str, func);
	  }
	  return singleReplaceFunction(p, str, func);
	};
	return replace;
}

var split = {};

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var hasRequiredSplit;

function requireSplit () {
	if (hasRequiredSplit) return split;
	hasRequiredSplit = 1;
	// This module implements the `split()` function.
	/* called by split() to split the string */
	split.split = function exportsSplit(p, str, limit) {
	  'use strict;';

	  const exp = p.thisThis;
	  let result;
	  let beg;
	  let end;
	  let last;
	  const phrases = [];
	  const splits = [];
	  let count = 0;
	  exp.lastIndex = 0;
	  const TRUE = true;
	  while (TRUE) {
	    last = exp.lastIndex;
	    result = exp.exec(str);
	    if (result === null) {
	      break;
	    }
	    phrases.push({
	      phrase: result[0],
	      index: result.index,
	    });
	    /* ignore flags, uses bump-along mode (increment one character on empty string matches) */
	    if (result[0].length === 0) {
	      exp.lastIndex = last + 1;
	    } else {
	      exp.lastIndex = result.index + result[0].length;
	    }
	    count += 1;
	    if (count > limit) {
	      break;
	    }
	  }
	  if (phrases.length === 0) {
	    /* no phrases found, return array with the original string */
	    return [str.slice(0)];
	  }
	  if (phrases.length === 1 || phrases[0].phrase.length === str.length) {
	    /* one phrase found and it is the entire string */
	    return [''];
	  }
	  /* first segment, if any */
	  if (phrases[0].index > 0) {
	    beg = 0;
	    end = phrases[0].index;
	    splits.push(str.slice(beg, end));
	  }
	  /* middle segments, if any */
	  const endi = phrases.length - 1;
	  for (let i = 0; i < endi; i += 1) {
	    beg = phrases[i].index + phrases[i].phrase.length;
	    end = phrases[i + 1].index;
	    splits.push(str.slice(beg, end));
	  }
	  /* last segment, if any */
	  last = phrases[phrases.length - 1];
	  beg = last.index + last.phrase.length;
	  if (beg < str.length) {
	    end = str.length;
	    splits.push(str.slice(beg, end));
	  }
	  return splits;
	};
	return split;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var flags;
var hasRequiredFlags;

function requireFlags () {
	if (hasRequiredFlags) return flags;
	hasRequiredFlags = 1;
	// This module analyzes the flags string, setting the true/false flags accordingly.
	flags = function exportFlags(obj, flags) {
	  'use strict;';

	  const errorName = 'apg-exp: constructor: flags: ';
	  let error = null;
	  const readonly = {
	    writable: false,
	    enumerable: false,
	    configurable: true,
	  };
	  /* defaults - all flags default to false */
	  /* set to true only if they appear in the input flags string */
	  obj.flags = '';
	  obj.global = false;
	  obj.sticky = false;
	  obj.unicode = false;
	  obj.debug = false;
	  const TRUE = true;
	  while (TRUE) {
	    /* validation */
	    if (typeof flags === 'undefined' || flags === null) {
	      break;
	    }
	    if (typeof flags !== 'string') {
	      error = `${errorName}Invalid flags supplied to constructor: must be null, undefined or string: '${typeof flags}'`;
	      break;
	    }
	    if (flags === '') {
	      break;
	    }
	    /* set the flags */
	    const f = flags.toLowerCase().split('');
	    for (let i = 0; i < f.length; i += 1) {
	      switch (f[i]) {
	        case 'd':
	          obj.debug = true;
	          break;
	        case 'g':
	          obj.global = true;
	          break;
	        case 'u':
	          obj.unicode = true;
	          break;
	        case 'y':
	          obj.sticky = true;
	          break;
	        default:
	          error = `${errorName}Invalid flags supplied to constructor: '${flags}'`;
	          return error;
	      }
	    }
	    /* alphabetize the existing flags */
	    if (obj.debug) {
	      obj.flags += 'd';
	    }
	    if (obj.global) {
	      obj.flags += 'g';
	    }
	    if (obj.unicode) {
	      obj.flags += 'u';
	    }
	    if (obj.sticky) {
	      obj.flags += 'y';
	    }
	    break;
	  }
	  /* make flag properties read-only */
	  Object.defineProperty(obj, 'flags', readonly);
	  Object.defineProperty(obj, 'global', readonly);
	  Object.defineProperty(obj, 'debug', readonly);
	  Object.defineProperty(obj, 'unicode', readonly);
	  Object.defineProperty(obj, 'sticky', readonly);
	  return error;
	};
	return flags;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var sabnfGenerator;
var hasRequiredSabnfGenerator;

function requireSabnfGenerator () {
	if (hasRequiredSabnfGenerator) return sabnfGenerator;
	hasRequiredSabnfGenerator = 1;
	// This module parses an input SABNF grammar string into a grammar object.
	// Errors are reported as an array of error message strings.
	// To be called only by the `apg-exp` contructor.
	// ```
	// input - required, a string containing the SABNF grammar
	// errors - required, must be an array
	// ```
	sabnfGenerator = function sabnfGenerator(input) {
	  'use strict;';

	  const Api = requireApi();

	  const errorName = 'apg-exp: generator: ';
	  const result = { obj: null, error: null, text: null, html: null };
	  const grammarTextTitle = 'annotated grammar:\n';
	  const textErrorTitle = 'annotated grammar errors:\n';
	  function resultError(api, resultArg, header) {
	    resultArg.error = header;
	    resultArg.text = grammarTextTitle;
	    resultArg.text += api.linesToAscii();
	    resultArg.text += textErrorTitle;
	    resultArg.text += api.errorsToAscii();
	    resultArg.html = api.linesToHtml();
	    resultArg.html += api.errorsToHtml();
	  }

	  let api;
	  const TRUE = true;
	  while (TRUE) {
	    /* verify the input string - preliminary analysis */
	    try {
	      api = new Api(input);
	      api.scan();
	    } catch (e) {
	      result.error = errorName + e.msg;
	      break;
	    }
	    if (api.errors.length) {
	      resultError(api, result, 'grammar has validation errors');
	      break;
	    }

	    /* syntax analysis of the grammar */
	    api.parse();
	    if (api.errors.length) {
	      resultError(api, result, 'grammar has syntax errors');
	      break;
	    }

	    /* semantic analysis of the grammar */
	    api.translate();
	    if (api.errors.length) {
	      resultError(api, result, 'grammar has semantic errors');
	      break;
	    }

	    /* attribute analysis of the grammar */
	    api.attributes();
	    if (api.errors.length) {
	      resultError(api, result, 'grammar has attribute errors');
	      break;
	    }

	    /* finally, generate a grammar object */
	    result.obj = api.toObject();
	    break;
	  }
	  return result;
	};
	return sabnfGenerator;
}

/* eslint-disable guard-for-in */

var apgExp;
var hasRequiredApgExp;

function requireApgExp () {
	if (hasRequiredApgExp) return apgExp;
	hasRequiredApgExp = 1;
	/* eslint-disable no-restricted-syntax */
	/* eslint-disable new-cap */
	/*  *************************************************************************************
	 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
	 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
	 *   ********************************************************************************* */
	// This is the `apg-exp` object constructor.
	// `apg-exp` functions similarly to the built-in JavaScript `RegExp` pattern matching engine.
	// However, patterns are described with an [SABNF]()
	// syntax and matching is done with an
	// [`apg`](https://github.com/ldthomas/apg-js2) parser.
	//
	// See the user's guide at `./dist/guide/index.html` for complete usage details.
	apgExp = function apgExp(input, flags, nodeHits, treeDepth) {
	  'use strict;';

	  const apglib = requireNodeExports$1();
	  const execFuncs = requireExec();
	  const replaceFuncs = requireReplace();
	  const resultFuncs = requireResult();
	  const splitFuncs = requireSplit();
	  const setFlags = requireFlags();
	  const sabnfGenerator = requireSabnfGenerator();

	  const thisThis = this;
	  const thisFileName = 'apg-exp: ';
	  let errorName = thisFileName;
	  const readonly = {
	    writable: false,
	    enumerable: false,
	    configurable: true,
	  };
	  /* private object data that needs to be passed around to supporting modules */
	  const priv = {
	    thisThis: this,
	    grammarObject: null,
	    ruleNames: [],
	    str: null,
	    chars: null,
	    parser: null,
	    result: null,
	    charsToString: null,
	    match(state) {
	      return state === apglib.ids.MATCH || state === apglib.ids.EMPTY;
	    },
	  };
	  // This is a custom exception object.
	  // Derived from Error, it is named `ApgExpError` and in addition to the error `message`
	  // it has two functions, `toText()` and `toHtml()` which will display the errors
	  // in a user-friendly ASCII text format or HTML format like the formats used by APG.
	  // e. g.
	  // ```
	  // try{
	  //   ...
	  // }catch(e){
	  //   if(e.name === "ApgExpError"){
	  //     console.log(e.toText());
	  //   }else{
	  //     console.log(e.message);
	  //   }
	  // ```
	  // All errors from the constructor and all object functions are reported by throwing an `ApgExpError` Error object.
	  const ApgExpError = function ApgExpError(msg, t, h) {
	    this.message = msg;
	    this.name = 'ApgExpError';
	    const text = t;
	    const html = h;
	    this.toText = function toText() {
	      let ret = '';
	      ret += this.message;
	      ret += '\n';
	      if (text) {
	        ret += text;
	      }
	      return ret;
	    };
	    this.toHtml = function toHtml() {
	      let ret = '';
	      ret += `<h3>${apglib.utils.stringToAsciiHtml(this.message)}</h3>`;
	      ret += '\n';
	      if (html) {
	        ret += html;
	      }
	      return ret;
	    };
	  };
	  ApgExpError.prototype = new Error();

	  /* verifies that all UDT callback functions have been defined */
	  const checkParserUdts = function checkParserUdts() {
	    const udterrors = [];
	    let error = null;
	    for (let i = 0; i < priv.grammarObject.udts.length; i += 1) {
	      const { lower } = priv.grammarObject.udts[i];
	      if (typeof priv.parser.callbacks[lower] !== 'function') {
	        udterrors.push(priv.ruleNames[lower]);
	      }
	    }
	    if (udterrors.length > 0) {
	      error = `undefined UDT callback functions: ${udterrors}`;
	    }
	    return error;
	  };

	  /* the constructor */
	  errorName = `${thisFileName}constructor: `;
	  let error = null;
	  let result = null;
	  try {
	    const TRUE = true;
	    while (TRUE) {
	      /* flags */
	      error = setFlags(this, flags);
	      if (error) {
	        error = new ApgExpError(error);
	        break;
	      }
	      /* grammar object for the defining SABNF grammar */
	      if (typeof input === 'string') {
	        this.source = input;
	        result = sabnfGenerator(input);
	        if (result.error) {
	          error = new ApgExpError(result.error, result.text, result.html);
	          break;
	        }
	        priv.grammarObject = result.obj;
	      } else if (
	        typeof input === 'object' &&
	        typeof input.grammarObject === 'string' &&
	        input.grammarObject === 'grammarObject'
	      ) {
	        priv.grammarObject = input;
	        this.source = priv.grammarObject.toString();
	      } else {
	        error = new ApgExpError(`${thisFileName}invalid SABNF grammar input`);
	        this.source = '';
	        break;
	      }
	      Object.defineProperty(this, 'source', readonly);
	      /* the parser & AST */
	      priv.charsToString = apglib.utils.charsToString;
	      priv.parser = new apglib.parser();
	      this.ast = new apglib.ast();
	      this.trace = this.debug ? new apglib.trace() : null;
	      for (let i = 0; i < priv.grammarObject.rules.length; i += 1) {
	        const rule = priv.grammarObject.rules[i];
	        priv.ruleNames[rule.lower] = rule.name;
	        priv.parser.callbacks[rule.lower] = false;
	        this.ast.callbacks[rule.lower] = true;
	      }
	      for (let i = 0; i < priv.grammarObject.udts.length; i += 1) {
	        const rule = priv.grammarObject.udts[i];
	        priv.ruleNames[rule.lower] = rule.name;
	        priv.parser.callbacks[rule.lower] = false;
	        this.ast.callbacks[rule.lower] = true;
	      }
	      /* nodeHit and treeDepth limits */
	      if (typeof nodeHits === 'number') {
	        this.nodeHits = Math.floor(nodeHits);
	        if (this.nodeHits > 0) {
	          priv.parser.setMaxNodeHits(this.nodeHits);
	        } else {
	          error = new ApgExpError(`${thisFileName}nodeHits must be integer > 0: ${nodeHits}`);
	          this.nodeHits = Infinity;
	          break;
	        }
	      } else {
	        this.nodeHits = Infinity;
	      }
	      if (typeof treeDepth === 'number') {
	        this.treeDepth = Math.floor(treeDepth);
	        if (this.treeDepth > 0) {
	          priv.parser.setMaxTreeDepth(this.treeDepth);
	        } else {
	          error = new ApgExpError(`${thisFileName}treeDepth must be integer > 0: ${treeDepth}`);
	          this.treeDepth = Infinity;
	          break;
	        }
	      } else {
	        this.treeDepth = Infinity;
	      }
	      Object.defineProperty(this, 'nodeHits', readonly);
	      Object.defineProperty(this, 'treeDepth', readonly);
	      /* success */
	      this.lastIndex = 0;
	      break;
	    }
	  } catch (e) {
	    error = new ApgExpError(`${e.name}: ${e.message}`);
	  }
	  if (error) {
	    throw error;
	  }
	  // Find the SABNF-defined pattern in the input string.
	  // Can be called multiple times with the `g` or `y` flags.
	  /* public API */
	  this.exec = function exec(str) {
	    let execResult = null;
	    errorName = `${thisFileName}exec(): `;
	    if (typeof str === 'string') {
	      priv.str = str;
	      priv.chars = apglib.utils.stringToChars(str);
	    } else if (Array.isArray(str)) {
	      priv.str = null;
	      priv.chars = str;
	    } else {
	      return execResult;
	    }
	    priv.parser.ast = this.ast;
	    priv.parser.trace = this.trace;
	    const execError = checkParserUdts();
	    if (execError) {
	      throw new ApgExpError(errorName + execError);
	    }
	    if (this.sticky) {
	      execResult = execFuncs.execAnchor(priv);
	    } else {
	      execResult = execFuncs.execForward(priv);
	    }
	    return execResult;
	  };
	  // Test for a match of the SABNF-defined pattern in the input string.
	  // Can be called multiple times with the `g` or `y` flags.
	  this.test = function test(str) {
	    let testResult = null;
	    errorName = `${thisFileName}test(): `;
	    if (typeof str === 'string') {
	      priv.str = str;
	      priv.chars = apglib.utils.stringToChars(str);
	    } else if (Array.isArray(str)) {
	      priv.str = null;
	      priv.chars = str;
	    } else {
	      return testResult;
	    }
	    priv.parser.ast = null;
	    priv.parser.trace = null;
	    this.ast = null;
	    this.trace = null;
	    const testError = checkParserUdts();
	    if (testError) {
	      throw new ApgExpError(errorName + testError);
	    }
	    if (this.sticky) {
	      testResult = execFuncs.testAnchor(priv);
	    } else {
	      testResult = execFuncs.testForward(priv);
	    }
	    return testResult;
	  };
	  // This is roughly equivalent to the JavaScript string replacement function, `str.replace(regex, replacement)`.
	  // (It follows closely the
	  // [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace) description.)
	  // If the global flag `g` is set, all matched phrases will be replaced,
	  // otherwise, only the first.
	  // If the sticky flag `y` is set, all matched 'consecutive' phrases will be replaced,
	  // otherwise, only the first.
	  // If the unicode flag `u` is set, an exception will be thrown. `replace()` only works on strings, not character code arrays.
	  // The `replacement` string may contain the patterns patterns.
	  // <pre>
	  // <code>
	  // $$ - insert the character $
	  // the escape sequence for the $ character
	  // $&#96; - insert the prefix to the matched pattern
	  // $&#38; - insert the matched pattern
	  // $' - insert the suffix of the matched pattern
	  // ${name} - insert the last match to the rule "name"
	  // </code>
	  // </pre>
	  // `replacement` may also be a user-written function of the form
	  // <pre>
	  // <code>
	  // let replacement = function(result, exp){}
	  // result - the result object from the pattern match
	  // exp - the apg-exp object
	  // </code>
	  // </pre>
	  // There is quite a bit of redundancy here with both the `result` object and the `apg-exp` object being passed to the
	  // replacement function. However, this provides the user with a great deal of flexibility in what might be the
	  // most convenient way to create the replacement. Also, the `apg-exp` object has the AST which is a powerful
	  // translation tool for really tough replacement jobs.
	  this.replace = function replace(str, replacement) {
	    errorName = `${thisFileName}replace(): `;
	    if (this.unicode) {
	      throw new ApgExpError(
	        `${errorName}cannot do string replacement in 'unicode' mode. Insure that 'u' flag is absent.`
	      );
	    }
	    if (typeof str !== 'string') {
	      throw new ApgExpError(`${errorName}input type error: str not a string`);
	    }
	    if (typeof replacement === 'string') {
	      return replaceFuncs.replaceString(priv, str, replacement);
	    }
	    if (typeof replacement === 'function') {
	      return replaceFuncs.replaceFunction(priv, str, replacement);
	    }
	    throw new ApgExpError(`${errorName}input type error: replacement not a string or function`);
	  };
	  // Mimics the JavaScript `String.split(regexp)` function. That is,
	  // `split(str[, limit])` is roughly equivalent to `str.split(regexp[, limit])`
	  // Returns an array of strings.
	  // If `str` is undefined or empty the returned array
	  // contains a single, empty string.
	  // Otherwise, `exp.exec(str)` is called in global mode. If a one or more matched phrases are found, they are removed from the
	  // string
	  // and the substrings are returned in an array.
	  // If no matched phrases are found, the array contains one element consisting of the entire string, `["str"]`.
	  // Empty string matches will split the string and advance `lastIndex` by one character (bump-along mode).
	  // That means, for example, the grammar `rule=""\n` would match the empty string at every character
	  // and an array of all characters would be returned. It would be similar to calling the JavaScript function `str.split("")`.
	  // Unlike the JavaScript function, capturing parentheses (rules) are not spliced into the output string.
	  // An exception is thrown if the unicode flag is set. `split()` works only on strings, not integer arrays of character codes.
	  // If the `limit` argument is used, it must be a positive number and no more than `limit` matches will be returned.
	  this.split = function split(str, limit) {
	    errorName = `${thisFileName}split(): `;
	    if (this.unicode) {
	      throw new ApgExpError(`${errorName}cannot do string split in 'unicode' mode. Insure that 'u' flag is absent.`);
	    }
	    if (str === undefined || str === null || str === '') {
	      return [''];
	    }
	    if (typeof str !== 'string') {
	      throw new ApgExpError(`${errorName}argument must be a string: typeof(arg): ${typeof str}`);
	    }
	    if (typeof limit !== 'number') {
	      // eslint-disable-next-line no-param-reassign
	      limit = Infinity;
	    } else {
	      // eslint-disable-next-line no-param-reassign
	      limit = Math.floor(limit);
	      if (limit <= 0) {
	        throw new ApgExpError(`${errorName}limit must be >= 0: limit: ${limit}`);
	      }
	    }
	    return splitFuncs.split(priv, str, limit);
	  };
	  // Select specific rule/UDT names to include in the result object.
	  // `list` is an array of rule/UDT names to include.
	  // All other names, not in the array, are excluded.
	  // Excluding a rule/UDT name does not affect the operation of any functions,
	  // it simply excludes its phrases from the results.
	  this.include = function include(list) {
	    errorName = `${thisFileName}include(): `;
	    if (list === undefined || list == null || (typeof list === 'string' && list.toLowerCase() === 'all')) {
	      /* set all to true */
	      for (const name in priv.grammarObject.callbacks) {
	        thisThis.ast.callbacks[name] = true;
	      }
	      return;
	    }
	    if (Array.isArray(list)) {
	      /* set all to false */
	      for (const name in priv.grammarObject.callbacks) {
	        thisThis.ast.callbacks[name] = false;
	      }
	      /* then set those in the list to true */
	      for (let i = 0; i < list.length; i += 1) {
	        let l = list[i];
	        if (typeof l !== 'string') {
	          throw new ApgExpError(`${errorName}invalid name type in list`);
	        }
	        l = l.toLowerCase();
	        if (thisThis.ast.callbacks[l] === undefined) {
	          throw new ApgExpError(`${errorName}unrecognized name in list: ${list[i]}`);
	        }
	        thisThis.ast.callbacks[l] = true;
	      }
	      return;
	    }
	    throw new ApgExpError(`${errorName}unrecognized list type`);
	  };
	  // Select specific rule/UDT names to exclude in the result object.
	  // `list` is an array of rule/UDT names to exclude.
	  // All other names, not in the array, are included.
	  // Excluding a rule/UDT name does not affect the operation of any functions,
	  // it simply excludes its phrases from the results.
	  this.exclude = function exclude(list) {
	    errorName = `${thisFileName}exclude(): `;
	    if (list === undefined || list == null || (typeof list === 'string' && list.toLowerCase() === 'all')) {
	      /* set all to false */
	      for (const name in priv.grammarObject.callbacks) {
	        thisThis.ast.callbacks[name] = false;
	      }
	      return;
	    }
	    if (Array.isArray(list)) {
	      /* set all to true */
	      for (const name in priv.grammarObject.callbacks) {
	        thisThis.ast.callbacks[name] = true;
	      }
	      /* then set all in list to false */
	      for (let i = 0; i < list.length; i += 1) {
	        let l = list[i];
	        if (typeof l !== 'string') {
	          throw new ApgExpError(`${errorName}invalid name type in list`);
	        }
	        l = l.toLowerCase();
	        if (thisThis.ast.callbacks[l] === undefined) {
	          throw new ApgExpError(`${errorName}unrecognized name in list: ${list[i]}`);
	        }
	        thisThis.ast.callbacks[l] = false;
	      }
	      return;
	    }
	    throw new ApgExpError(`${errorName}unrecognized list type`);
	  };
	  // Defines a UDT callback function. *All* UDTs appearing in the SABNF phrase syntax must be defined here.
	  // <pre><code>
	  // name - the (case-insensitive) name of the UDT
	  // func - the UDT callback function
	  // </code></pre>
	  this.defineUdt = function defineUdt(name, func) {
	    errorName = `${thisFileName}defineUdt(): `;
	    if (typeof name !== 'string') {
	      throw new ApgExpError(`${errorName}'name' must be a string`);
	    }
	    if (typeof func !== 'function') {
	      throw new ApgExpError(`${errorName}'func' must be a function reference`);
	    }
	    const lowerName = name.toLowerCase();
	    for (let i = 0; i < priv.grammarObject.udts.length; i += 1) {
	      if (priv.grammarObject.udts[i].lower === lowerName) {
	        priv.parser.callbacks[lowerName] = func;
	        return;
	      }
	    }
	    throw new ApgExpError(`${errorName}'name' not a UDT name: ${name}`);
	  };
	  // Estimates the upper bound of the call stack depth for this JavaScript
	  // engine. Taken from [here](http://www.2ality.com/2014/04/call-stack-size.html)
	  this.maxCallStackDepth = function maxCallStackDepth() {
	    try {
	      return 1 + this.maxCallStackDepth();
	    } catch (e) {
	      return 1;
	    }
	  };
	  // Returns the "last match" information in the `apg-exp` object in ASCII text.
	  // Patterned after and similar to the JavaScript
	  // [`RegExp` properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp).
	  this.toText = function toText() {
	    if (this.unicode) ;
	    return resultFuncs.s.expToText(this);
	  };
	  // Returns the "last match" information in the `apg-exp` object formatted as an HTML table.
	  this.toHtml = function toHtml(mode) {
	    if (this.unicode) {
	      /* *see mode definitions above */
	      return resultFuncs.u.expToHtml(this, mode);
	    }
	    return resultFuncs.s.expToHtml(this);
	  };
	  // Same as `toHtml()` except the output is a complete HTML page.
	  this.toHtmlPage = function toHtmlPage(mode) {
	    if (this.unicode) {
	      /* *see mode definitions above */
	      return resultFuncs.u.expToHtmlPage(this, mode);
	    }
	    return resultFuncs.s.expToHtmlPage(this);
	  };
	  /* Returns the SABNF syntax or grammar defining the pattern in ASCII text format. */
	  this.sourceToText = function sourceToText() {
	    return resultFuncs.s.sourceToText(this);
	  };
	  /* Returns the SABNF syntax or grammar defining the pattern in HTML format. */
	  this.sourceToHtml = function sourceToHtml() {
	    return resultFuncs.s.sourceToHtml(this);
	  };
	  /* Returns the SABNF syntax or grammar defining the pattern as a complete HTML page. */
	  this.sourceToHtmlPage = function sourceToHtmlPage() {
	    return resultFuncs.s.sourceToHtmlPage(this);
	  };
	};
	return apgExp;
}

/*  *************************************************************************************
 *   copyright: Copyright (c) 2021 Lowell D. Thomas, all rights reserved
 *     license: BSD-2-Clause (https://opensource.org/licenses/BSD-2-Clause)
 *   ********************************************************************************* */

var apgJs;
var hasRequiredApgJs;

function requireApgJs () {
	if (hasRequiredApgJs) return apgJs;
	hasRequiredApgJs = 1;
	apgJs = {
	  apg: requireApg(),
	  apgConv: requireApgConv(),
	  apgConvApi: requireNodeExports(),
	  apgLib: requireNodeExports$1(),
	  apgApi: requireApi(),
	  apgExp: requireApgExp(),
	};
	return apgJs;
}

var apgJsExports = requireApgJs();
var apgAll = /*@__PURE__*/getDefaultExportFromCjs(apgJsExports);

// Vendor entry point for apg-js (ABNF parser generator).
// Rollup bundles this into vendor/apg-js.js as an ESM module.
const apgApi = apgAll.apgApi;
const apgLib = apgAll.apgLib;

export { apgApi, apgLib };

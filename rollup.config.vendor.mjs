import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import wasm from '@rollup/plugin-wasm';

const browserBuiltinShims = {
  name: 'browser-builtin-shims',
  resolveId(source) {
    if (['fs', 'path', 'stream', 'util'].includes(source)) {
      return `\0browser-builtin-shim:${source}`;
    }
    return null;
  },
  load(id) {
    if (!id.startsWith('\0browser-builtin-shim:')) {
      return null;
    }
    const moduleName = JSON.stringify(id.slice('\0browser-builtin-shim:'.length));
    return `
const unsupported = new Proxy({}, {
  get(_target, property) {
    throw new Error(
      'Node built-in module ' + ${moduleName} +
      ' is unavailable in browsers; attempted to access "' + String(property) + '".'
    );
  },
});

export default unsupported;
`;
  },
};

const plugins = [
  wasm({ targetEnv: 'auto-inline' }),
  json(),
  nodeResolve({ browser: true, preferBuiltins: false }),
  commonjs(),
  browserBuiltinShims,
];

const vendors = [
  ['scripts/iconv-lite-entry.js',        'vendor/iconv-lite.js'],
  ['scripts/he-entry.js',                'vendor/he.js'],
  ['scripts/mime-codec-entry.js',        'vendor/mime-codec.js'],
  ['scripts/rfc4648-entry.js',           'vendor/rfc4648.js'],
  ['scripts/bs58-entry.js',              'vendor/bs58.js'],
  ['scripts/hash-wasm-entry.js',         'vendor/hash-wasm.js'],
  ['scripts/punycode-entry.js',          'vendor/punycode.js'],
  ['scripts/apg-js-entry.js',            'vendor/apg-js.js'],
  ['scripts/nearley-entry.js',           'vendor/nearley.js'],
  ['scripts/peggy-entry.js',             'vendor/peggy.js'],
  ['scripts/nanotar-entry.js',           'vendor/nanotar.js'],
  ['scripts/fflate-entry.js',            'vendor/fflate.js'],
  ['scripts/protobufjs-entry.js',        'vendor/protobufjs.js'],
  ['scripts/asn1js-entry.js',            'vendor/asn1js.js'],
  ['scripts/lz4-entry.js',              'vendor/lz4.js'],
  ['scripts/brotli-entry.js',           'vendor/brotli.js'],
  ['scripts/zstd-entry.js',             'vendor/zstd.js'],
  ['scripts/noble-ciphers-entry.js',    'vendor/noble-ciphers.js'],
];

export default vendors.map(([input, file]) => ({
  input,
  output: { file, format: 'es' },
  plugins,
}));

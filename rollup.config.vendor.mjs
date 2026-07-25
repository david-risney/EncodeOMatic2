import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const plugins = [
  json(),
  nodeResolve({ browser: true, preferBuiltins: false }),
  commonjs(),
];

const vendors = [
  ['scripts/iconv-lite-entry.js',        'vendor/iconv-lite.js'],
  ['scripts/he-entry.js',                'vendor/he.js'],
  ['scripts/mime-codec-entry.js',        'vendor/mime-codec.js'],
  ['scripts/rfc4648-entry.js',           'vendor/rfc4648.js'],
  ['scripts/bs58-entry.js',              'vendor/bs58.js'],
  ['scripts/punycode-entry.js',          'vendor/punycode.js'],
  ['scripts/apg-js-entry.js',            'vendor/apg-js.js'],
  ['scripts/nearley-entry.js',           'vendor/nearley.js'],
  ['scripts/peggy-entry.js',             'vendor/peggy.js'],
];

export default vendors.map(([input, file]) => ({
  input,
  output: { file, format: 'es' },
  plugins,
}));

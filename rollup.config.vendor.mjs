import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'scripts/iconv-lite-entry.js',
  output: {
    file: 'vendor/iconv-lite.js',
    format: 'es',
  },
  plugins: [
    json(),
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
  ],
};

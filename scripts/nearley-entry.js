// Vendor entry point for nearley (BNF-like grammar parser).
// Rollup bundles this into vendor/nearley.js as an ESM module.
import nearley from 'nearley';
import compile from 'nearley/lib/compile.js';
import generate from 'nearley/lib/generate.js';
import bootstrapped from 'nearley/lib/nearley-language-bootstrapped.js';
export { nearley, compile, generate, bootstrapped };

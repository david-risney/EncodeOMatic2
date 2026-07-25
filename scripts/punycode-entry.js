// Vendor entry point for punycode (IDN domain encoding/decoding).
// Rollup bundles this into vendor/punycode.js as an ESM module.
import punycode from 'punycode';
export const { toASCII, toUnicode } = punycode;

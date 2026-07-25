// Vendor entry point for ascii85 (Adobe Ascii85 / Base85 encoding).
// Rollup bundles this into vendor/ascii85.js as an ESM module.
import ascii85Lib from 'ascii85';
export const ascii85Encode = (data, options) => ascii85Lib.encode(data, options);
export const ascii85Decode = (data, options) => ascii85Lib.decode(data, options);

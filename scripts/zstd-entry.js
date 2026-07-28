// Vendor entry point for zstd-wasm (Zstandard decompression library).
// The WASM binary is embedded as base64 in the package.
// Rollup bundles this into vendor/zstd.js as an ESM module.
export { Decompressor } from 'zstd-wasm';

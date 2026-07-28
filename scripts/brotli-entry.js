// Vendor entry point for brotli-wasm (Brotli compression library).
// Uses the pkg.web variant: the brotli_wasm_bg.wasm file must be served at vendor/brotli_wasm_bg.wasm.
// When bundled to vendor/brotli.js, import.meta.url resolves the WASM relative to vendor/.
// Rollup bundles this into vendor/brotli.js as an ESM module.
import init, { compress, decompress } from '../node_modules/brotli-wasm/pkg.web/brotli_wasm.js';
export { compress, decompress };

let initPromise = null;
export function initBrotli() {
  if (!initPromise) initPromise = init();
  return initPromise;
}

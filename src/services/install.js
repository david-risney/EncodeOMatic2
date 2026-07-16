/**
 * install.js — PWA install prompt management.
 *
 * Captures the browser's beforeinstallprompt event so the app can trigger
 * the install dialog at the right moment rather than letting the browser show
 * its own banner.
 */

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

/** Returns the deferred install prompt, or null if unavailable. */
export function getInstallPrompt() {
  return deferredPrompt;
}

/** Clears the stored deferred prompt (call after a successful install). */
export function clearInstallPrompt() {
  deferredPrompt = null;
}

/**
 * Returns true when the app is already running as an installed PWA
 * (standalone or window-controls-overlay display mode, or iOS navigator.standalone).
 */
export function isInstalledPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    navigator.standalone === true
  );
}

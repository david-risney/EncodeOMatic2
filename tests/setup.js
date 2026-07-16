import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => '00000000-0000-4000-8000-000000000000';
}

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (returnValue = '') {
    this.returnValue = returnValue;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

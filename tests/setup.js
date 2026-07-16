import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexDocument = new DOMParser().parseFromString(
  readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'),
  'text/html'
);
for (const template of indexDocument.querySelectorAll('template')) {
  document.head.appendChild(template.cloneNode(true));
}

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => '00000000-0000-4000-8000-000000000000';
}

if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false });
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

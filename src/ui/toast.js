/**
 * Toast notifications.
 *
 * Displays a brief, self-dismissing message at the bottom of the screen.
 */

import { cloneTemplate } from './templates.js';

/**
 * Show a toast notification.
 * @param {string} msg - Message text
 * @param {'success'|'error'|''} [type] - Visual style
 */
export function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = cloneTemplate('toast-template');
  if (type) toast.classList.add(type);
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

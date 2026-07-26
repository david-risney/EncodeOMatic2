/**
 * Drag-to-reorder utilities for pane views.
 *
 * Provides `wireMoveButton` (enable drag via a handle button) and
 * `initDragSort` (dragover handler that reorders children within a container).
 */

/**
 * Wire a drag-handle button to an element so that dragging is only possible
 * when initiated via the button (not by dragging the element directly).
 * @param {HTMLElement} element - The draggable container element
 * @param {HTMLElement} button - The handle button that initiates the drag
 */
export function wireMoveButton(element, button) {
  element.draggable = false;
  button.addEventListener('pointerdown', () => {
    element.draggable = true;
  });
  button.addEventListener('pointerup', () => {
    element.draggable = false;
  });
  button.addEventListener('pointercancel', () => {
    element.draggable = false;
  });
  element.addEventListener('dragstart', () => {
    element.classList.add('dragging');
  });
  element.addEventListener('dragend', () => {
    element.classList.remove('dragging');
    element.draggable = false;
  });
}

/**
 * Return the child element (matching itemSelector, excluding the dragging
 * element) that the dragged item should be inserted before, based on cursor Y.
 * @param {HTMLElement} container
 * @param {string} itemSelector - CSS selector for orderable children
 * @param {number} clientY
 * @returns {HTMLElement|null}
 */
function getDropTarget(container, itemSelector, clientY) {
  const items = [...container.querySelectorAll(`${itemSelector}:not(.dragging)`)];
  let best = null;
  let bestOffset = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const offset = clientY - (rect.top + rect.height / 2);
    if (offset < 0 && offset > bestOffset) {
      bestOffset = offset;
      best = item;
    }
  }
  return best;
}

/**
 * Attach a dragover listener to a container that reorders its children.
 * @param {HTMLElement} container - Scrollable/flex container whose children are reordered
 * @param {string} itemSelector - CSS selector for orderable children (e.g. '.data-view')
 */
export function initDragSort(container, itemSelector) {
  container.addEventListener('dragover', (event) => {
    event.preventDefault();
    const dragging = container.querySelector(`${itemSelector}.dragging`);
    if (!dragging) return;
    const after = getDropTarget(container, itemSelector, event.clientY);
    if (!after) container.appendChild(dragging);
    else if (after !== dragging) container.insertBefore(dragging, after);
  });
}

/**
 * Clones the first element from a declarative template in index.html.
 * @param {string} id
 * @returns {HTMLElement|SVGElement}
 */
export function cloneTemplate(id) {
  const template = document.getElementById(id);
  if (!(template instanceof HTMLTemplateElement)) {
    throw new Error(`Missing UI template: #${id}`);
  }
  const element = template.content.firstElementChild?.cloneNode(true);
  if (!element) {
    throw new Error(`Empty UI template: #${id}`);
  }
  return element;
}

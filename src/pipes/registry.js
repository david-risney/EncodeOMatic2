/**
 * Pipe Registry — maps type names to pipe classes and provides
 * metadata for the "Add Pipe" UI.
 */

import { builtinPipes } from './builtin/index.js';

/** All built-in pipe classes in the desired display order. */
export const ALL_PIPES = [...builtinPipes];

/** Map from typeName string → Pipe class */
export const registry = new Map(
  ALL_PIPES.map(cls => [cls.typeName, cls])
);

/**
 * Get pipe entries grouped by category.
 * @returns {Map<string, {typeName, typeDescription, baseName, categoryDescription, cls}[]>}
 */
export function getPipesByCategory() {
  const groups = new Map();
  for (const cls of ALL_PIPES) {
    const cat = cls.category ?? 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({
      typeName: cls.typeName,
      typeDescription: cls.typeDescription ?? cls.typeName,
      baseName: cls.baseName ?? cls.typeDescription ?? cls.typeName,
      categoryDescription: cls.categoryDescription ?? '',
      cls,
    });
  }
  return groups;
}

/**
 * Create a new instance of a pipe by type name.
 * @param {string} typeName
 * @returns {import('./pipe.js').Pipe|null}
 */
export function createPipe(typeName) {
  const cls = registry.get(typeName);
  if (!cls) return null;
  return new cls();
}

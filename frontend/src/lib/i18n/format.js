/**
 * Pure formatting helpers.
 *
 * Deliberately separate from `get-dictionary.js`: that module is marked
 * `server-only`, so importing it from a test or a Client Component throws by
 * design. These two functions have no reason to be trapped there — a client
 * component needs `interpolate` to render a string with a count in it.
 */

/**
 * Reads a dotted path out of a dictionary.
 *
 * Returns `fallback` rather than undefined so a caller never has to guard the
 * result — a missing path should degrade to readable text, not crash a render.
 */
export function translate(dictionary, path, fallback = '') {
  const value = path
    .split('.')
    .reduce(
      (node, segment) => (node && typeof node === 'object' ? node[segment] : undefined),
      dictionary,
    );

  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);

  return fallback;
}

/**
 * Fills `{placeholders}` in a translated string.
 *
 * Deliberately not the full ICU message format. The pilot needs simple
 * interpolation; pulling in a parser for it would add bundle weight for no
 * benefit, and a sentence needing nested plural forms is a sign the copy wants
 * rewriting rather than a sign the formatter wants extending.
 *
 * A placeholder with no matching value is left in place rather than replaced
 * with "undefined" — a visible `{count}` is an obvious bug report, whereas the
 * string "undefined" reads as content.
 */
export function interpolate(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    values[key] === undefined ? match : String(values[key]),
  );
}
/** @typedef {import('./types.js').JsonValue} JsonValue */

/**
 * @param {unknown} value
 * @returns {value is JsonValue}
 */
export function isJsonValue(value) {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item));
  if (typeof value === 'object') return Object.values(value).every((item) => isJsonValue(item));
  return false;
}

/**
 * Length of the string literal that starts at `start` (including both quotes).
 * @param {string} text
 * @param {number} start
 */
function stringLength(text, start) {
  let index = start + 1;
  while (index < text.length) {
    const char = text.charAt(index);
    if (char === '\\') {
      index += 2;
    } else if (char === '"') {
      return index - start + 1;
    } else {
      index += 1;
    }
  }
  return text.length - start;
}

/**
 * Removes // and block comments outside of string literals.
 * @param {string} text
 */
function stripComments(text) {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text.charAt(index);
    const next = text.charAt(index + 1);
    if (char === '"') {
      const length = stringLength(text, index);
      out += text.slice(index, index + length);
      index += length;
    } else if (char === '/' && next === '/') {
      while (index < text.length && text.charAt(index) !== '\n') index += 1;
    } else if (char === '/' && next === '*') {
      const end = text.indexOf('*/', index + 2);
      index = end === -1 ? text.length : end + 2;
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

/**
 * Removes commas that are directly followed by a closing bracket, outside of string literals.
 * @param {string} text
 */
function stripTrailingCommas(text) {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text.charAt(index);
    if (char === '"') {
      const length = stringLength(text, index);
      out += text.slice(index, index + length);
      index += length;
    } else if (char === ',') {
      let look = index + 1;
      while (/\s/.test(text.charAt(look))) look += 1;
      const following = text.charAt(look);
      if (following !== ']' && following !== '}') out += char;
      index += 1;
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

/**
 * Parses JSON with comments and trailing commas (tsconfig, eslintrc style). Never throws.
 * @param {string} text
 * @returns {import('./types.js').Result<JsonValue>}
 */
export function parseJsonc(text) {
  const clean = stripTrailingCommas(stripComments(text.replace(/^\uFEFF/, '')));
  try {
    const parsed = /** @type {unknown} */ (JSON.parse(clean));
    if (!isJsonValue(parsed)) return { ok: false, error: 'not a JSON value' };
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

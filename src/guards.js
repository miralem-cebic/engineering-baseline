/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
export function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Narrows a string to a member of a closed set without a type assertion.
 * @template {string} T
 * @param {readonly T[]} allowed
 * @param {unknown} value
 * @returns {T | undefined}
 */
export function pick(allowed, value) {
  return allowed.find((candidate) => candidate === value);
}

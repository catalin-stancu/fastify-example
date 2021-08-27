import crypto from 'crypto';
import createFastCloner from 'rfdc';

export const fastClone = createFastCloner({ circles: false, proto: true });

/**
 * Create an insecure short hash from a specified value with MD5
 *
 * @param {string} value what to hash
 * @param {number} modulo - limit size of hash to a number smaller than this
 * @return {number}
 */
export function shortHash(value, modulo = 1000) {
  const hashValue = crypto.createHash('md5')
    .update(value)
    .digest('hex');
  return parseInt(hashValue, 16) % modulo;
}

/**
 * Provide nice alternative to try / catch for sync function calls or
 * async function results i.e. promises.
 * It catches synchronous `error throws` if a function is provided that
 * can potentially throw synchornous errors.
 * It also catches asynchronous promise rejections (if a promise is provided).
 *
 * @param {any} value - value (will be wrapped in a promise if needed)
 *   or promise to await or sync function to call
 * @returns {Promise} [error, resolvedPromise]
 * @example
 * const [err, data] = await to(getDataAsync);
 * if (err) {
 *   // handle err
 * } else {
 *   // process data
 * }
 */
export async function to(value) {
  // Convert synchronous errors
  if (typeof value === 'function') {
    try {
      return [null, value()];
    } catch (err) {
      return [err];
    }
  }

  // Convert promise rejections
  const wrappedPromise = (value?.then && value?.catch)
    ? value
    : Promise.resolve(value);
  return wrappedPromise
    .then(data => [null, data])
    .catch(err => [err]);
}

/**
 * Check if type of input is object
 *
 * @param {object} input - variable to check
 * @returns {boolean} true if input is an object
 */
export function isObject(input) {
  return (typeof input === 'object') && (input !== null);
}

/**
 * Capitalize first letter of a specified string
 *
 * @param {string} string what to capitalize
 * @returns {string}
 */
export function capitalizeFirstLetter(string) {
  return string.charAt(0).toLocaleUpperCase() + string.slice(1);
}

/**
 * Create a hash from a specified value with the specified algorithm
 *
 * @param {string} value what to hash
 * @param {string} algorithm - hash algorithm to use, default MD5
 * @return {string}
 */
export function hashThis(value, algorithm = 'md5') {
  return crypto.createHash(algorithm)
    .update(value)
    .digest('hex');
}
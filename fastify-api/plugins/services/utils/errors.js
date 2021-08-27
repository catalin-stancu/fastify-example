import { STATUS_CODES } from 'http';
import { shortHash } from './functions.js';

const RESERVED_INTERNAL_ERROR_CODES = [0, 902];

/**
 * Normalize HTTP error names to method names
 *
 * @param {string} code - HTTP error code
 * @param {string} description - HTTP error short description
 * @returns {string} normalized HTTP error method names
 */
function normalizeHttpErrorName(code, description) {
  if (code === '414') return 'UriTooLong';
  if (code === '505') return 'HttpVersionNotSupported';

  return description.replace(/[' \-]/g, '');
}

export const httpErrors = {};

Object.keys(STATUS_CODES).forEach(code => {
  if (code < '400' || code > '600') return;

  // Get friendly HTTP error method name
  const methodName = `throw${normalizeHttpErrorName(code, STATUS_CODES[code])}`;

  // Prepare an error throwing method for each possible HTTP error
  httpErrors[methodName] = function makeError(message, options = {}) {
    const errorObj = new Error(message || STATUS_CODES[code]);

    // By default the internal error code is autogenerated as a hash of the
    // message, but it can also be provided in options and thus overwritten
    let internalCode = shortHash(message);
    while (RESERVED_INTERNAL_ERROR_CODES.includes(internalCode)) {
      // Keep trying until we find a non-reserved code
      internalCode += 1;
    }

    // The props can override anything on the error object if needed
    const { justReturnError = false, ...props } = options;
    Object.assign(errorObj, {
      status: Number(code),
      statusCode: code,
      internalCode
    }, props);

    if (justReturnError) {
      return errorObj;
    }

    throw errorObj;
  };
});
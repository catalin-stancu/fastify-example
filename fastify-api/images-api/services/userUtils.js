/**
 * Get user's full name from the provided UUID
 * TODO: Replace random mocked value with external service call when available
 *
 * @param {string} userUuid - uuid of admin user
 * @returns {string}
 * @private
 */
export function getFullName(userUuid) {
  const MOCK_NAMES = [
    'George Popescu',
    'Ion Despescu',
    'Florian Grigore'
  ];

  const deterministicRandomIndex = (userUuid.charCodeAt(0) - 48)
    % MOCK_NAMES.length;

  return MOCK_NAMES[deterministicRandomIndex];
}
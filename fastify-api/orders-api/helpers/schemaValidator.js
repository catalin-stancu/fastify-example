/**
 * Returns a function used to validate a PubSub message
 *
 * @param {Function} validatorCompiler - fastify validatorCompiler
 * @param {Function} getSchema - function to get a schema from fastify
 * @param {Object} logger - fastify logger instance
 * @returns {void}
 */
export function makeSchemaValidator(
  validatorCompiler,
  getSchema,
  logger
) {
  /**
   * Closure around the fastify validator compiler which creates a
   * validator schema based on the provided schema
   *
   * @param {String} schemaName - name of the schema used to validate the message input
   * @returns {function} schemaValidator
  */
  const makeValidator = schemaName => validatorCompiler({
    schema: getSchema(schemaName)
  });

  /**
  * Validator function used to validate a message
  *
  * @param {Object} message - Pub/Sub message
  * @param {Object} payload - message payload
  * @param {String} schemaName - name of the schema used to validate the message input
  * @returns {Boolean}
  */
  function validateMessage(message, payload, schemaName) {
    // Apply schema validation to the input message data
    const schemaValidator = makeValidator(schemaName);

    const validationResult = schemaValidator(payload);
    if (!validationResult) {
    // Don't resend the message, it is clearly a bad request
      message.ack();
      logger.error(payload, 'Error in PubSub Message payload schema: '
      + schemaValidator.errors[0].message);

      return false;
    }
    return true;
  }

  return validateMessage;
}
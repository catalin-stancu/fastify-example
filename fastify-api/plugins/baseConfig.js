import hyperId from 'hyperid';
import Ajv from 'ajv';
import createError from 'fastify-error';
import { fastClone } from './services/utils.js';

// Customize AJV validator instance
// This is done outside `fastify.ajv` option to allow us to validate schemas
// independently of fastify, since it doesn't allow us to access its default
// validator until after server startup (`fastify.validatorCompiler()` is null
// inside plugins, so we set a customized version to be able to access it there)
const ajv = new Ajv({
  // Fastify defaults
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: true,
  nullable: true,
  // Fastify explicitly sets allErrors to `false`
  // because when set to `true`, a DoS attack is possible
  allErrors: false,
  // Other options
  discriminator: true,
  ownProperties: true
});

const globalSchemaStore = {};

// This basically is the same code used in the fastify codebase
// https://github.com/fastify/fastify/blob/main/lib/schemas.js#L2-L45 but the
// library allows us to customize the schemaController as we need
// https://www.fastify.io/docs/latest/Server/#schemacontroller. We want to
// keep the code as similar as possible to prevent any compatibility issues
// so the only thing that changed is the addition of the globalSchemaStore
const schemaController = {
  /**
   * This factory is called whenever `fastify.register()` is called
   * It may receive as input the schemas of the parent context if
   * some schemas has been added
   *
   * @param {object} parentSchemas these schemas will be returned
   *   by the `getSchemas()` method function of the returned `bucket`
   * @returns {function} bucketFactory
   */
  bucket: function factory(parentSchemas) {
    const kFluentSchema = Symbol.for('fluent-schema-object');

    const FST_ERR_SCH_MISSING_ID = createError(
      'FST_ERR_SCH_MISSING_ID',
      'Missing schema $id property'
    );

    const FST_ERR_SCH_ALREADY_PRESENT = createError(
      'FST_ERR_SCH_ALREADY_PRESENT',
      "Schema with id '%s' already declared!"
    );

    const store = parentSchemas || {};

    return {
      /**
       * This function must store the schema added by the user
       * It is invoked when `fastify.addSchema()` is called
       *
       * @param {object} inputSchema - use global / un-encapsulated schema
       *   store if [Symbol.for('schema.isGlobal')] property is true
       * @returns {void}
       */
      add(inputSchema) {
        const isFluentSchema = inputSchema.isFluentSchema
          || inputSchema.isFluentJSONSchema
          || inputSchema[kFluentSchema];
        const rawSchema = isFluentSchema ? inputSchema.valueOf() : inputSchema;

        // Clone the inputSchema so that any references it contains
        // will not be modified by the calling code, for extra security
        const schema = fastClone(rawSchema);

        // Check for missing id
        const id = schema.$id;
        if (!id) {
          throw new FST_ERR_SCH_MISSING_ID();
        }

        const isLocal = inputSchema[Symbol.for('schema.isLocal')];

        // Don't add two schemas with the same ids or duplicate schemas
        if (store[id]) {
          throw new FST_ERR_SCH_ALREADY_PRESENT(id);
        }

        if (!isLocal) {
          // By default we will store everything in the global store since this
          // is the most common use-case. Store exactly what is provided, since
          // this will allow to replace JSON refs since they are so buggy.
          globalSchemaStore[id] = inputSchema;
        }

        // We also need to store the raw schema in the encapsulated store to be
        // used by fastify for serialization and validation
        store[id] = schema;
      },

      /**
       * This function returns the schema stored under `schemaId` from global
       * un-encapsulated schema store since it is not called by fastify internally
       * It is invoked when `fastify.getSchema(id)` is called.
       *
       * @param {string} schemaId - id of schema
       * @returns {object} JSON schema
       */
      getSchema(schemaId) {
        return globalSchemaStore[schemaId];
      },

      /**
       * This function must return all the schemas referenced by the routes
       * schemas' $ref
       *
       * @returns {object} an object where the property is the schema `$id`
       *   and the value is the raw JSON Schema.
       */
      getSchemas() {
        return { ...store };
      }
    };
  }
};

/**
 * Format ajv errors object after a validation into something that can be logged
 * @param {Array<object>} errors - Array of errors from validator
 * @returns {string} formatted error message
 */
function formatAjvErrors(errors) {
  const errorPieces = errors.map(
    ({ keyword, message }) => `[${keyword}] -> ${message}`
  );

  return errorPieces.join('; ');
}

export const baseSetupConfig = {
  ajvFactory: Ajv,
  ajv,
  formatAjvErrors,
  fastClone,
  getFastId: hyperId({ urlSafe: true })
};

// Construct a base fastify server configuration
export const baseServerConfig = {
  ignoreTrailingSlash: true,
  maxParamLength: 200,
  caseSensitive: false,
  bodyLimit: 2 ** 20, // 1MB

  // Prevent prototype poisoning attacks
  onProtoPoisoning: 'error',
  onConstructorPoisoning: 'error',

  return503OnClosing: true,
  pluginTimeout: 10000,

  // HyperId is a faster unique id generator but doesn't adhere to
  // the UUID format, so we won't store hyperIds in the DB, but we
  // can use them when setting a request id
  genReqId: hyperId({ urlSafe: true }),
  requestIdHeader: 'transaction-id',

  // We use the default logger in fastify (pino) because it is optimized
  // for speed as well, and set the log level for important info only
  logger: {
    level: 'info'
  },
  schemaController
};
import fp from 'fastify-plugin';
import S from 'fluent-json-schema';
import path from 'path';
import appConfigObject from '../../appConfig.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin validates configuration variables from different sources
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {function} [opts.formatAjvErrors = JSON.stringify] - function
 *   used to format AJV errors when displayed in an error message, if
 *   you want to override the default `JSON.stringify(ajvErrorsObj)` usage
 * @param {object} opts.appConfig - application configuration object, if
 *   you want to override the default project appConfig.js file contents
 * @returns {Promise<void>}
 * @async
 */
async function loadConfigAsync(fastify, opts) {
  const {
    formatAjvErrors = JSON.stringify,
    appConfig = appConfigObject
  } = opts;

  if (typeof fastify.validatorCompiler !== 'function') {
    throw new Error('The fastify validatorCompiler was not set before '
      + 'registering this plugin');
  }

  // Expose environment variables under `fastify.env` and validate those
  // at startup. We allow extra ENV variables to be present because there
  // will always be other ENV vars set by the running OS, infrastructure, etc.
  const envSchema = S.object()
    .id('#env')
    .prop('NODE_ENV', S.string().enum([
      'development', 'stage', 'production'
    ]).required())
    .prop('PORT', S.number().minimum(1).maximum(2 ** 16 - 1).required())
    .prop('ACCESS_CONTROL_ALLOW_ORIGIN', S.string().required())
    .prop('POSTGRES_HOST', S.string().required())
    .prop('POSTGRES_PORT', S.number().minimum(1).maximum(2 ** 16 - 1).required())
    .prop('POSTGRES_USER', S.string().required())
    .prop('POSTGRES_PASSWORD', S.string().required())
    .prop('POSTGRES_DB', S.string().required())
    .prop('MEMORY_CACHE_HOST', S.string().required())
    .prop('MEMORY_CACHE_PORT', S.number().minimum(1).maximum(2 ** 16 - 1).required())
    .prop('GOOGLE_APPLICATION_CREDENTIALS', S.string().required())
    .prop('BUCKET_NAME', S.string().required())
    .valueOf();

  const envSchemaValidator = fastify.validatorCompiler({ schema: envSchema });
  const envValidationResult = envSchemaValidator(process.env);
  if (!envValidationResult) {
    const formattedErrors = formatAjvErrors(envSchemaValidator.errors);
    throw new Error('Error during ENV schema validation in '
      + `'${moduleName}' plugin: ${formattedErrors}`);
  }

  fastify.decorate('env', process.env);
  fastify.log.info('The ENV variables schemas are all valid and loaded');

  // Expose environment variables under `fastify.appConfig`
  // and validate them at startup

  if (!appConfig) {
    throw new Error('A non-empty appConfig file should be '
      + 'present in the root directory');
  }

  const appConfigSchema = S.object()
    .id('#appConfig')
    // Enforce the additionalProperties() option to notify us if we
    // have some variables that we forgot to add to the schema.
    // https://ajv.js.org/faq.html#why-don-t-additionalproperties-false-errors-display-the-property-name
    .additionalProperties(false)
    .prop('shortName', S.string().maxLength(10).required())
    .prop('appCode', S.string().pattern(/^\d{3}$/).required())
    .prop('ignoreFilesOrFolders', S.string().default('common'))
    .prop('locales', S.object()
      .required()
      .prop('dirName', S.string())
      .prop('defaultLocale', S.string())
      .prop('enabledLanguages', S.array().items(S.string())))
    .prop('jobQueue', S.object()
      .required()
      .prop('name', S.string()))
    .prop('fileRules', S.object()
      .required()
      .prop('naming', S.object()
        .required()
        .prop('match', S.required())
        .prop('replaceWith', S.string().required()))
      .prop('maxFileBytes', S.number().multipleOf(1).minimum(0).required())
      .prop('maxFiles', S.number().multipleOf(1).minimum(0).required())
      .prop('mimeTypes', S.array().items(S.string()).minItems(1).required())
      .prop('supportedImageTypes', S.array().items(S.string()).minItems(1).required())
      .prop('preview', S.object()
        .required()
        .description('Preview viewport resolution variant')
        .prop('width', S.number()
          .required()
          .minimum(1)
          .multipleOf(1))
        .prop('height', S.number()
          .required()
          .minimum(1)
          .multipleOf(1))))
    .valueOf();

  const appConfigSchemaValidator = fastify.validatorCompiler({
    schema: appConfigSchema
  });
  const appConfigValidationResult = appConfigSchemaValidator(appConfig);
  if (!appConfigValidationResult) {
    const { dataPath, message } = appConfigSchemaValidator.errors[0];
    throw new Error('Error during \'appConfig.js\' schema validation in '
      + `'${moduleName}' plugin: ${dataPath} ${message}`);
  }

  fastify.decorate('appConfig', appConfig);
  fastify.log.info('The \'appConfig.js\' variables schemas are valid and loaded');
}

export default fp(loadConfigAsync, {
  name: moduleName
});
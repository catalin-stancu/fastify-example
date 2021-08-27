import fp from 'fastify-plugin';
import { I18n } from 'i18n';

/**
 * This plugin encapsulates the node-i18n i18n library
 * https://github.com/mashpie/i18n-node
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.localesPath - directory with dictionary .json files to load
 * @param {string} opts.defaultLocale - default locale to use if not specified
 *   in request via accept-language header or query param
 * @param {Array<string>} opts.enabledLocales - enabled locales
 * @param {function} opts.missingKeyFn - what to return if a key is missing
 * @param {boolean} opts.updateFiles - if true, the dictionaries will be updated if
 *   a missing key needs to be translated
 * @param {boolean} opts.objectNotation - if true, object notation will be used in
 *   in the dictionaries
 * @param {string} opts.queryParameter - name of query parameter to be used to
 *   specify language in a request alongside the accept-language header
 * @param {string} [opts.namespace = 'default'] - we can have multiple i18n instances
 *   so we have to provide a name to store each one as a property of the i18n
 *   fastify decorator
 * @returns {Promise<void>}
 * @async
 */
async function i18n(fastify, opts) {
  const {
    localesPath,
    defaultLocale = 'ro',
    enabledLocales = ['ro', 'en'],
    missingKeyFn = (locale, value) => value,
    updateFiles = false,
    objectNotation = false,
    queryParameter = 'lang',
    namespace = 'default'
  } = opts;

  // Configure the localization library
  const i18nHelper = new I18n({
    // Setup some locales - other locales default to en silently
    locales: enabledLocales,
    defaultLocale,
    // Directory with translation dictionaries json files
    directory: localesPath,
    // Query parameter to switch locale (ie. /home?lang=ro)
    queryParameter,

    // Hash to specify different aliases for i18n's internal methods
    // to apply on the request/response objects (method -> alias).
    // Note that this will *not* overwrite existing properties with the same name
    api: {
      __: 't', // now req.__ becomes req.t
      __n: 'tn' // and req.__n can be called as req.tn
    },

    updateFiles,
    autoReload: false,
    syncFiles: false,
    objectNotation,

    // Used to alter the behaviour of missing keys e.g. (locale, value) => value
    missingKeyFn,

    // Redirect to fastify logger
    logErrorFn: err => fastify.log.error(`I18n: ${err}`),
    logWarnFn: msg => fastify.log.warn(`I18n: ${msg}`),
    logDebugFn: msg => fastify.log.debug(`I18n: ${msg}`)
  });

  // This allows us to use: `req.t("Invalid request")` in a handler to translate
  // a message by just using the localization methods attached to the request object
  fastify.addHook('onRequest', i18nHelper.init);

  if (fastify.i18n) {
    fastify.i18n[namespace] = i18nHelper;
  } else {
    fastify.decorate('i18n', { [namespace]: i18nHelper });
  }

  fastify.log.info(`I18n helper [${namespace}] loaded`);
}

export default fp(i18n, {
  name: 'i18n'
});
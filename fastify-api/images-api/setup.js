import defaultBaseSetup from 'fastify-global-plugins/baseSetup.js';
import multipart from 'fastify-global-plugins/plugins/multipart.js';
import sequelize from 'fastify-global-plugins/plugins/sequelize.js';
import parseQuery from 'fastify-global-plugins/plugins/parseQuery.js';
import cache from 'fastify-global-plugins/plugins/cache.js';
import jobQueue from 'fastify-global-plugins/plugins/jobQueue.js';
import i18n from 'fastify-global-plugins/plugins/i18n.js';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import validateConfig from './plugins/common/validateConfig.js';

/**
 * Load all public / project-independent plugins here and configure them
 * This is the entry point of the application.
 *
 * The main reason why the entry point is a plugin as well is that we can
 * easily import it in our testing suite or add this application as a
 * sub-component of another Fastify application. The encapsulation system
 * of Fastify will make sure that we are not leaking dependencies and
 * business logic.
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - configuration object
 * @param {function} opts.baseSetup - plugin that sets up the base fastify
 *   functionality. Can be used to override the default `fastify-global-plugins`
 *   one if needed, though not recommended
 * @returns {Promise<void>}
 * @async
 */
export default async function setupAsync(fastify, opts) {
  const { baseSetup = defaultBaseSetup } = opts;

  // Extract variable from CommonJs module since we cannot convert it to ES6
  const require = createRequire(import.meta.url);
  const tableDefsFullPath = require('./.sequelizerc')['models-path'];

  /**
   * Register plugins before autoload in baseSetup
   * `this` is bound to the baseSetup fastify instance
   *
   * @param {object} appConfig - appConfig.js contents
   * @param {object} env - environment variables object
   * @param {object} extraOptions - options passed to autoLoader
   * @returns {Promise<void>}
   */
  async function beforePluginsAutoload(appConfig, env, extraOptions) {
    const { ignoreFilesOrFolders, shortName, locales: localesConfig } = appConfig;
    const { jobQueue: jobQueueConfig } = appConfig;
    const { name: queueName } = jobQueueConfig;
    const { envIsDevelopment } = extraOptions;

    // Set up sequelize ORM and DB connection
    const traceLoggingIsEnabled = envIsDevelopment && (fastify.log.trace !== fastify.log.silent);
    this.register(sequelize, {
      tableDefsFullPath,
      ignoreFilesOrFolders,
      sequelizeOptions: {
        // This is enabled only in development and if the logger is enabled at `trace` log level
        logging: traceLoggingIsEnabled && console.log
      }
    });

    // Set up query parser
    await this.after();
    this.register(parseQuery, {
      nullFilter: this.db?.Sequelize?.literal('FALSE')
    });

    // Set up job queue
    const jobPath = path.join(fileURLToPath(import.meta.url), '../services/resizeGenerator.js');
    this.register(jobQueue, {
      queueName,
      fileName: jobPath
    });

    // Set up caching
    this.register(cache, {
      namespace: shortName,
      redisConfigOverrides: {
        log: this.log,
        port: env.MEMORY_CACHE_PORT,
        host: env.MEMORY_CACHE_HOST,
        showFriendlyErrorStack: envIsDevelopment
        // tls: {
        //   // https://nodejs.org/api/tls.html#tls_tls_connect_options_callback
        //   ca: fs.readFileSync("cert.pem")
        // },
      }
    });

    // Set up project-level i18n plugin
    const {
      dirName: localeDirName,
      defaultLocale,
      enabledLanguages
    } = localesConfig;

    this.register(i18n, {
      localesPath: path.resolve(localeDirName),
      defaultLocale,
      enabledLanguages,
      updateFiles: envIsDevelopment,
      namespace: 'default'
    });

    // Register plugin which handles multipart form data uploads (for file upload)
    fastify.register(multipart, {
      throwFileSizeLimit: false
    });
  }

  // Extend the baseSetup plugin
  fastify.register(baseSetup, {
    validateConfig,
    beforePluginsAutoload,
    ...opts
  });
}
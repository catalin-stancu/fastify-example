/* eslint-disable no-console */
import autoLoad from 'fastify-autoload';
import fp from 'fastify-plugin';
import cors from 'fastify-cors';
import underPressure from 'under-pressure';
import helmet from 'fastify-helmet';
import noCache from 'fastify-disablecache';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as utils from './services/utils.js';
import i18n from './plugins/i18n.js';
import response from './plugins/response.js';
import loadGlobalSchemas from './plugins/loadGlobalSchemas.js';

const CURRENT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load all public / project-independent plugins here and configure them
 * This is a generic entry point for the application.
 *
 * The main reason why the entry point is a plugin as well is that we can
 * easily import it in our testing suite or add this application as a
 * sub-component of another Fastify application. The encapsulation system
 * of Fastify will make sure that we are not leaking dependencies and
 * business logic.
 *
 * For more info, see https://www.fastify.io/docs/latest/Encapsulation/
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - configuration object
 * @param {object} opts.ajv - custom AJV instance to use in fastify schema
 *   validation and serialization
 * @param {function} opts.fastClone - function used for fast cloning an object
 * @param {function} opts.formatAjvErrors - function used to format AJV errors
 *   when displayed in an error message
 * @param {function} opts.validateConfig - plugin to use to validate application
 *   configuration sources e.g. env variables
 * @param {boolean} [opts.enableSecureHeaders = true] - enable helmet plugin
 * @param {boolean} [opts.enableResponse = true] - enable response formatting plugin
 * @param {boolean} [opts.enableCors = true] - enable CORS plugin
 * @param {boolean} [opts.enablePluginAutoLoad = true] - enable local plugins
 *   auto loading (i.e. of all plugins in a project's /plugins directory)
 * @param {boolean} [opts.enableUnderPressure = true] - enable excessive load
 *   detection plugin
 * @param {boolean} [opts.enableInfo = true] - enable logging of extra server
 *   information like detected environment, (and list of all routes / plugins
 *   in development)
 * @param {boolean} [opts.enableGlobalSchemas = true] - enable loading of globally
 *   defined schemas
 * @param {boolean} [opts.enableUtils = true] - enable loading global utils
 * @param {boolean} opts.isProduction - if true will override the env to 'production'
 * @param {boolean} opts.isStage - if true will override the env to 'stage'
 * @param {boolean} opts.isDevelopment - if true will override the env to 'development'
 * @param {function} opts.beforePluginsAutoload - hook executed before plugins
 *   are loaded via `fastify-autload`. It has the following signature:
 *   `async (appConfig, env, downStreamConfigs) => Promise<void>` and its
 *   `this` is set the fastify instance in this baseSetup plugin
 * @param {function} opts.afterPluginsAutoload - hook executed before plugins
 *   are loaded via `fastify-autload`. It has the following signature:
 *   `async (appConfig, env, downStreamConfigs) => Promise<void>` and its
 *   `this` is set the fastify instance in this baseSetup plugin
 * @param {any} opts.[downStreamConfigs] - any extra options will be passed to the
 *   autoload plugin which loads all local plugins in the project that uses this file
 *   which in turn will pass these options to all the loaded plugin in turn
 * @returns {Promise<void>}
 * @async
 */
async function baseSetupAsync(fastify, opts) {
  const {
    ajv,
    fastClone = obj => ({ ...obj }),
    formatAjvErrors
  } = opts;

  const {
    validateConfig = null,
    enableSecureHeaders = true,
    enableResponse = true,
    enableCors = true,
    enablePluginAutoLoad = true,
    enableUnderPressure = true,
    enableInfo = true,
    enableGlobalSchemas = true,
    enableUtils = true,
    isProduction,
    isStage,
    isDevelopment,
    beforePluginsAutoload,
    afterPluginsAutoload,
    appConfig,
    // Don't pass to downstream plugin configs
    // the options specific only to baseConfig
    ...downStreamConfigs
  } = opts;

  // By setting a custom validator compiler we can use any validation library
  // we want and access the `fastify.validatorCompiler()` method even during
  // plugin construction. We can also use a customized AJV instance if the
  // `fastify.ajv` configuration option is not enough when configuring fastify
  if (ajv) {
    fastify.setValidatorCompiler(({ schema }) => {
      // Ajv does not support compiling two schemas with the same
      // id inside the same instance. Therefore if we have already
      // compiled the schema with the given id, we just return it.
      if (schema.$id) {
        const stored = ajv.getSchema(schema.$id);
        if (stored) {
          return stored;
        }
      }

      return ajv.compile(schema);
    });
  }

  if (enableUtils) {
    // Add a copy of the utils exports because the original is not mutable
    // We may want to add other libraries or utilities to the `utils`
    // decorator inside the projects that use `fastify-global-plugins`
    fastify.decorate('utils', { ...utils });
    await fastify.after();
  }

  let envIsProduction = isProduction ?? false;
  let envIsStage = isStage ?? false;
  let envIsDevelopment = isDevelopment ?? true;

  // Validate configuration variables from ENV and `appConfig`
  if (validateConfig) {
    fastify.register(validateConfig, {
      formatAjvErrors,
      appConfig
    });

    // Wait until the `validateConfig` plugin above is loaded so we
    // can have access to the configuration variables needed to configure
    // the plugins below, shared via the `env` and `appConfig` decorators
    await fastify.after();

    // These take their values only if their equivalent options are undefined / null
    envIsProduction = isProduction ?? (fastify.env?.NODE_ENV === 'production');
    envIsStage = isStage ?? (fastify.env?.NODE_ENV === 'stage');
    envIsDevelopment = isDevelopment ?? (fastify.env?.NODE_ENV === 'development');
  }

  Object.assign(downStreamConfigs, {
    envIsProduction,
    envIsStage,
    envIsDevelopment
  });

  // Helper decorator example, will be available only after the plugin is loaded
  // Make these read-only to prevent any down-stream plugin to modify the values
  // fastify.decorate('usefulDecorator', {
  //   /** @returns {string} anything */
  //   getter() { return 'anything'; }
  // });

  // This is a secure configuration for a JSON API, according to Helmet
  // Docs and API Security In Action, Neil Madden, Manning 2020
  // https://www.manning.com/books/api-security-in-action
  if (enableSecureHeaders) {
    fastify.register(noCache);
    fastify.register(helmet, {
      // CSP must be disabled for Swagger UI to work
      contentSecurityPolicy: envIsProduction && {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          sandbox: []
        }
      }
    });
  }

  const {
    appCode = '###',
    ignoreFilesOrFolders = null,
    defaultLocale,
    enabledLanguages
  } = fastify?.appConfig || {};

  if (enableResponse) {
    fastify.register(response, { appCode, envIsProduction });
    await fastify.after();

    // Set up global-plugins-level i18n plugin
    fastify.register(i18n, {
      localesPath: path.resolve(CURRENT_DIRECTORY, './locales'),
      defaultLocale,
      enabledLanguages,
      updateFiles: envIsDevelopment,
      namespace: 'global'
    });
  }

  // Enables the use of CORS in a Fastify application
  // https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
  if (enableCors) {
    fastify.register(cors, {
      origin: fastify.env?.ACCESS_CONTROL_ALLOW_ORIGIN || '',
      optionsSuccessStatus: 200,
      maxAge: 86400
    });
  }

  if (enableGlobalSchemas) {
    fastify.register(loadGlobalSchemas);
  }

  // Execute beforePluginsAutoload hook if present
  if (beforePluginsAutoload) {
    await fastify.after();
    await beforePluginsAutoload.call(
      fastify, fastify.appConfig, fastify.env, downStreamConfigs
    );
    await fastify.after();
  }

  /*
    The /plugins directory should contain all the custom
    project-specific plugins.
    Note that https://github.com/fastify/fastify-autoload
    is an utility that loads all the content from the specified
    folder, even the sub-folders.

    Plugin options priority:
    - By default a copy of config (so that the original cannot
    be modified from down-stream) is passed to every loaded plugin;
    - If you set `plugin.autoload = false;` on the plugin function,
    it will not be loaded;
    - If you set `plugin.autoConfig = obj;` on the plugin function,
    the obj will be passed as the plugin's options;
  */
  if (enablePluginAutoLoad) {
    fastify.register(autoLoad, {
    // We provide the path relative to the CWD (server.js location)
      dir: path.resolve('./plugins'),
      ignorePattern: ignoreFilesOrFolders
        && new RegExp(`^${ignoreFilesOrFolders}(\.js)?$`),
      options: fastClone(downStreamConfigs)
    });
  }

  // Wait until all the plugins are loaded in the autoload registration above.
  // This allows us to use all the decorators defined by them after this point
  // i.e. in the custom health checks performed below, if any
  await fastify.after();

  // Execute afterPluginsAutoload hook if present
  if (afterPluginsAutoload) {
    await afterPluginsAutoload.call(
      fastify, fastify.appConfig, fastify.env, downStreamConfigs
    );
    await fastify.after();
  }

  if (enableResponse) {
    fastify.Response.setI18nHelper(fastify.i18n);
  }

  // This plugin is especially useful if you expect a high load on your
  // application, it measures the process load and returns a 503 if the process
  // is undergoing too much stress. It includes health-check functionality
  // Docs https://github.com/fastify/under-pressure
  if (enableUnderPressure) {
    fastify.register(underPressure, {
      maxEventLoopDelay: 4000,
      maxHeapUsedBytes: 1 * (2 ** 30), // 1 GB
      maxRssBytes: 1 * (2 ** 30), // 1 GB
      maxEventLoopUtilization: 0.98,
      exposeStatusRoute: {
        routeOpts: {
          logLevel: 'debug',
          config: {
            openapi: {
              tags: ['Health-check'],
              description: 'Health-check endpoint to determine if service '
                + 'is ready (booted) and running (using load monitoring metrics)',
              summary: 'Determine micro-service health'
            }
          }
        },
        routeResponseSchemaOpts: {
          timestamp: { type: 'string' }
        },
        url: '/ping'
      },
      /**
       * Add here checks for all services if possible e.g. DB write/read
       * Make sure every field is declared in `routeResponseSchemaOpts` above
       * Response structure must match what the health-check service expects
       * @returns {object} response payload
       */
      healthCheck: async function healthCheck() {
        return {
          // Allows external check that server clock is correct / synced
          timestamp: new Date().toISOString()
        };
      }
    });
  }

  if (enableInfo) {
    fastify.ready(() => {
      fastify.log.info(`Environment is set for ${fastify.env.NODE_ENV}`);

      const packageData = JSON.parse(
        fs.readFileSync(path.resolve(CURRENT_DIRECTORY, './package.json'))
      );
      const { version } = packageData;
      fastify.log.info(`Loaded fastify-global-plugins package version is ${version}`);

      // The route and plugin trees are not displayed correctly in the logger
      // (they use special UTF8 chars) so we must use console.log to avoid
      // seeing garbled characters or using inadequate workarounds like
      // https://github.com/pinojs/pino/blob/master/docs/help.md#windows
      // This is enabled only in development and if the logger is set for `trace` log level
      const logLevelIsTrace = (fastify.log.trace !== fastify.log.silent);
      if (envIsDevelopment && logLevelIsTrace) {
        // Prints the representation of the internal radix tree used by
        // the router, useful for debugging all route paths
        console.log('All registered routes:');
        console.log(fastify.printRoutes());

        // Prints the representation of the internal plugin tree used by
        // avvio (internal ;ib used to order plugin loading), useful for
        // dependencies issues
        console.log('All registered plugins in loading order:');
        console.log(fastify.printPlugins());
      }
    });
  }
}

export default fp(baseSetupAsync, {
  name: 'baseSetup'
});
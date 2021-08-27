import fp from 'fastify-plugin';
import autoLoad from 'fastify-autoload';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin collects handlers for all resources
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.dirName - directory to load handler defining plugins from
 * @returns {Promise<void>}
 * @async
 */
async function loadHandlersAsync(fastify, opts) {
  const { dirName } = opts;
  const { ignoreFilesOrFolders } = fastify.appConfig;
  fastify.decorate('handlers', {});

  if (dirName) {
    fastify.register(autoLoad, {
      // We provide the path relative to the CWD (server.js location)
      dir: path.resolve(dirName),
      ignorePattern: ignoreFilesOrFolders
        && new RegExp(`^${ignoreFilesOrFolders}(\.js)?$`)
    });
  }

  await fastify.after();

  // Gather all available handlers to display them in the log as a check
  const versions = Object.keys(fastify.handlers);
  const handlersList = versions.flatMap(version => {
    const handlersInVersion = fastify.handlers[version];
    return Object.keys(handlersInVersion)
      .map(handler => `[${version}] ${handler}`);
  });
  const loadedHandlers = handlersList.join(', ');
  fastify.log.info(`Loaded handlers: ${loadedHandlers || 'none'}`);
}

export default fp(loadHandlersAsync, {
  name: moduleName,
  dependencies: ['utils', 'instantiateServices', 'decorateRoutes']
});

// These are the default options passed by
// autoloader to the plugin when loading it
export const autoConfig = {
  dirName: './handlers'
};
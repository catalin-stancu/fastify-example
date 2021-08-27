import fp from 'fastify-plugin';
import autoLoad from 'fastify-autoload';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin collects routes for all resources
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.dirName - directory to load route defining plugins from
 * @returns {Promise<void>}
 * @async
 */
async function loadRoutesAsync(fastify, opts) {
  const { dirName } = opts;
  const { ignoreFilesOrFolders } = fastify.appConfig;

  if (dirName) {
    fastify.register(autoLoad, {
      // We provide the path relative to the CWD (server.js location)
      dir: path.resolve(dirName),
      ignorePattern: ignoreFilesOrFolders
        && new RegExp(`^${ignoreFilesOrFolders}(\.js)?$`),
      options: {
        prefix: 'api'
      }
    });
  }

  await fastify.after();
  fastify.log.info('Loaded all routes');
}

export default fp(loadRoutesAsync, {
  name: moduleName,
  dependencies: ['swagger', 'loadSchemas', 'loadHandlers']
});

export const autoConfig = {
  dirName: './routes'
};
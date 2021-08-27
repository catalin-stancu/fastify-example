import fp from 'fastify-plugin';
import autoLoad from 'fastify-autoload';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin collects schemas used across all routes
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.dirName - directory to load schemas defining plugins from
 * @returns {Promise<void>}
 * @async
 */
async function loadSchemasAsync(fastify, opts) {
  const { dirName } = opts;
  const { appConfig: { ignoreFilesOrFolders } } = fastify;

  fastify.decorate('schemaCollections', {});

  // Load global schemas from fastify-global-plugins
  // fastify.register(loadGlobalSchemas, { ...opts });

  // Load all route schemas
  if (dirName) {
    fastify.register(autoLoad, {
      // We provide the path relative to the CWD (server.js location)
      dir: path.resolve(dirName),
      ignorePattern: ignoreFilesOrFolders
        && new RegExp(`^${ignoreFilesOrFolders}(\.js)?$`)
    });
  }
}

export default fp(loadSchemasAsync, {
  name: moduleName
});

export const autoConfig = {
  dirName: './schemas'
};
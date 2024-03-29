import fp from 'fastify-plugin';
import path from 'path';
import importModulesPlugin from 'fastify-global-plugins/plugins/importModules.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin collects services for all resources.
 *
 * Every service file becomes a key in the decorated `services` object and
 * every named export in that file becomes a property with the exported name.
 * Note that default exports can be accessed with the `default` property.
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.dirName - directory to load service defining plugins from
 * @param {function} [opts.importModules = importModulesPlugin] - plugin used
 *   to import files / modules, if you want to override the default one
 * @returns {Promise<void>}
 * @async
 */
async function loadServicesAsync(fastify, opts) {
  const { dirName, importModules = importModulesPlugin } = opts;
  const { ignoreFilesOrFolders } = fastify.appConfig;

  if (dirName) {
    fastify.register(importModules, {
      ignoreFilesOrFolders,
      // We provide the path relative to the CWD (server.js location)
      dir: path.resolve(dirName),
      decoratorName: 'services'
    });
  }

  await fastify.after();
  const loadedServices = Object.keys(fastify.services).join(', ');
  fastify.log.info(`Loaded services: ${loadedServices}`);
}

export default fp(loadServicesAsync, {
  name: moduleName
});

export const autoConfig = {
  dirName: './services'
};
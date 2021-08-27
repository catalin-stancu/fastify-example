import fp from 'fastify-plugin';
import autoLoad from 'fastify-autoload';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin collects hooks for all resources
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.dirName - directory to load hook defining plugins from
 * @returns {Promise<void>}
 * @async
 */
async function loadHooksAsync(fastify, opts) {
  const { dirName } = opts;
  const { ignoreFilesOrFolders } = fastify.appConfig;
  fastify.decorate('hooks', {});

  if (dirName) {
    fastify.register(autoLoad, {
      // We provide the path relative to the CWD (server.js location)
      dir: path.resolve(dirName),
      ignorePattern: ignoreFilesOrFolders
        && new RegExp(`^${ignoreFilesOrFolders}(\.js)?$`)
    });
  }

  await fastify.after();

  // Gather all available hooks to display them in the log as a check
  const versions = Object.keys(fastify.hooks);
  const hooksList = versions.flatMap(version => {
    const hooksInVersion = fastify.hooks[version];
    return Object.keys(hooksInVersion)
      .map(hook => `[${version}] ${hook}`);
  });
  const loadedHooks = hooksList.join(', ');
  fastify.log.info(`Loaded hooks: ${loadedHooks || 'none'}`);
}

export default fp(loadHooksAsync, {
  name: moduleName,
  dependencies: ['utils', 'instantiateServices']
});

// These are the default options passed by
// autoloader to the plugin when loading it
export const autoConfig = {
  dirName: './hooks'
};
import fp from 'fastify-plugin';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin imports all modules from a given directory
 *
 * Every imported module becomes a key in the decorator object and every named
 * export in that file becomes an inner property with the exported name.
 * Note that default exports can be accessed with the `default` property.
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} [opts.ignoreFilesOrFolders = ''] - ignore files or folders
 *   that are equal to this value (for files the .js extension is appended
 *   automatically)
 * @param {string} opts.dir - directory to load modules from
 * @param {string} opts.decoratorName - fastify decorator under which to load
 *   the imported modules as an object with a property for each imported file
 * @returns {Promise<void>}
 * @async
 */
async function importModulesAsync(fastify, opts) {
  const { ignoreFilesOrFolders = '', dir, decoratorName } = opts;

  // Make a list of all available files
  const filesList = fs.readdirSync(dir, { withFileTypes: true })
    .map(dirEntry => path.basename(dirEntry.name))
    .filter(entryName => {
      const [nameWithoutExtension, extension = null] = entryName.split('.');
      return (nameWithoutExtension !== ignoreFilesOrFolders)
        && ((extension === 'js') || (extension === null));
    });

  const filesObj = {};

  // Dynamically load each file file, like an automatic
  // export of everything inside the files directory
  const importFilesPromiseList = filesList.map(async fileName => {
    const [nameWithoutExtension, extension = null] = fileName.split('.');
    // If we import a folder we need to actually import its index.js file
    const indexFile = extension ? '' : 'index.js';

    const filePath = pathToFileURL(path.join(dir, fileName, indexFile));
    const [importError, fileModule] = await fastify.utils.to(import(filePath));

    if (importError) {
      importError.message = `File '${fileName}' could not be loaded. `
        + importError.message;
      throw importError;
    }

    filesObj[nameWithoutExtension] = fileModule;
  });

  await Promise.all(importFilesPromiseList);

  fastify.decorate(decoratorName, filesObj);
}

export default fp(importModulesAsync, {
  name: moduleName
});
import fp from 'fastify-plugin';
import path from 'path';
import UUID from 'uuid';
import difference from 'lodash/difference.js';
import * as userUtils from '../../services/userUtils.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates utility libraries commonly used in
 * this project. If the utils decorator is not already populated
 * by the `fastify-global-plugins` library, it will be setup here
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
async function utilsAsync(fastify) {
  if (!fastify.utils) {
    fastify.decorate('utils', {});
  }

  Object.assign(fastify.utils, {
    UUID,
    userUtils,
    _: {
      difference
    }
    // Add any library or utility here
  });
}

export default fp(utilsAsync, {
  name: moduleName
});
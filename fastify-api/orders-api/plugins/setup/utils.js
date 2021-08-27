import fp from 'fastify-plugin';
import path from 'path';
import { v4 as UUIDv4 } from 'uuid';
import pick from 'lodash/pick.js';

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
    // Add any library or utility here
    uuid: UUIDv4,
    _: {
      pick
    }
  });
}

export default fp(utilsAsync, {
  name: moduleName
});
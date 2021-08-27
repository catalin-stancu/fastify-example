import fp from 'fastify-plugin';
import multipart from 'fastify-multipart';
import { parseFormDataAsync } from '../services/multipart.js';

/**
 * This plugin encapsulates multipart form data parsing
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object to pass to fastify-multipart
 * @returns {Promise<void>}
 * @async
 */
async function cache(fastify, opts = {}) {
  fastify.decorate('multipart', {
    parseFormDataAsync
  });

  fastify.register(multipart, opts);

  fastify.log.info('Multipart helpers ready');
}

export default fp(cache, {
  name: 'multipart'
});
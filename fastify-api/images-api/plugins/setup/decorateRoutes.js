import fp from 'fastify-plugin';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates route schemas related to stack generation
 * These schemas will be modified when the stack generation config
 * changes (updateById, create, deleteById)
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
async function decorateRoutesAsync(fastify) {
  if (!fastify.stackRouteSchemas) {
    fastify.decorate('stackRouteSchemas', {});
  }
  fastify.addHook('onRoute', route => {
    const { method, schema, routePath } = route;
    if (method === 'POST' && routePath === '/entities/stack') {
      fastify.stackRouteSchemas.createStack = schema;
    }
    if (method === 'POST' && routePath === '/entities/upload') {
      fastify.stackRouteSchemas.upload = schema;
    }
  });
}

export default fp(decorateRoutesAsync, {
  name: moduleName
});
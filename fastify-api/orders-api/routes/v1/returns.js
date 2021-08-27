import path from 'path';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin sets up routes related to orders
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function ordersRoutesAsync(fastify) {
  const resourceHandlers = fastify.handlers[version][moduleName];
  const resourceSchemas = fastify.schemaCollections[version][moduleName];

  fastify.get(`/${moduleName}`, {
    schema: resourceSchemas.findMany,
    config: {
      queryParsing: {
        filterEnabledFor: ['increment_id', 'return_type'],
        sortingEnabledFor: ['created_at', 'modified_at', 'return_suffix'],
        filteringIsRequired: false,
        defaultFilter: {},
        defaultSort: [['created_at', 'DESC']]
      }
    }
  }, resourceHandlers.findMany);

  fastify.post(`/orders/:increment_id/${moduleName}`, {
    schema: resourceSchemas.createOne
  }, resourceHandlers.createOne);
}
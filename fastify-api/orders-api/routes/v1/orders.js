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
        filterEnabledFor: ['increment_id', 'client_name', 'status',
          'registered_at', 'created_at', 'modified_at'],
        sortingEnabledFor: ['increment_id', 'client_name', 'status',
          'registered_at', 'created_at', 'modified_at'],
        filteringIsRequired: false,
        defaultFilter: {},
        defaultSort: [['registered_at', 'DESC']]
      }
    }
  }, resourceHandlers.findMany);

  fastify.get(`/${moduleName}/:increment_id`, {
    schema: resourceSchemas.findOne
  }, resourceHandlers.findOne);
}
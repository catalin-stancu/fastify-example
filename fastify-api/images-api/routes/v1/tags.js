import path from 'path';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin sets up routes related to tags
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function tagsRoutesAsync(fastify) {
  const resourceHandlers = fastify.handlers[version][moduleName];
  const resourceSchemas = fastify.schemaCollections[version][moduleName];

  fastify.get(`/${moduleName}`, {
    schema: resourceSchemas.find,
    config: {
      queryParsing: {
        filterEnabledFor: ['uuid', 'name'],
        sortingEnabledFor: ['name'],
        filteringIsRequired: false,
        defaultFilter: {},
        defaultSort: [['name', 'ASC']]
      }
    }
  }, resourceHandlers.findAsync);

  fastify.get(`/${moduleName}/:uuid`, {
    schema: resourceSchemas.findById
  }, resourceHandlers.findByIdAsync);

  fastify.post(`/${moduleName}`, {
    schema: resourceSchemas.create
  }, resourceHandlers.createAsync);

  fastify.delete(`/${moduleName}`, {
    schema: resourceSchemas.bulkDelete,
    config: {
      queryParsing: {
        filterEnabledFor: ['uuid', 'name'],
        filteringIsRequired: true
      }
    }
  }, resourceHandlers.bulkDeleteAsync);

  fastify.delete(`/${moduleName}/:uuid`, {
    schema: resourceSchemas.deleteById
  }, resourceHandlers.deleteByIdAsync);
}
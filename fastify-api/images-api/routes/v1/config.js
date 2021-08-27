import path from 'path';
import { fileURLToPath } from 'url';

const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];
const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This function contains basic CRD operations
 * needed for a generic DAM resource
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function configRoutesAsync(fastify) {
  const resourceHandlers = fastify.handlers[version][moduleName];
  const resourceSchemas = fastify.schemaCollections[version][moduleName];

  fastify.get(`/${moduleName}`, {
    schema: resourceSchemas.find,
    config: {
      queryParsing: {
        filterEnabledFor: ['id'],
        sortingEnabledFor: ['created_by', 'modified_by', 'id'],
        filteringIsRequired: false,
        defaultFilter: {},
        defaultSort: [['id', 'ASC']]
      }
    }
  }, resourceHandlers.findAsync);

  fastify.get(`/${moduleName}/:id`, {
    schema: resourceSchemas.findById
  }, resourceHandlers.findByIdAsync);

  fastify.post(`/${moduleName}`, {
    schema: resourceSchemas.create
  }, resourceHandlers.createAsync);

  fastify.patch(`/${moduleName}/:id`, {
    schema: resourceSchemas.updateById
  }, resourceHandlers.updateByIdAsync);

  fastify.delete(`/${moduleName}/:id`, {
    schema: resourceSchemas.deleteById
  }, resourceHandlers.deleteByIdAsync);

  fastify.delete(`/${moduleName}`, {
    schema: resourceSchemas.bulkDelete,
    config: {
      queryParsing: {
        filterEnabledFor: ['id'],
        filteringIsRequired: true
      }
    }
  }, resourceHandlers.bulkDeleteAsync);
}
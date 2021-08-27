import path from 'path';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin sets up routes related to entities
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 */
export default async function entitiesRoutesAsync(fastify) {
  const filterEnabledFor = [
    'uuid',
    'name',
    'parent',
    'root_uuid',
    'local_path',
    'type',
    'status',
    'modified_by',
    'created_by',
    'bytes',
    'created_at',
    'modified_at',
    'usage',
    'resource_type'
  ];

  const sortingEnabledFor = [
    'name',
    'parent',
    'root_uuid',
    'local_path',
    'type',
    'priority',
    'status',
    'bytes',
    'modified_by',
    'created_by',
    'created_at',
    'modified_at',
    'usage',
    'resource_type'
  ];

  const resourceHandlers = fastify.handlers[version][moduleName];
  const resourceSchemas = fastify.schemaCollections[version][moduleName];

  fastify.get(`/${moduleName}`, {
    schema: resourceSchemas.find,
    config: {
      queryParsing: {
        filterEnabledFor,
        sortingEnabledFor,
        filteringIsRequired: false,
        defaultFilter: {
          status: {
            $eq: 'active'
          }
        },
        defaultSort: [['priority', 'ASC'], ['name', 'ASC']]
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
        filterEnabledFor,
        filteringIsRequired: true
      }
    }
  }, resourceHandlers.bulkDeleteAsync);

  fastify.delete(`/${moduleName}/:uuid`, {
    schema: resourceSchemas.deleteById
  }, resourceHandlers.deleteByIdAsync);
}
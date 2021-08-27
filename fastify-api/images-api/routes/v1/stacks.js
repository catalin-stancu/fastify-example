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

  const resourceHandlers = fastify.handlers[version][moduleName];
  const resourceHooks = fastify.hooks[version][moduleName];
  const resourceSchemas = fastify.schemaCollections[version][moduleName];

  fastify.post(`/${moduleName}`, {
    schema: resourceSchemas.find
  }, resourceHandlers.findAsync);

  fastify.get(`/${moduleName}/:uuid`, {
    schema: resourceSchemas.findById
  }, resourceHandlers.findByIdAsync);

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

  // TODO modify paths for routes below when we implement separate stack handling routes
  // and remove the last one (already there as second from above)
  // TODO: Modify decorateRoutesAsync plugin to use a config instead of URL matching
  // TODO: Move duplicated schemas in single file: see content of files in /schemas/v1

  fastify.post('/entities/upload', {
    schema: resourceSchemas.bulkUpload,
    preValidation: resourceHooks.prepareBulkUpload,
    // This allows us to perform cleanup if a file does not pass schema validation
    attachValidation: true
  }, resourceHandlers.uploadBulkAsync);

  fastify.patch('/entities/:uuid/upload', {
    schema: resourceSchemas.uploadOverride,
    preValidation: resourceHooks.prepareOverride,
    // This allows us to perform cleanup if a file does not pass schema validation
    attachValidation: true
  }, resourceHandlers.uploadOverrideAsync);

  fastify.post('/entities/stack', {
    schema: resourceSchemas.generateStack
  }, resourceHandlers.generateManyAsync);

  fastify.get('/entities/:uuid/urls', {
    schema: resourceSchemas.findById
  }, resourceHandlers.findByIdAsync);
}
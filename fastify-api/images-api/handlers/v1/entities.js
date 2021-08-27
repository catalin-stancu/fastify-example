import path from 'path';
import { fileURLToPath } from 'url';

const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];
const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates entities (files or folders) handlers
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function entitiesHandlersAsync(fastify) {
  const { Response, instantiatedServices } = fastify;
  const { entityCacheService, entityService } = instantiatedServices;

  /**
   * Find all entities in the database
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findAsync(req) {
    req.log.trace(`[${moduleName}]: Searching for entities`);

    const { where, order } = req;
    const {
      limit,
      offset,
      total_count: showTotalItems,
      search_tags_instead: searchTagsInstead
    } = req.query;
    const { search_for: searchFor } = req.query;
    const searchForTrimmed = searchFor?.trim();
    const requestInputs = { where, order, limit, offset, searchFor, showTotalItems };

    const cachedList = await entityCacheService.getListAsync(requestInputs);
    if (cachedList) {
      return cachedList;
    }

    const { output, metadata } = await entityService.getManyAsync(
      showTotalItems, where, order, limit, offset, searchForTrimmed, searchTagsInstead
    );

    const response = new Response(output, metadata);
    // Don't save individual items since we don't want to compute breadcrumbs for
    // each one. That would be needed to be consistent with what findById() caches
    await entityCacheService.saveListAndItemsAsync(requestInputs, response);

    return response;
  }

  /**
   * Find entity based on specified uuid
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findByIdAsync(req) {
    const { uuid } = req.params;
    req.log.trace(`[${moduleName}]: Searching for entity with uuid ${uuid}`);

    const instance = await entityService.getOneAsync(uuid);
    return new Response(instance);
  }

  /**
   * Create a new folder
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function createAsync(req) {
    const data = req.body;
    req.log.trace(`[${moduleName}]: Trying to create new folder`);

    await entityCacheService.invalidateAllListsAsync();

    const createdEntity = await entityService.createOneAsync(data);
    return new Response(createdEntity);
  }

  /**
   * Delete a list of entities based on a search query
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function bulkDeleteAsync(req) {
    const { where } = req;
    req.log.trace(`[${moduleName}]: Trying to delete a list of entities`);
    await entityCacheService.invalidateAllListsAsync();

    const { metadata } = await entityService.deleteManyAsync(where);
    return new Response(null, metadata);
  }

  /**
   * Delete a single instance based on specified uuid
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function deleteByIdAsync(req) {
    const { uuid } = req.params;
    req.log.trace(`[${moduleName}]: Trying to delete instance with uuid ${uuid}`);
    await entityCacheService.invalidateAllListsAsync();

    const { metadata } = await entityService.deleteOneAsync(uuid);
    return new Response(null, metadata);
  }

  if (!fastify.handlers[version]) {
    fastify.handlers[version] = {};
  }

  fastify.handlers[version][moduleName] = {
    findAsync,
    findByIdAsync,
    createAsync,
    bulkDeleteAsync,
    deleteByIdAsync
  };
}
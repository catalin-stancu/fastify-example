import path from 'path';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin encapsulates configuration handlers
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function configHandlersAsync(fastify) {
  const { Response, cache, instantiatedServices } = fastify;
  const { clientWrapper, ChildCacheService } = cache;
  const { configService } = instantiatedServices;

  // Setup child cache service for this resource. Even though they are optional,
  // if we don't await them we can encounter problems when having connection errors
  const configCacheService = new ChildCacheService(
    clientWrapper,
    moduleName,
    idKeys => idKeys.id,
    fastify.log
  );

  /**
   * Find all configurations in the database
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findAsync(req) {
    req.log.trace(`[${moduleName}]: Searching for configurations`);

    const { where, order } = req;
    const { limit, offset, total_count: showTotalItems } = req.query;
    const requestInputs = { where, order, limit, offset, showTotalItems };

    const cachedList = await configCacheService.getListAsync(requestInputs);
    if (cachedList) {
      return cachedList;
    }

    const { output, metadata } = await configService.getManyAsync(
      showTotalItems, where, order, limit, offset
    );
    const response = new Response(output, metadata);
    await configCacheService.saveListAndItemsAsync(requestInputs, response, output);

    return response;
  }

  /**
   * Find configuration based on specified UUID
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findByIdAsync(req) {
    const { id } = req.params;
    req.log.trace(`[${moduleName}]: Searching for configuration with id [${id}]`);

    const cachedItem = await configCacheService.getItemAsync({ id });
    if (cachedItem) {
      return new Response(cachedItem);
    }

    const instance = await configService.getOneAsync(id);
    await configCacheService.saveItemAsync(instance);
    return new Response(instance);
  }

  /**
   * Create a new configuration
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function createAsync(req) {
    const data = req.body;
    req.log.trace(`[${moduleName}]: Trying to create a new configuration`);

    await configCacheService.invalidateAllListsAsync();
    const createdConfiguration = await configService.createOneAsync(data);

    await configCacheService.saveItemAsync(createdConfiguration);
    return new Response(createdConfiguration);
  }

  /**
   * Update configuration
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function updateByIdAsync(req) {
    const data = req.body;
    const { id } = req.params;
    req.log.trace(`[${moduleName}]: Trying to update config row with id [${id}]`);

    await Promise.all([
      configCacheService.invalidateAllLists(),
      configCacheService.invalidateItemOrPattern({ id })
    ]);

    const updatedInstance = await configService.updateOneAsync(id, data);
    return new Response(updatedInstance);
  }

  /**
   * Delete a single configuration based on specified uuid
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function deleteByIdAsync(req) {
    const { id } = req.params;
    req.log.trace(`[${moduleName}]: Trying to delete configuration with id [${id}]`);

    // Invalidate cache for all lists and all items
    await Promise.all([
      configCacheService.invalidateAllListsAsync(),
      configCacheService.invalidateItemOrPatternAsync({ id })
    ]);

    const { metadata } = await configService.deleteOneAsync(id);
    return new Response(null, metadata);
  }

  /**
   * Delete a list of configurations based on a search query
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function bulkDeleteAsync(req) {
    const { where } = req;
    req.log.trace(`[${moduleName}]: Trying to delete a list of configurations`);

    // Invalidate cache for all lists and all items
    await Promise.all([
      configCacheService.invalidateAllListsAsync(),
      configCacheService.invalidateItemOrPatternAsync({ id: '*' })
    ]);

    const { metadata, usedConfigsList } = await configService.deleteManyAsync(where);

    const response = new Response(null, metadata);

    // TODO: add message containing usedConfigsList on response object
    // when addMessage will support parameters for messages

    return response;
  }

  if (!fastify.handlers[version]) {
    fastify.handlers[version] = {};
  }

  fastify.handlers[version][moduleName] = {
    findAsync,
    findByIdAsync,
    createAsync,
    updateByIdAsync,
    bulkDeleteAsync,
    deleteByIdAsync
  };
}
import path from 'path';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin encapsulates tag handlers
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function tagsHandlersAsync(fastify) {
  const { Response, instantiatedServices } = fastify;
  const { tagService, tagCacheService } = instantiatedServices;

  /**
   * Find all tags in the database
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findAsync(req) {
    req.log.trace(`[${moduleName}]: Searching for tags`);

    const { where, order } = req;
    const { limit, offset, total_count: showTotalItems } = req.query;
    const requestInputs = { where, order, limit, offset, showTotalItems };

    const cachedList = await tagCacheService.getListAsync(requestInputs);
    if (cachedList) {
      return cachedList;
    }

    const { output, metadata } = await tagService.getManyAsync(
      showTotalItems, where, order, limit, offset
    );
    const response = new Response(output, metadata);
    await tagCacheService.saveListAndItemsAsync(requestInputs, response, output);

    return response;
  }

  /**
   * Find tag based on specified UUID
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findByIdAsync(req) {
    const { uuid } = req.params;
    req.log.trace(`[${moduleName}]: Searching for order with number ${uuid}`);

    const cachedItem = await tagCacheService.getItemAsync({ uuid });
    if (cachedItem) {
      return new Response(cachedItem);
    }

    const instance = await tagService.getOneAsync(uuid);
    await tagCacheService.saveItemAsync(instance);
    return new Response(instance);
  }

  /**
   * Create a new tag
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function createAsync(req) {
    const data = req.body;
    req.log.trace(`[${moduleName}]: Trying to create a new tag`);

    await tagCacheService.invalidateAllListsAsync();
    const createdTag = await tagService.createOneAsync(data);

    await tagCacheService.saveItemAsync(createdTag);
    return new Response(createdTag);
  }

  /**
   * Delete a list of tags based on a search query
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function bulkDeleteAsync(req) {
    const { where } = req;
    req.log.trace(`[${moduleName}]: Trying to delete a list of tags`);

    // Invalidate cache for all lists and all items
    await Promise.all([
      tagCacheService.invalidateAllListsAsync(),
      tagCacheService.invalidateItemOrPatternAsync({ uuid: '*' })
    ]);

    const { metadata } = await tagService.deleteManyAsync(where);
    return new Response(null, metadata);
  }

  /**
   * Delete a single tag based on specified uuid
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function deleteByIdAsync(req) {
    const { uuid } = req.params;
    req.log.trace(`[${moduleName}]: Trying to delete tag with uuid ${uuid}`);

    // Invalidate cache for all lists and all items
    await Promise.all([
      tagCacheService.invalidateAllListsAsync(),
      tagCacheService.invalidateItemOrPatternAsync({ uuid })
    ]);

    const { metadata } = await tagService.deleteOneAsync(uuid);
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
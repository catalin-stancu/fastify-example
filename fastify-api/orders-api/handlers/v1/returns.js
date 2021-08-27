import path from 'path';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin encapsulates return handlers
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function returnsHandlersAsync(fastify) {
  const { Response, instantiatedServices } = fastify;
  const {
    returnService,
    returnCacheService
  } = instantiatedServices;

  /**
   * Find all instances in the database
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findMany(req) {
    req.log.trace(`[${moduleName}]: Searching for returns`);

    const { where, order } = req;
    const { limit, offset, total_count: showTotalItems } = req.query;
    const requestInputs = { where, order, limit, offset, showTotalItems };

    const cachedList = await returnCacheService.getListAsync(requestInputs);
    if (cachedList) {
      return cachedList;
    }

    const { output, metadata } = await returnService.findManyAsync(requestInputs);
    const response = new Response(output, metadata);
    await returnCacheService.saveListAndItemsAsync(requestInputs, response, output);

    return response;
  }

  /**
   * Create a new return
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function createOne(req) {
    const data = req.body;
    const { increment_id: orderNumber } = req.params;

    req.log.trace(`[${moduleName}]: Trying to create a new return`);

    await returnCacheService.invalidateAllListsAsync();
    const createdReturn = await returnService.createOneAsync(data, orderNumber);

    await returnCacheService.saveItemAsync(createdReturn);
    return new Response(createdReturn);
  }

  if (!fastify.handlers[version]) {
    fastify.handlers[version] = {};
  }

  fastify.handlers[version][moduleName] = {
    findMany,
    createOne
  };
}
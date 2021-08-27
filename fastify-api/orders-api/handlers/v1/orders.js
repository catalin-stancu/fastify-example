import path from 'path';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin encapsulates order handlers
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function ordersHandlersAsync(fastify) {
  const { Response, instantiatedServices } = fastify;
  const {
    orderService,
    orderCacheService
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
    req.log.trace(`[${moduleName}]: Searching for orders`);

    const { where, order } = req;
    const { limit, offset, total_count: showTotalItems, search_for: searchFor } = req.query;
    const explicitOrder = Object.keys(req.query)
      .some(ord => ord.includes('ord['));
    const searchForTrimmed = searchFor?.trim();
    const requestInputs
    = { where, order, limit, offset, showTotalItems, searchForTrimmed, explicitOrder };

    const cachedList = await orderCacheService.getListAsync(requestInputs);
    if (cachedList) {
      return cachedList;
    }

    const { output, metadata } = await orderService.findManyAsync(requestInputs);
    const response = new Response(output, metadata);
    await orderCacheService.saveListAndItemsAsync(requestInputs, response, output);

    return response;
  }

  /**
   * Find instance based on specified order number (increment_id)
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findOne(req) {
    const {
      increment_id: orderNumber
    } = req.params;

    const {
      available_quantities: availableQuantities
    } = req.query;

    if (!availableQuantities) {
      const cachedItem = await orderCacheService.getItemAsync({ orderNumber });
      if (cachedItem) {
        return new Response(cachedItem);
      }
    }

    const instance = await orderService.findOneAsync(orderNumber, availableQuantities);

    if (!availableQuantities) {
      await orderCacheService.saveItemAsync(instance);
    }

    return new Response(instance);
  }

  if (!fastify.handlers[version]) {
    fastify.handlers[version] = {};
  }

  fastify.handlers[version][moduleName] = {
    findMany,
    findOne
  };
}
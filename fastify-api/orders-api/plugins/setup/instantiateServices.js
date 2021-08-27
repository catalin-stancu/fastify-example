import fp from 'fastify-plugin';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
* This plugin encapsulates utility libraries commonly used in
* this project. If the utils decorator is not already populated
* by the `fastify-global-plugins` library, it will be setup here
*
* @param {Fastify} fastify - fastify server instance
* @returns {Promise<void>}
* @async
*/
async function instantiateServicesAsync(fastify) {
  const { services, helpers, utils, db, cache, log, env } = fastify;
  const { BASE_IMAGE_URL } = env;
  const { clientWrapper, ChildCacheService } = cache;
  const {
    orderUtils: { OrderUtils },
    returnUtils: { ReturnUtils },
    orderService: { OrderService },
    returnService: { ReturnService }
  } = services;

  const {
    orderHelper: { OrderHelper }
  } = helpers;

  // Setup child cache service for this resource. Even though they are optional,
  // if we don't await their method calls we can encounter problems when having connection errors
  const orderCacheService = new ChildCacheService(
    clientWrapper,
    'orders',
    idKeys => idKeys.increment_id,
    log
  );

  const returnCacheService = new ChildCacheService(
    clientWrapper,
    'returns',
    ({ increment_id: incrementId,
      return_suffix: returnSuffix }) => `${incrementId}-${returnSuffix}`,
    log
  );

  const orderService = new OrderService(db, log, utils);
  const orderUtils = new OrderUtils(db, log, utils);
  const orderHelper = new OrderHelper(BASE_IMAGE_URL);

  const returnUtils = new ReturnUtils(db, log, utils);
  const returnService = new ReturnService(db, log, utils, returnUtils);

  fastify.decorate('instantiatedServices', {
    orderUtils,
    orderService,
    orderHelper,
    orderCacheService,
    returnService,
    returnUtils,
    returnCacheService
  });
}

export default fp(instantiateServicesAsync, {
  name: moduleName,
  dependencies: ['loadServices', 'loadHelpers']
});
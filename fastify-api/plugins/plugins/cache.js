import fp from 'fastify-plugin';
import { EventEmitter } from 'events';
import redisClientFactory from '../services/cache/redisClientFactory.js';
import ClientWrapper from '../services/cache/clientWrapper.js';
import ChildCacheService from '../services/cache/childCacheService.js';

/**
 * This plugin encapsulates API caching
 * If the connection with the caching server is down, the application
 * should work normally (but without caching) i.e. without throwing errors
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {object} opts.redisClient - redis client instance to use
 * @param {object} opts.redisConfigOverrides - redis client configuration options
 * @param {string} opts.namespace - namespace the redis keys with a prefix equal
 *   to this value so that we can use the same Redis server for multiple
 *   micro-services
 * @param {EventEmitter} opts.changeEmitter - optional, if provided it should
 *    emit a `change` event whenever any run time options needs to be changed
 * @returns {Promise<void>}
 * @async
 */
async function cacheAsync(fastify, opts) {
  const {
    redisClient,
    redisConfigOverrides,
    namespace = '',
    changeEmitter = new EventEmitter() // Prevent crash if not provided
  } = opts;

  const chosenRedisClient = redisClient || redisClientFactory(redisConfigOverrides);

  const clientWrapper = new ClientWrapper(
    chosenRedisClient,
    namespace,
    fastify.log
  );

  changeEmitter.on('change', ({ cache }) => {
    const { enabled, timeoutMs, deleteBatchSize } = cache;
    clientWrapper.setRuntimeConfig({
      timeoutMs,
      deleteBatchSize
    });
    ChildCacheService.setGlobalRuntimeConfig({ globalDisable: !enabled });
  });

  fastify.decorate('cache', {
    redisClient: chosenRedisClient,
    clientWrapper,
    ChildCacheService
  });

  fastify.addHook('onClose', async () => chosenRedisClient.quit().catch(() => {}));
  fastify.log.info('Caching service setup ready');
}

export default fp(cacheAsync, {
  name: 'cache'
});
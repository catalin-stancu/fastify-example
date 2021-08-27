import fp from 'fastify-plugin';
import path from 'path';
import { StorageBucket as GCPBucket } from 'fastify-global-plugins/services/storage.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates utility libraries commonly used in
 * this project. If the utils decorator is not already populated
 * by the `fastify-global-plugins` library, it will be setup here
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {object} opts.StorageBucket - storage class to use
 * @returns {Promise<void>}
 * @async
 */
async function instantiateServicesAsync(fastify, opts) {
  const { StorageBucket = GCPBucket } = opts;
  const { services, env, utils, db, cache, log, appConfig, stackRouteSchemas, queue } = fastify;
  const { httpErrors } = utils;
  const { fileRules } = appConfig;

  const { clientWrapper, ChildCacheService } = cache;
  const {
    configUtils: { ConfigUtils },
    entityUtils: { EntityUtils },
    fileUtils: { FileUtils },
    stackUtils: { StackUtils },
    tagService: { TagService },
    configService: { ConfigService },
    entityService: { EntityService },
    stackService: { StackService }
  } = services;

  // Setup child cache service for this resource. Even though they are optional,
  // if we don't await their method calls we can encounter problems when having connection errors
  const entityCacheService = new ChildCacheService(
    clientWrapper,
    'entities',
    idKeys => idKeys.uuid,
    log
  );

  const tagCacheService = new ChildCacheService(
    clientWrapper,
    'tags',
    idKeys => idKeys.uuid,
    log
  );

  const configUtils = new ConfigUtils({ db, httpErrors, log, stackRouteSchemas });
  const cloudStorage = new StorageBucket(env.BUCKET_NAME, utils);
  const entityUtils = new EntityUtils({
    db,
    log,
    utils,
    cacheService: entityCacheService
  });

  const fileUtils = new FileUtils({
    fileNamingConfig: appConfig.fileRules.naming,
    db,
    cloudStorage,
    log,
    utils
  });

  const stackUtils = new StackUtils({
    cacheService: entityCacheService,
    db,
    cloudStorage,
    log,
    utils,
    entityUtils,
    fileUtils
  });

  const tagService = new TagService(db, log, utils);
  const entityService = new EntityService({
    entityUtils,
    db,
    log,
    utils
  });

  const configService = new ConfigService({
    fileRules,
    configUtils,
    entityUtils,
    db,
    log,
    utils
  });

  const stackService = new StackService({
    fileRules,
    configUtils,
    cloudStorage,
    entityUtils,
    fileUtils,
    stackUtils,
    entityCacheService,
    resizeQueue: queue?.resizeQueue || null,
    db,
    log,
    utils
  });

  fastify.decorate('instantiatedServices', {
    configUtils,
    cloudStorage,
    entityUtils,
    fileUtils,
    stackUtils,
    tagService,
    entityCacheService,
    entityService,
    tagCacheService,
    configService,
    stackService
  });
}

export default fp(instantiateServicesAsync, {
  name: moduleName, dependencies: ['loadServices', 'decorateRoutes']
});
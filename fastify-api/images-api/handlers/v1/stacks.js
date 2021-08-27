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
export default async function stackHandlersAsync(fastify) {
  const { Response, instantiatedServices } = fastify;
  const { entityCacheService, stackService } = instantiatedServices;

  /**
   * Find all urls for given list of stacks
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function findAsync(req) {
    req.log.trace(`[${moduleName}]: Searching for stack urls in bulk`);
    const { uuids: uuidList } = req.body;

    const { output, metadata } = await stackService.getManyAsync(uuidList);
    return new Response(output, metadata);
  }

  /**
   * Get stack data and its variants given a root UUID
   *
   * @param {object} req - request object
   * @returns {Promise<object>}
   */
  async function findByIdAsync(req) {
    const { uuid: rootUuid } = req.params;

    req.log.trace(`[${moduleName}]: Searching for stack with root uuid ${rootUuid}`);
    const instance = await stackService.getOneAsync(rootUuid);
    return new Response(instance);
  }

  /**
   * Delete a list of stacks based on a search query
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function bulkDeleteAsync(req) {
    const { where } = req;
    req.log.trace(`[${moduleName}]: Trying to delete a list of stacks`);
    await entityCacheService.invalidateAllListsAsync();

    const { metadata } = await stackService.deleteManyAsync(where);
    return new Response(null, metadata);
  }

  /**
   * Delete a single stack based on specified uuid
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function deleteByIdAsync(req) {
    const { uuid } = req.params;
    req.log.trace(`[${moduleName}]: Trying to delete stack with uuid ${uuid}`);
    await entityCacheService.invalidateAllListsAsync();

    const { metadata } = await stackService.deleteOneAsync(uuid);
    return new Response(null, metadata);
  }

  /**
   * Upload files to cloud storage
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function uploadBulkAsync(req, reply) {
    req.log.trace(`[${moduleName}]: Starting to upload files and to `
      + 'generate stacks for supported images');

    // We enabled manual validation error handling inside the handler. We need
    // this to be able to clean up files pre-uploaded to cloud storage if we have
    // a schema validation error
    if (req.validationError) {
      await req.performCleanupAsync();
      req.validationError.status = 400;
      throw req.validationError;
    }
    const { parent } = req.query;
    const { filesMetadataList, fileUsage } = req;

    await entityCacheService.invalidateAllListsAsync();

    const {
      instanceList,
      metadata,
      errorList
    } = await stackService.uploadManyAsync(parent, filesMetadataList, fileUsage);

    // Build response and set multi-status response if we have errors
    const response = new Response(instanceList, metadata);
    if (errorList.length) reply.status(metadata?.count ? 207 : 400);

    // Add messages for every encountered error
    errorList.forEach(error => response.addError(error));
    return response;
  }

  /**
   * Replace stack viewport image and re-generate all versions for that viewport.
   * If crop coordinates are provided, the resizes will be generated based on the
   * image resulting after crop.
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function uploadOverrideAsync(req, reply) {
    req.log.trace(`[${moduleName}]: Starting to apply override in requested stack `);
    const { performCleanupAsync, fileMetadata, query, params, validationError } = req;

    // We enabled manual validation error handling inside the handler. We need
    // this to be able to clean up files pre-uploaded to cloud storage if we have
    // a schema validation error
    if (validationError) {
      await performCleanupAsync();
      req.validationError.status = 400;
      throw validationError;
    }

    const { viewport: viewportName } = query;
    // eslint-disable-next-line camelcase
    const { revert, crop_offset_x, crop_offset_y, crop_width, crop_height } = query;
    const cropCoordinates = { crop_offset_x, crop_offset_y, crop_width, crop_height };
    const { uuid } = params;

    await entityCacheService.invalidateAllListsAsync();

    const {
      instance,
      errorList
    } = await stackService.overrideOneViewportAsync(
      uuid, viewportName, fileMetadata, revert, cropCoordinates, performCleanupAsync
    );

    // Build response and set multi-status response if we have errors
    const response = new Response(instance);
    if (errorList.length) reply.status(instance ? 207 : 400);

    // Add messages for every encountered error
    errorList.forEach(error => response.addError(error));
    return response;
  }

  /**
   * Create asset variation when asset is used outside DAM
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function generateManyAsync(req, reply) {
    req.log.info(`[${moduleName}]: Trying to create asset variations`);
    const {
      uuids,
      usage,
      resource_id: resourceId,
      resource_type: resourceType,
      resource_name: resourceName
    } = req.body;

    await entityCacheService.invalidateAllListsAsync();

    const { instance, metadata, errorList } = await stackService.generateManyAsync(
      uuids, usage, resourceId, resourceType, resourceName
    );

    // Build response and set multi-status response if we have errors
    const response = new Response(instance, metadata);
    if (errorList.length) reply.status(metadata?.count ? 207 : 400);

    // Add messages for every encountered error
    errorList.forEach(error => response.addError(error));
    return response;
  }

  if (!fastify.handlers[version]) {
    fastify.handlers[version] = {};
  }

  fastify.handlers[version][moduleName] = {
    findAsync,
    findByIdAsync,
    bulkDeleteAsync,
    deleteByIdAsync,
    uploadBulkAsync,
    uploadOverrideAsync,
    generateManyAsync
  };
}
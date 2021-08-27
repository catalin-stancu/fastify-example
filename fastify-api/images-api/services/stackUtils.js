/* eslint-disable camelcase */
import { bytesMeasurement } from 'fastify-global-plugins/services/utils.js';
import { performance } from 'perf_hooks';
import { resizeImage } from './resizeGenerator.js';

/**
 * Utils class used to manage sub-operations with stack creation
 */
export class StackUtils {
  /**
   * @params {object} opts - parameters object
   * @param {string} opts.cacheService - cache service class
   * @param {object} opts.db - Sequelize instance
   * @param {object} opts.cloudStorage - cloud storage instance
   * @param {object} opts.log - Fastify logger instance
   * @param {object} opts.utils - utils dictionary
   * @param {object} opts.entityUtils - entity helper class
   * @param {object} opts.fileUtils - image utils class
   * @returns {object} class instance
   */
  constructor({ cacheService, db, cloudStorage, log, utils, entityUtils, fileUtils }) {
    this.cacheService = cacheService;
    this.db = db;
    this.cloudStorage = cloudStorage;
    this.log = log;
    this.utils = utils;
    this.entityUtils = entityUtils;
    this.fileUtils = fileUtils;

    this.errClass = 109;
  }

  /**
   * Remove previous versions of the resize images
   *
   * @param {object} viewportVersions - object with all viewport versions as keys
   * @param {string} rootUuid - root UUID for stack to delete previous versions for
   * @param {string} viewport - viewport to delete previous versions for
   * @param {string} fileName - original image filename to delete previous versions for
   * @param {number} imageVersion - image version to delete resizes for
   * @returns {Promise}
   */
  async deletePreviousVersionsAsync(
    viewportVersions, rootUuid, viewport, fileName, imageVersion
  ) {
    const [deleteFromBucketError, deleteFromBucketResults] = await this.utils.to(Promise.all(
      Object.keys(viewportVersions).map(async versionName => {
        const storagePath = `${rootUuid}/${viewport}/${versionName}/`
          + `${imageVersion}/${fileName}`;
        return this.cloudStorage.bucket.file(storagePath).delete({ ignoreNotFound: true });
      })
    ));

    if (deleteFromBucketError) {
      this.utils.httpErrors.throwInternalServerError(
        `Could not delete bucket files for [${fileName} / ${viewport}] versions: `
        + deleteFromBucketError.message,
        { errClass: this.errClass }
      );
    } else {
      this.log.info(`[Viewport generation] Deleted ${deleteFromBucketResults?.length || 0} `
        + `version files from bucket for [${fileName} / ${viewport}] override`);
    }
  }

  /**
   * Generate viewport resized images and update or create the viewport folder DB entity
   * Anywhere we need a bucket file storage URL we also include a version so that at every
   * update, its increase will cause CDN cache to invalidate correctly
   *
   * @param {Object|null} resizeQueue - internal queue for generating image resizes
   * @param {File} fileBuffer - the File object from GCP
   * @param {string} viewport - the file to generate resizes from
   * @param {Object} rootImage - uploaded image entity
   * @param {Object} entityData - entity data
   * @param {Object} resizeOptions - resize options
   * @param {Object|null} viewportDataToUpdate - if not null, the provided viewport
   *   instance will be updated, instead of creating a new one
   * @returns {Promise}
   */
  async generateViewportVersions(
    resizeQueue,
    fileBuffer,
    viewport,
    rootImage,
    entityData,
    resizeOptions,
    viewportDataToUpdate = null
  ) {
    const { name: fileName, resource_id, resource_type, resource_name } = rootImage;
    this.log.info('[Viewport generation] Starting to generate variants '
      + `for [${fileName} / ${viewport}]`);
    const { UUID } = this.utils;
    const viewportVersions = resizeOptions.variant_resolutions[viewport];
    let viewportFolder;

    const cropOptions = {
      width: viewportDataToUpdate?.crop_width,
      height: viewportDataToUpdate?.crop_height,
      left: viewportDataToUpdate?.crop_offset_x,
      top: viewportDataToUpdate?.crop_offset_y
    };

    // Add an internal 'preview' version to generate, it will be used by the Admin UI to display
    // a preview image for every viewport image source (usually it will be the root, but may
    // also be a replaced or cropped image)
    const { background_color: backgroundColor, preview } = resizeOptions;
    viewportVersions.preview = preview;
    const { targetViewportUuid } = entityData;
    const { image_version: nextImageVersion = 1 } = viewportDataToUpdate || {};

    // If we receive a viewport instance to re-generate versions for, we need to
    // clean up the previous entities and bucket files before using new ones
    if (viewportDataToUpdate) {
      // Update viewport folder including override metadata
      const [updateErr, updateResult] = await this.utils.to(
        this.db.models.entities.update(viewportDataToUpdate, {
          where: { uuid: targetViewportUuid },
          limit: 1,
          returning: true
        })
      );

      if (updateErr) {
        this.utils.httpErrors.throwInternalServerError(
          `Could not update DB entity for [${fileName} / ${viewport}] viewport replacement: `
          + updateErr.message,
          { errClass: this.errClass }
        );
      }

      const [updatedCount = 0, [updatedInstance]] = updateResult;
      if (!updatedCount) {
        this.utils.httpErrors.throwInternalServerError(
          `Could not update DB entity for [${fileName} / ${viewport}] viewport replacement: `
          + 'DB entity was not found',
          { errClass: this.errClass }
        );
      } else {
        this.log.info(`[Viewport generation]: DB entity for [${fileName} / ${viewport}] `
          + `with uuid ${targetViewportUuid} updated successfully`);
      }

      viewportFolder = updatedInstance;
    } else {
      this.log.info(`[Viewport generation] Creating DB entity for [${fileName} / ${viewport}]`);
      const createResult = await this.entityUtils.createViewportFolder(
        viewport,
        rootImage,
        {
          ...entityData,
          root_uuid: rootImage.uuid,
          parent: rootImage.uuid,
          content_type: rootImage.content_type
        },
        resource_id,
        resource_name,
        resource_type
      );
      viewportFolder = createResult;
    }

    this.log.info('[Viewport generation] Resizing images and uploading results to bucket for '
      + `[${fileName} / ${viewport}] versions`);
    const [resizedVersionsError, resizedVersionsResults] = await this.utils.to(Promise.all(
      Object.keys(viewportVersions).map(async versionName => {
        const resolution = viewportVersions[versionName];
        let resizedImageBuffer;
        if (resizeQueue) {
          resizedImageBuffer = await resizeQueue.addAsync(
            'resizeImage', { resolution, fileBuffer, backgroundColor, cropOptions }
          );
        }

        const storagePath = `${rootImage.uuid}/${viewport}/${versionName}/`
          + `${nextImageVersion}/${fileName}`;
        const measurements = {
          bytes: bytesMeasurement
        };

        const { bytes } = await this.cloudStorage.upload(Buffer.from(resizedImageBuffer), {
          mimeType: viewportFolder.content_type, storagePath, measurements
        });
        return { bytes, versionName, storagePath };
      })
    ));

    if (resizedVersionsError) {
      this.utils.httpErrors.throwInternalServerError(
        `Could not resize and upload [${fileName} / ${viewport}] versions: `
        + resizedVersionsError.message,
        { errClass: this.errClass }
      );
    }

    this.log.info('[Viewport generation] Creating DB entities for all '
      + `[${fileName} / ${viewport}] versions`);
    const viewportFilesToCreate = [];
    resizedVersionsResults.forEach(({ versionName, bytes, storagePath }) => {
      if (versionName === 'preview') return;

      const { uuid: parent, modified_by, created_by, usage } = viewportFolder;
      const { local_path: localPath, name: viewportFolderName } = viewportFolder;

      viewportFilesToCreate.push({
        usage,
        resource_id,
        resource_name,
        resource_type,
        uuid: UUID.v4(),
        name: `${viewport}_${versionName}_${viewportFolderName}`,
        created_by,
        modified_by,
        storage_path: storagePath,
        local_path: localPath ? `${localPath}/${viewportFolderName}` : viewportFolderName,
        bytes,
        root_uuid: rootImage.uuid,
        content_type: rootImage.content_type,
        width: resizeOptions.variant_resolutions[viewport][versionName].width,
        height: resizeOptions.variant_resolutions[viewport][versionName].height,
        type: `file:image:${viewport}:${versionName}`,
        image_version: nextImageVersion,
        parent
      });
    });

    const [viewportFilesError] = await this.utils.to(
      this.db.models.entities.bulkCreate(viewportFilesToCreate, { returning: false })
    );

    if (viewportFilesError) {
      this.utils.httpErrors.throwInternalServerError(
        `File entities could not be created for [${fileName} / ${viewport}] versions: `
        + viewportFilesError.message,
        { errClass: this.errClass }
      );
    } else if (viewportDataToUpdate) {
      this.log.info('[Viewport generation] Deleting previous DB entities and bucket '
      + `files for [${fileName} / ${viewport}].`);

      // Make sure not to delete the new viewport entities, only the previous ones
      const [deleteVersionsEntitiesErr, deleteCount] = await this.utils.to(
        this.db.models.entities.destroy({
          where: {
            parent: targetViewportUuid,
            image_version: nextImageVersion - 1
          }
        })
      );

      this.log.info(`[Viewport generation] Deleted ${deleteCount || 0} version DB entities `
        + `for [${fileName} / ${viewport}] override`);
      if (deleteVersionsEntitiesErr) {
        this.utils.httpErrors.throwInternalServerError(
          `Could not delete DB entities for [${fileName} / ${viewport}] versions: `
          + deleteVersionsEntitiesErr.message,
          { errClass: this.errClass }
        );
      }

      // We may delete previous bucket files but in some cases they may still be used. TBD.
      // await this.deletePreviousVersionsAsync(
      //   viewportVersions,
      //   rootImage.uuid,
      //   viewport,
      //   fileName,
      //   nextImageVersion - 1
      // );
    }
  }

  /**
   * Update stack status and entity type
   *
   * @param {string[] | string} whereUuid - array of UUIDs or single UUID to update
   * @param {string} stackStatus - stack generation status to be set
   * @param {boolean} [stackWasGenerated = true] - if true marks the type of the stack as non-empty
   * @param {number|null} stackTimeMs - time in milliseconds in which the stack was created
   * @returns {Promise<object[]>} list with updated stack entities
   */
  async updateStackStatus(whereUuid, stackStatus, stackWasGenerated = true, stackTimeMs = null) {
    // Make sure to treat stack type as empty for every status other than finished
    // Even though some DB entities may remain in case of error, the client should
    // consider they don't exist and not rely on them in any way
    const updatedType = stackWasGenerated ? 'stack' : 'stack:empty';
    const [stackStatusUpdateErr, result = []] = await this.utils.to(
      this.db.models.entities.update({
        stack_status: stackStatus,
        type: updatedType,
        stack_time_ms: Math.round(stackTimeMs)
      }, {
        where: {
          uuid: whereUuid
        },
        limit: 1,
        returning: true
      })
    );

    const [count, updatedStacks] = result;
    if (stackStatusUpdateErr || !count) {
      this.log.error(`Error trying to set stack status to [${stackStatus}]: `
        + `${stackStatusUpdateErr ? stackStatusUpdateErr?.message : 'entity was not found'}`);
    }

    return updatedStacks;
  }

  /**
   * Generate all entities and internal resources that belong to a stack
   *
   * @param {Object|null} resizeQueue - internal queue for generating image resizes
   * @param {Object[]} dbFiles - array of file entities to create the stack for
   * @param {Object} fileUsage - object containing the following properties
   *   - generateStack - boolean indicating if we should generate the stack
   *   - entityData - additional entity data (type, usage, resourceId, resourceName, resourceType)
   *   - resizeOptions - config object containing needed for generating resizes
   * @param {Object} imageStackDetails - Object containing two properties
   *   - isImageTypeSupported - boolean indicating if the image type is
   *   appropriate for stack generation
   *   - file - The File entity exposed by the GCP API
   * @returns {Promise<void>}
   */
  async generateStack(
    resizeQueue,
    dbFiles,
    fileUsage,
    imageStackDetails
  ) {
    const { generateStack, resizeOptions, entityData } = fileUsage;
    const updateStackStatusPromises = [];

    if (generateStack) {
      this.log.info(`Creating the stack for ${dbFiles.length} files`);
    } else {
      this.log.info('Will not generate a stack for the uploaded files because this is what the '
        + 'configuration with resolutions and viewports specifies');
    }

    // Remove stack status from viewport folders and variants.
    // Stack status should be available only on root images (type: stack)
    delete entityData.stack_status;
    await Promise.all(dbFiles.map(async rootImage => {
      const { uuid: rootUuid, content_type: mimeType, name: rootName } = rootImage;
      const { previewPath, isImageTypeSupported, file } = imageStackDetails[rootUuid];
      const rootImageStackErrors = { [rootUuid]: null };
      const stackTimeStartMs = performance.now();

      if (isImageTypeSupported) {
        const [fileDownloadErr, fileBuffer] = await this.utils.to(
          this.fileUtils.downloadFile(file)
        );
        if (fileDownloadErr) {
          this.log.error(`Error downloading file ${rootName}: ${fileDownloadErr}`);
          // Setting root image to empty stack and stack status to error
          // So we know that the stack generation failed for this entity
          return this.updateStackStatus(rootUuid, 'error: root image download', false);
        }

        // Add an internal 'preview' version to generate, it will be used by
        // the Admin UI to display a preview image for the root image
        let previewImageErr = null;
        if (previewPath) {
          this.log.info('Generating the preview image for the root image');

          const { background_color: backgroundColor, preview } = resizeOptions;
          let previewImagePromise;

          if (resizeQueue) {
            previewImagePromise = resizeQueue.addAsync(
              'resizeImage',
              { resolution: preview, fileBuffer, backgroundColor }
            );
          }

          [previewImageErr] = await this.utils.to(previewImagePromise.then(
            previewImageBuffer => {
              this.cloudStorage.upload(
                Buffer.from(previewImageBuffer),
                { mimeType, storagePath: previewPath }
              );
            }
          ));

          if (previewImageErr) {
            this.log.error(previewImageErr, `Error generating root preview for ${rootName}`);
            rootImageStackErrors[rootUuid] = 'error: preview generation';
          }
        }

        if (!previewImageErr) {
          const viewports = Object.keys(resizeOptions.variant_resolutions);
          const resizeResult = await Promise.allSettled(
            viewports.map(async viewport => this.generateViewportVersions(
              resizeQueue,
              fileBuffer,
              viewport,
              rootImage,
              entityData,
              resizeOptions
            ))
          );

          for (const result of resizeResult) {
            if (result.status === 'rejected') {
              this.log.error(`Error generating stack for files: ${result.reason}`);
              rootImageStackErrors[rootUuid] = 'error: resize';
              break;
            }
          }
        }
      } else {
        this.log.error('Image format is not supported');
        rootImageStackErrors[rootUuid] = 'error: image not supported';
      }

      if (rootImageStackErrors[rootUuid]) {
        updateStackStatusPromises.push(
          this.updateStackStatus(rootUuid, rootImageStackErrors[rootUuid], false)
        );
      } else {
        const stackTimeMs = performance.now() - stackTimeStartMs;
        updateStackStatusPromises.push(
          this.updateStackStatus(rootUuid, 'finished', generateStack, stackTimeMs)
        );
      }
    }));

    await Promise.allSettled(updateStackStatusPromises);
  }

  /**
   * Check if stack modifications are allowed
   *
   * @param {string} stackUuid - UUID of stack root
   * @param {string} viewport - viewport to modify
   * @param {boolean} revert - if true, the viewport source is reverted to the original asset image
   * @param {number} cropOffsetX - horizontal crop offset
   * @param {number} cropOffsetY - vertical crop offset
   * @param {number} cropWidth - crop width
   * @param {number} cropHeight - crop height
   * @returns {Promise<object>} object with two properties:
   *   - stackEntity - entity for stack root
   *   - targetViewport - entity for target viewport in the requested stack
   */
  async checkStackModificationAsync(
    stackUuid,
    viewport,
    revert,
    cropOffsetX,
    cropOffsetY,
    cropWidth,
    cropHeight
  ) {
    if (revert && (cropWidth || cropHeight || cropOffsetX || cropOffsetY)) {
      this.utils.httpErrors.throwBadRequest(
        'Cannot apply crop and revert to original image at the same time',
        { errClass: this.errClass }
      );
    }

    if (Boolean(cropWidth) !== Boolean(cropHeight)) {
      this.utils.httpErrors.throwBadRequest(
        'Cannot apply crop only to one image axis. Please specify both '
        + 'crop width and crop height',
        { errClass: this.errClass }
      );
    }

    // Get stack instance entity from DB
    const stackEntity = await this.db.models.entities.findOne({
      where: { uuid: stackUuid }
    });

    // If stack is not found, throw generic 404 error
    if (!stackEntity?.usage) {
      this.utils.httpErrors.throwNotFound('Instance not found', { errClass: this.errClass });
    }

    // Check if stack modification is allowed
    const { usage, content_type: contentType } = stackEntity;

    if (usage !== 'cms' || !/^image\//.test(contentType)) {
      this.utils.httpErrors.throwBadRequest(
        'Only viewports in CMS image stacks can be modified after creation',
        { errClass: this.errClass }
      );
    }

    const targetViewport = await this.db.models.entities.findOne({
      attributes: ['uuid', 'name', 'storage_path', 'image_version', 'width', 'height'],
      where: {
        parent: stackUuid,
        type: `folder:${viewport}`
      },
      raw: true
    });

    if (!targetViewport?.uuid) {
      this.utils.httpErrors.throwNotFound(
        'The specified viewport was not found in the requested stack', { errClass: this.errClass }
      );
    }

    const { width, height } = targetViewport;
    if (cropOffsetX + cropWidth > width || cropOffsetY + cropHeight > height) {
      this.utils.httpErrors.throwBadRequest(
        'The specified crop area exceeds source image bounds', { errClass: this.errClass }
      );
    }

    return {
      stackEntity,
      targetViewport
    };
  }
}
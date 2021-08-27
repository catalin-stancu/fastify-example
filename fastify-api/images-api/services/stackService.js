import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * Class used to manage entities business logic
 */
export class StackService {
  /**
   * @param {object} opts - parameters
   * @param {object} opts.fileRules - object with file configurations
   * @param {object} opts.configUtils - ConfigUtils instance
   * @param {object} opts.cloudStorage - CloudStorage instance
   * @param {object} opts.entityUtils - EntityUtils instance
   * @param {object} opts.fileUtils - FileUtils instance
   * @param {object} opts.stackUtils - StackUtils instance
   * @param {object} opts.entityCacheService - entity CacheService instance
   * @param {object} opts.resizeQueue - resize queue instance
   * @param {object} opts.db - Sequelize instance
   * @param {object} opts.log - Fastify logger instance
   * @param {object} opts.utils - utils dictionary
   * @returns {object} class instance
   */
  constructor({
    fileRules,
    configUtils,
    cloudStorage,
    entityUtils,
    fileUtils,
    stackUtils,
    entityCacheService,
    resizeQueue,
    db,
    log,
    utils
  }) {
    this.fileRules = fileRules;
    this.cloudStorage = cloudStorage;
    this.entityUtils = entityUtils;
    this.fileUtils = fileUtils;
    this.stackUtils = stackUtils;
    this.configUtils = configUtils;
    this.entityCacheService = entityCacheService;
    this.resizeQueue = resizeQueue;
    this.db = db;
    this.log = log;
    this.utils = utils;
    this.errClass = 105;
    this.table = db.models.entities;

    this.includeTags = {
      model: db.models.tags,
      as: 'tags',
      attributes: ['name', 'uuid'],
      through: {
        attributes: []
      }
    };

    this.parentAttributes = ['uuid', 'name', 'modified_by',
      'status', 'bytes', 'local_path', 'parent', 'type'];
  }

  /**
   * Get a list of stack urls
   *
   * @param {Array<string>} uuidList - list of stack UUIDs
   * @returns {object} object with two properties:
   *   - output - list with results
   *   - metadata - metadata with item count and page info to put in response
   * @async
   */
  async getManyAsync(uuidList) {
    this.log.trace(`[${moduleName}]: Listing stack urls in bulk`);
    const results = await this.table.findAll({
      attributes: ['storage_path', 'width', 'height', 'type', 'root_uuid'],
      where: {
        root_uuid: uuidList,
        type: {
          // This is more efficient in SQL than filtering the type column in Node.js
          [this.db.Op.notILike]: 'folder:%'
        }
      },
      raw: true
    });

    const urlsMap = new Map();
    results.forEach(entity => {
      const { storage_path: storagePath, width, height, type, root_uuid: rootUuid } = entity;
      const [variant, resizeVersion] = type.split(':').slice(-2);

      let stackData = {
        uuid: rootUuid,
        urls: {}
      };

      if (!urlsMap.has(rootUuid)) {
        urlsMap.set(rootUuid, stackData);
      } else {
        stackData = urlsMap.get(rootUuid);
      }

      if (!stackData.urls[variant]) stackData.urls[variant] = {};

      stackData.urls[variant][resizeVersion] = {
        url: storagePath,
        width,
        height
      };
    });

    const output = [...urlsMap.values()];
    const count = output.length;
    this.log.trace(`[${moduleName}]: Found ${count} stacks`);

    return { output, metadata: { count } };
  }

  /**
   * Get a stack
   *
   * @param {string} rootUuid - stack root UUID
   * @returns {object} requested data
   * @async
   */
  async getOneAsync(rootUuid) {
    const rootEntity = await this.table.findOne({
      where: {
        uuid: rootUuid,
        type: 'stack'
      }
    });

    if (!rootEntity) {
      this.utils.httpErrors.throwNotFound(
        'Entity not found or is not the root of a fully generated stack',
        { errClass: this.errClass }
      );
    }

    // Allow retrieval of variant URLs only if the entity is a stack
    // and if the stack generation process has finished
    if ((rootEntity.stack_status === 'empty' || rootEntity.stack_status === 'pending')
      || (rootEntity.usage === 'dam')) {
      this.utils.httpErrors.throwNotFound("Entity doesn't have any variants");
    }

    const results = await this.table.findAll({
      attributes: ['storage_path', 'width', 'height', 'type'],
      where: {
        root_uuid: rootUuid,
        type: {
          $like: 'file:image:%'
        }
      }
    });

    const rootEntityAugmented = await this.entityUtils.addExtraEntityDataAsync(rootEntity);
    const output = {
      rootEntity: rootEntityAugmented,
      urls: {}
    };
    results.forEach(entity => {
      const [variant, resizeVersion] = entity.type.split(':').slice(-2);
      const {
        storage_path: storagePath,
        width,
        height
      } = entity;

      if (!output.urls[variant]) output.urls[variant] = {};
      output.urls[variant][resizeVersion] = {
        url: storagePath,
        width,
        height
      };
    });

    return output;
  }

  /**
   * Delete a list of stacks
   *
   * @todo: Implement proper deletion of all associated resources
   * @todo: Determine what must be done with the file in Cloud Storage and CDN after deletion
   * @todo: Don't allow a stack to be deleted while it is generating or during replace or cropping
   *
   * @param {object} where - ORM formatted query filter
   * @returns { object } - object with properties:
   *   - metadata - information about deletion results
   * @async
   */
  async deleteManyAsync(where) {
    const filterResults = await this.table.findAll({
      where: {
        [this.db.Op.and]: [
          where,
          { type: 'stack' }
        ]
      },
      returning: ['uuid']
    });

    const rootEntitiesList = filterResults.map(entity => entity.uuid);

    // Note: The tag associations are deleted when deleting entities via FK CASCADE on DELETE
    const entityCount = await this.table.destroy({
      where: {
        [this.db.Op.or]: [
          { uuid: rootEntitiesList },
          { root_uuid: rootEntitiesList }
        ]
      }
    }) || 0;

    this.log.info(`[${moduleName}]: Deleted ${entityCount} entities`);
    return {
      metadata: {
        count: rootEntitiesList.length,
        entity_count: entityCount
      }
    };
  }

  /**
   * Delete a stack
   *
   * @todo: Implement proper deletion of all associated resources
   * @todo: Determine what must be done with the file in Cloud Storage and CDN after deletion
   * @todo: Don't allow a stack to be deleted while it is generating or during replace or cropping
   *
   * @param {string} uuid - UUID of entity to be deleted
   * @returns { object } - object with properties:
   *   - metadata - information about deletion results
   * @async
   */
  async deleteOneAsync(uuid) {
    const deleteRootEntityPromise = await this.table.destroy({
      where: { uuid }
    });

    // Note: The tag associations are deleted when deleting entities via FK CASCADE on DELETE
    const deleteChildEntitiesPromise = await this.table.destroy({
      where: {
        [this.db.Op.or]: [
          { uuid },
          { root_uuid: uuid }
        ]
      }
    });

    const [rootCount, childEntitiesCount] = await Promise.all([
      deleteRootEntityPromise,
      deleteChildEntitiesPromise
    ]);

    const outcome = rootCount ? 'deleted successfully' : 'not deleted';

    this.log.info(`[${moduleName}]: Stack with uuid ${uuid} ${outcome}`);
    return {
      metadata: {
        count: rootCount,
        entity_count: childEntitiesCount + rootCount
      }
    };
  }

  /**
   * Upload multiple files and supported image types are stored as stacks
   *
   * @param {string} parent - UUID of parent folder to upload the files into
   * @param {Array<object>} filesMetadataList - list of file metadata objects
   * @param {object} fileUsage - object with file usage details
   * @returns {object} - object with 3 properties:
   *   - instanceList - root stack instance list
   *   - metadata - response metadata
   *   - errorList - list of errors that occurred during request execution
   */
  async uploadManyAsync(parent, filesMetadataList, fileUsage) {
    const fileCount = filesMetadataList.length;
    const { resizeOptions, entityData } = fileUsage;
    resizeOptions.preview = this.fileRules.preview;

    const processedFilesDict = {};
    const resultPromisesList = [];
    const existingFileNamesToCheck = [];
    const duplicateFileNameInputs = [];

    filesMetadataList.forEach(fileMetadata => {
      const { uploadResult, ...metadata } = fileMetadata;
      const { fileName } = metadata;
      processedFilesDict[fileMetadata.uuid] = metadata;

      if (existingFileNamesToCheck.includes(fileName)) {
        duplicateFileNameInputs.push(fileName);
      } else {
        existingFileNamesToCheck.push(fileName);
      }
      resultPromisesList.push(uploadResult);
    });

    this.log.info('Check parent existence and duplicate file names');
    let parentsToUpdate = [];
    let localPath = '';
    let parentInstance = null;

    if (parent) {
      parentInstance = await this.table.findOne({
        attributes: this.parentAttributes,
        where: { uuid: parent }
      });

      // If parent is not found, throw generic 404 error
      if (!parentInstance?.uuid) {
        this.utils.httpErrors.throwNotFound(
          'The specified parent folder does not exist', { errClass: this.errClass }
        );
      }

      // If parent is not a folder, stack creation is not allowed
      if (parentInstance.type !== 'folder') {
        this.utils.httpErrors.throwBadRequest(
          'File upload allowed only inside a folder', { errClass: this.errClass }
        );
      }

      // Set localPath for file based on found parent
      localPath = parentInstance.local_path
        ? `${parentInstance.local_path}/${parentInstance.name}`
        : parentInstance.name;

      parentsToUpdate = await this.entityUtils.getParentsOfInstanceAsync(
        parentInstance, this.parentAttributes
      );
    }

    const entitiesWithDuplicateFileNames = await this.table.findAll({
      ...StackService.getFilterForUniqueness({
        name: existingFileNamesToCheck,
        parent
      }),
      returning: ['uuid', 'name'],
      raw: true
    });

    this.log.info(`Waiting for upload of ${fileCount} files to GCP Storage to end`);
    const uploadResults = await Promise.allSettled(resultPromisesList);

    this.log.trace('Check outcome for each file upload');
    const entitiesToCreate = [];
    const duplicateCleanupPromiseList = [];
    const badDimensionPromiseList = [];
    const imageStackDetails = {};

    // There is an uploadResult for every file upload field in the form data payload
    // We wrap everything in a Promise.all() to catch any thrown error from inside the .map
    await Promise.all(uploadResults.map(async ({ status, value }, index) => {
      const { fileName, mimeType, uuid } = filesMetadataList[index];
      const { storagePath, errorList } = filesMetadataList[index];

      const duplicateNameEntity = entitiesWithDuplicateFileNames
        .find(entity => entity.name === fileName);

      if (duplicateNameEntity) {
        // Delete file uploaded to cloud storage if there is a problem with its name
        if (value.cleanUpAsync) {
          duplicateCleanupPromiseList.push(value.cleanUpAsync());
        }

        const fileFieldNameErr = this.utils.httpErrors.throwConflict(
          'A folder or file with the name [{{fileName}}] already exists '
            + 'in the target folder',
          { errClass: this.errClass, params: { fileName }, justReturnError: true }
        );
        errorList.push(fileFieldNameErr);
      } else if (duplicateFileNameInputs.includes(fileName)) {
        const fileFieldNameErr = this.utils.httpErrors.throwConflict(
          'A folder or file with the name [{{fileName}}] already exists '
            + 'in the folders received so far',
          { errClass: this.errClass, params: { fileName }, justReturnError: true }
        );
        errorList.push(fileFieldNameErr);

        // Delete file uploaded to cloud storage if there is a problem with its name
        if (value.cleanUpAsync) {
          duplicateCleanupPromiseList.push(value.cleanUpAsync());
        }
      } else if (status === 'rejected' || value instanceof Error) {
        errorList.push(value);
      } else {
        const { bytes = 0, imageDimensions, file } = value;
        const contentTypeParts = mimeType.split('/');
        const fileFormat = contentTypeParts[1].toLowerCase();
        const isImage = contentTypeParts[0].toLowerCase() === 'image';

        if (isImage && !imageDimensions) {
          const dimensionMeasureErr = this.utils.httpErrors.throwInternalServerError(
            'The image dimensions could not be measured',
            { justReturnError: true }
          );
          errorList.push(dimensionMeasureErr);
          return;
        }

        if (imageDimensions
          && isImage
          && !this.fileUtils.isFileDimensionOk(imageDimensions, fileUsage.resizeOptions)
        ) {
          if (value.cleanUpAsync) {
            badDimensionPromiseList.push(value.cleanUpAsync());
          }
          const fileDimensionErr = this.utils.httpErrors.throwBadRequest(
            'Bad dimensions for file [{{fileName}}]',
            { errClass: this.errClass, params: { fileName }, justReturnError: true }
          );
          errorList.push(fileDimensionErr);
          return;
        }

        const isImageTypeSupported
         = isImage && this.fileRules.supportedImageTypes.indexOf(fileFormat) !== -1;
        const previewPath = `${uuid}/root/preview/1/${fileName}`;
        imageStackDetails[uuid] = {
          isImageTypeSupported,
          file,
          previewPath
        };

        // TODO: Replace these with admin user UUID retrieved
        // from auth token when available
        const [modifiedBy, createdBy] = [this.utils.UUID.v4(), this.utils.UUID.v4()];
        const imageType = isImageTypeSupported ? entityData.type : 'file:plain-image';
        const type = isImage ? imageType : 'file';

        entitiesToCreate.push({
          ...entityData,
          uuid,
          name: fileName,
          modified_by: modifiedBy,
          created_by: createdBy,
          parent,
          local_path: localPath,
          content_type: mimeType,
          storage_path: storagePath,
          preview_path: previewPath,
          priority: 1,
          status: 'active',
          bytes,
          type,
          width: imageDimensions?.width,
          height: imageDimensions?.height
        });
      }
    }));

    // Cleanup related to duplicate file names, but don't throw in case of error
    // Cleanup errors are acceptable in this case and should not break other stack creations
    const cleanupDuplicatesPromise = Promise.allSettled(duplicateCleanupPromiseList);

    // Cleanup related to bad file dimensions
    const cleanupBadDimensionsPromise = Promise.allSettled(badDimensionPromiseList);

    // Wait for cleanups in parallel
    await Promise.all([cleanupDuplicatesPromise, cleanupBadDimensionsPromise]);

    let totalSizeAllFiles = 0;
    let instanceList = null;

    if (entitiesToCreate.length) {
      this.log.trace('Create file DB entity for each successful upload');
      const [createErr, dbFiles] = await this.utils.to(
        this.table.bulkCreate(entitiesToCreate)
      );

      if (createErr) {
        // Delete files uploaded to cloud storage if their DB entities could
        // not be created because they will not be accessible in that case
        const deletePromisesList = uploadResults
          .filter(({ status }) => (status === 'fulfilled'))
          .map(({ value }) => value.cleanUpAsync());
        await Promise.allSettled(deletePromisesList);

        this.utils.httpErrors.throwInternalServerError(
          'Could not create DB entities for successfully uploaded files: '
          + createErr.message,
          { errClass: this.errClass }
        );
      }

      // Not awaiting the Promise because stack generation shouldn't block the request
      // and it should happen in the background
      this.stackUtils.generateStack(
        this.resizeQueue, dbFiles, fileUsage, imageStackDetails
      );

      this.log.trace('Attach tags to successfully uploaded files. '
      + 'Create the tags if they don\'t exist');
      const attachedTagsOutcomeList = await Promise.allSettled(
        dbFiles.map(entity => {
          const { uuid, bytes } = entity;
          totalSizeAllFiles += bytes;
          return this.entityUtils.attachTagsToEntityAsync(
            entity, processedFilesDict[uuid].tags
          );
        })
      );

      instanceList = await Promise.all(
        attachedTagsOutcomeList.map(async ({ status, value }, index) => {
          // Record errors for every tag attachment
          if (status === 'rejected') {
            const { errorList } = processedFilesDict[dbFiles[index].uuid];
            errorList.push(value);
            return this.entityUtils.addExtraEntityDataAsync(dbFiles[index]);
          }

          return this.entityUtils.addExtraEntityDataAsync(value);
        })
      );
    }

    const metadata = instanceList ? { count: instanceList.length } : null;
    const errorList = [];
    filesMetadataList.forEach(fileMetadata => {
      fileMetadata.errorList.forEach(error => {
        errorList.push(error);
      });
    });

    if (totalSizeAllFiles > 0) {
      this.log.trace('Update ancestor folders sizes');
      const [sizeUpdateErr] = await this.utils.to(this.entityUtils.updateFoldersSizeAsync(
        parentsToUpdate, totalSizeAllFiles, this.entityCacheService
      ));

      if (sizeUpdateErr) {
        errorList.push(sizeUpdateErr);
      }
    }

    return {
      instanceList,
      metadata,
      errorList
    };
  }

  /**
   * Override source image for one viewport
   *
   * @param {string} stackUuid - uuid of stack to modify
   * @param {string} viewportName - name of viewport to replace
   * @param {object} fileMetadata - object with file metadata
   * @param {boolean} revert - if true the viewport will be reverted to the original root image
   * @param {object} cropCoordinates - object with crop coordinates
   * @param {number} cropCoordinates.crop_offset_x - horizontal crop offset
   * @param {number} cropCoordinates.crop_offset_y - vertical crop offset
   * @param {number} cropCoordinates.crop_width - crop width
   * @param {number} cropCoordinates.crop_height - crop height
   * @param {function} performCleanupAsync - function to clean up the file upload in case of errors
   * @returns {object} object with 3 properties:
   *   - instance - updated root stack instance
   *   - metadata - response metadata
   *   - errorList - list of errors that occurred during request execution
   */
  async overrideOneViewportAsync(
    stackUuid,
    viewportName,
    fileMetadata,
    revert,
    cropCoordinates,
    performCleanupAsync
  ) {
    const { stackEntity, targetViewport, uploadResult } = fileMetadata;
    const { usage, storage_path: rootStoragePath } = stackEntity;
    // Get resize options config from DB and append preview image resolution
    const resizeOptions = (await this.configUtils.getConfig())[usage];
    resizeOptions.preview = this.fileRules.preview;
    const { storage_path: targetViewportStoragePath } = targetViewport;

    // In case of reverting or just cropping we will use the root image data
    // as the replacement / override
    let { bytes, name: fileName, storage_path: storagePath, content_type: mimeType } = stackEntity;
    const { width, height } = stackEntity;
    let imageDimensions = { width, height };
    let contentAsBuffer;
    let keepPreviousImage = false;

    // If we have an uploaded file, prepare its data and metadata
    // We already checked it is not sent at the same time as the revert option
    if (uploadResult) {
      this.log.trace(`Waiting [${fileName}] file upload to GCP Storage to end`);
      const value = await uploadResult;

      if (value instanceof Error) {
        // If the file is over the max size limit it will be truncated without throwing an error
        // and partially uploaded to cloud storage, thus we need to make sure to delete it
        // If no file is uploaded then the clean-up does nothing
        await performCleanupAsync();
        throw value;
      }

      bytes = value.bytes;
      imageDimensions = value.imageDimensions;
      contentAsBuffer = value.contentAsBuffer;
      mimeType = fileMetadata.mimeType;
      fileName = fileMetadata.fileName;
      storagePath = fileMetadata.storagePath;
    } else {
      // Due to validation checks performed until here if we reach this point
      // we must be in two situations: perform a simple crop (of whatever image
      // is associated with the viewport folder) or a revert to root image
      storagePath = revert ? storagePath : targetViewportStoragePath;
      const rootFileBucketHandle = this.cloudStorage.bucket.file(storagePath);
      const [fileDownloadErr, fileBuffer] = await this.utils.to(
        this.fileUtils.downloadFile(rootFileBucketHandle)
      );

      if (fileDownloadErr) {
        this.utils.httpErrors.throwInternalServerError(
          `Error downloading root file ${fileName}: ${fileDownloadErr.message} `,
          { errClass: this.errClass }
        );
      } else {
        contentAsBuffer = fileBuffer;
      }

      if (revert) {
        this.log.trace(`Reverting viewport to root image [${fileName}]`);
      } else {
        // If we are not reverting it means we are required to perform just a crop
        // so we must not touch the previous viewport image
        keepPreviousImage = true;
      }
    }

    // We need to check the replaced image size if provided
    this.log.trace(`Validate file [${fileName}] to be replaced`);
    const contentTypeParts = mimeType.split('/');
    const fileFormat = contentTypeParts[1].toLowerCase();
    const isImage = contentTypeParts[0].toLowerCase() === 'image';

    if (uploadResult
      && !imageDimensions?.error
      && isImage
      && !this.fileUtils.isFileDimensionOk(imageDimensions, resizeOptions)
    ) {
      // Don't throw if an error appears during bucket file deletion, since it is
      // an acceptable error in this case which should not break the stack update
      await this.utils.to(performCleanupAsync());

      this.utils.httpErrors.throwBadRequest(
        'Bad dimensions for file [{{fileName}}]',
        { errClass: this.errClass, params: { fileName } }
      );
    }

    const { supportedImageTypes } = this.fileRules;
    const isImageTypeSupported = isImage && supportedImageTypes.includes(fileFormat);
    if (!isImageTypeSupported) {
      this.utils.httpErrors.throwBadRequest(
        'This image type is not supported in stacks',
        { errClass: this.errClass }
      );
    }

    // TODO: Replace these with admin user UUID retrieved
    // from auth token when available
    const [modifiedBy, createdBy] = [this.utils.UUID.v4(), this.utils.UUID.v4()];

    const nextImageVersion = targetViewport.image_version + 1;
    // Keep previous file name so that the URL doesn't change (for SEO purposes)
    const previewPath = `${stackEntity.uuid}/${viewportName}/preview/`
      + `${nextImageVersion}/${stackEntity.name}`;

    const updatedViewportData = {
      // Change reference / link to file from cloud storage then delete old one at the end
      storage_path: storagePath,
      // Update image metadata as well
      content_type: mimeType,
      bytes,
      width: imageDimensions.width,
      height: imageDimensions.height,
      modified_by: modifiedBy,
      created_by: createdBy,
      image_version: nextImageVersion,
      preview_path: previewPath,
      ...cropCoordinates
    };

    const entityData = {
      targetViewportUuid: targetViewport.uuid
    };

    this.log.trace(`Update status for [${fileName}] stack entity (root)`);
    const [updatedStackRoot] = await this.stackUtils.updateStackStatus(
      stackUuid, 'pending', false
    );

    // Re-generate resized variants for viewport but don't await it, we don't want
    // to delay the request with background work
    (async () => {
      const [generationErr] = await this.utils.to(
        this.stackUtils.generateViewportVersions(
          this.resizeQueue,
          contentAsBuffer,
          viewportName,
          stackEntity,
          entityData,
          resizeOptions,
          updatedViewportData
        )
      );

      const generationErrorWasReceived = Boolean(generationErr);
      if (generationErrorWasReceived) {
        // Delete replacement file uploaded to cloud storage if the viewport DB
        // entity could not be updated because it will not be accessible in that case
        await this.utils.to(performCleanupAsync());
        this.log.error(`Error re-generating viewport: ${generationErr}`);
      }

      const statusUpdateData = generationErrorWasReceived ? 'error: override' : 'finished';
      await this.stackUtils.updateStackStatus(
        stackUuid, statusUpdateData, !generationErrorWasReceived
      );
    })();

    const instance = await this.entityUtils.addExtraEntityDataAsync(updatedStackRoot);
    const errorList = [];

    // Delete bucket file used before override
    // Make sure we're not deleting the root image file, which is the default source image
    // used for every viewport when generating its variants (if no override is made)
    if ((targetViewportStoragePath !== rootStoragePath) && !keepPreviousImage) {
      this.log.trace(`Delete bucket file used before override / replacement for [${fileName}]`);
      const previousBucketFile = this.cloudStorage.bucket.file(targetViewportStoragePath);

      // Don't throw if an error appears during bucket file deletion, since it is
      // an acceptable error in this case which should not break the stack update
      const [prevDeletionErr] = await this.utils.to(
        previousBucketFile.delete({ ignoreNotFound: true })
      );

      if (prevDeletionErr) {
        errorList.push(prevDeletionErr);
      }
    }

    return {
      instance,
      errorList
    };
  }

  /**
   * Generate full stack for empty stacks stored in DAM
   *
   * @param {Array<string>} uuids - list of stacks to generate (list of root stack UUIDs)
   * @param {string} usage - where the stack will be used
   * @param {string} resourceId - id of resource associated with the stack
   * @param {string} resourceType - type of resource associated with the stack
   * @param {string} resourceName - name of resource associated with the stack
   * @returns {object} - object with 3 properties:
   *   - instanceList - root stack instance list
   *   - metadata - response metadata
   *   - errorList - list of errors that occurred during request execution
   */
  async generateManyAsync(
    uuids,
    usage,
    resourceId,
    resourceType,
    resourceName
  ) {
    // Get resize options config from DB
    const resizeOptions = await this.configUtils.getConfig();
    const fileUsage = this.entityUtils.getFileUsage(
      resizeOptions,
      usage,
      resourceId,
      resourceType,
      resourceName
    );
    // Append preview image resolution
    fileUsage.resizeOptions.preview = this.fileRules.preview;

    const errorList = [];
    const dbFiles = await this.table.findAll({
      where: {
        uuid: uuids
      },
      raw: true
    });

    if (!dbFiles.length) {
      this.utils.httpErrors.throwNotFound('Files not found', { errClass: this.errClass });
    }

    const imageStackDetails = {};
    const uuidsToUpdate = [];

    const rootImages = dbFiles.filter(rootImage => {
      const isImage = rootImage.content_type?.split('/')[0] === 'image';
      const isEmptyStack = rootImage.type === 'stack:empty' && isImage;
      if (!isEmptyStack) {
        errorList.push(this.utils.httpErrors.throwBadRequest(
          'File [{{name}}] is not an empty stack',
          { errClass: this.errClass, params: { name: rootImage.name }, justReturnError: true }
        ));
        return false;
      }
      const file = this.cloudStorage.bucket.file(rootImage.storage_path);
      imageStackDetails[rootImage.uuid] = {
        file,
        isImageTypeSupported: true,
        previewPath: null
      };
      uuidsToUpdate.push(rootImage.uuid);
      return isEmptyStack;
    });

    // Update root image with new resource info and stack generation status
    const [bulkUpdateErr, updateResults] = await this.utils.to(this.table.update(
      { ...fileUsage.entityData, stack_status: 'pending' },
      {
        where: {
          uuid: uuidsToUpdate
        },
        returning: true
      }
    ));

    // Invalidate cache since stack was updated
    const invalidateCachePromises = [this.entityCacheService.invalidateAllLists()];
    uuidsToUpdate.forEach(uuid => {
      invalidateCachePromises.push(this.entityCacheService.invalidateItemOrPattern({ uuid }));
    });
    await Promise.allSettled(invalidateCachePromises);

    if (bulkUpdateErr) {
      await this.entityUtils.updateStackStatus(uuidsToUpdate, 'error: bulk update', false);
      this.utils.httpErrors.throwInternalServerError(
        'Error while trying to generate asset variation', { errClass: this.errClass }
      );
    }

    const [count = 0, updatedInstances] = updateResults;
    this.log.info(`[${moduleName}]: Modified ${count} instances`);

    // Not awaiting the Promise because stack generation shouldn't block the request
    // and it should happen in the background
    this.stackUtils.generateStack(
      this.resizeQueue, rootImages, fileUsage, imageStackDetails
    );

    const augmentedEntities = await Promise.all(
      updatedInstances.map(instance => this.entityUtils.addExtraEntityDataAsync(instance))
    );

    const instance = augmentedEntities?.length ? augmentedEntities : null;
    const metadata = instance ? { count: instance.length } : null;

    return {
      instance,
      metadata,
      errorList
    };
  }

  /**
   * Default filter used when creating a new stack, to avoid duplicates
   *
   * @param {object} data - payload data
   * @returns {object} ORM formatted query for duplication
   * @async
   */
  static getFilterForUniqueness(data) {
    return {
      where: {
        name: data.name,
        parent: data.parent || null
      }
    };
  }
}
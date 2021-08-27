import path from 'path';
import { fileURLToPath } from 'url';
import {
  bytesMeasurement,
  imageDimensionsMeasurement,
  contentAsBufferReducer
} from 'fastify-global-plugins/services/utils.js';

const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];
const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates stack upload hooks
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
export default async function entitiesHooksAsync(fastify) {
  const { utils, appConfig, instantiatedServices } = fastify;
  const { httpErrors } = utils;
  const { cloudStorage, entityUtils, stackUtils, fileUtils, configUtils } = instantiatedServices;
  const { fileRules: fileRulesConfig } = appConfig;
  const errClass = 106;

  /**
   * Prepare upload of files to cloud storage, will be used as a preValidation hook
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function prepareBulkUpload(req) {
    const { parent, usage, resource_id: resourceId } = req.query;
    const { resource_type: resourceType, resource_name: resourceName } = req.query;
    const { parseFormDataAsync } = fastify.multipart;

    // Handle case when the parent is the root folder, which is
    // received as the 'null' string in the query string value
    const parsedParent = parent === 'null' ? null : parent;
    req.query.parent = parsedParent;
    req.log.info('Preparing to upload files in '
      + `folder with uuid: '${parsedParent || 'root'}'`);

    // Getting resizeOptions config from DB
    const resizeOptions = await configUtils.getConfig();
    const fileUsage = entityUtils.getFileUsage(
      resizeOptions,
      usage,
      resourceId,
      resourceType,
      resourceName
    );

    req.fileUsage = fileUsage;

    const tagGroupsInFileOrder = [];
    const renamesInFileOrder = [];
    const filesMetadataList = [];

    const { naming, mimeTypes, maxFileBytes, maxFiles } = fileRulesConfig;
    const formDataOptions = {
      naming,
      mimeTypes,
      maxFileBytes,
      maxFiles,
      // Each file[] needs a tags[] and renames[] field
      maxFields: fileRulesConfig.maxFiles * 2,
      allowedFileFieldNames: ['files[]'],
      measurements: {
        imageDimensions: imageDimensionsMeasurement,
        bytes: bytesMeasurement
      }
    };

    const formDataFieldsMap = await parseFormDataAsync(
      req, formDataOptions, fieldData => fileUtils.processFileStreamAsync(fieldData)
    );

    if (!(formDataFieldsMap instanceof Map)) {
      httpErrors.throwBadRequest('The request is not multipart as expected', { errClass });
    }

    // Process formDataFieldsMap in order of received fields
    req.body = {};
    const { match, replaceWith } = fileRulesConfig.naming;
    [...formDataFieldsMap.entries()].forEach(([fieldName, fieldData]) => {
      let processedValue;

      switch (fieldName) {
        case 'files[]': {
          processedValue = [];
          fieldData.forEach(fileMetadata => {
            let content = '';
            let name = '';

            if (typeof fileMetadata === 'string') {
              content = 'plain form field';
              name = fileMetadata;
            } else if (this.utils.isObject(fileMetadata) && fileMetadata.fileName) {
              const { value, fileName } = fileMetadata;
              content = value;
              name = fileName;
            }
            filesMetadataList.push(fileMetadata);
            processedValue.push({
              content,
              name
            });
          });
          break;
        }
        case 'tags[]': {
          processedValue = [];
          fieldData.forEach(tagGroup => {
            const tagList = tagGroup.split?.(',')?.filter(Boolean);
            processedValue.push(tagList);
            tagGroupsInFileOrder.push(tagList);
          });
          break;
        }
        case 'renames[]': {
          processedValue = [];
          fieldData.forEach(rename => {
            const renameSanitized = rename.replace?.(match, replaceWith);
            processedValue.push(rename);
            renamesInFileOrder.push(renameSanitized);
          });
          break;
        }
        default: {
          processedValue = fieldData;
        }
      }

      // Prepare request body object so that the schema validation
      // step can check form data inputs
      req.body[fieldName] = processedValue;
    });

    /**
     * Delete files uploaded to cloud storage if the request is invalid
     *
     * @returns {Promise<void>}
     */
    const performCleanupAsync = async () => {
      const resultPromisesList = formDataFieldsMap.get('files[]')
        .map(({ uploadResult }) => uploadResult);
      const uploadResults = await Promise.allSettled(resultPromisesList);

      // We need to clean up only files that are successfully uploaded
      // to cloud storage, since failed uploads are not kept anyways
      const deletePromisesList = uploadResults
        .filter(({ status, value }) => ((status === 'fulfilled') && (!(value instanceof Error))))
        .map(({ value }) => value?.cleanUpAsync?.());
      await Promise.allSettled(deletePromisesList);
    };

    // We need a tag and rename field for every uploaded file, in the same
    // order as the files, empty if optional, otherwise we don't know how to
    // associate them i.e. file 2 has rename 2 and tags 2 (in form order)
    const fileCount = filesMetadataList.length;
    if (!fileCount) {
      httpErrors.throwBadRequest('No files were sent for upload', { errClass });
    } else if (fileCount !== tagGroupsInFileOrder.length) {
      await performCleanupAsync();
      httpErrors.throwBadRequest(
        'Number of tag groups must be equal with number of files, '
        + 'use empty string to skip tag for a file',
        { errClass }
      );
    } else if (fileCount !== renamesInFileOrder.length) {
      await performCleanupAsync();
      httpErrors.throwBadRequest(
        'Number of renames must be equal with number of files', { errClass }
      );
    }

    // Add tags and renames to their corresponding file metadata objects
    // These fields are sent in the order of file fields so they can be matched
    // by correlating their order of receipt
    filesMetadataList.forEach((file, index) => {
      const rename = renamesInFileOrder[index];
      const { uploadResult, uuid } = file;
      let possiblyRenamedFileUploadResult = uploadResult;

      if (rename?.length && (uploadResult instanceof Promise)) {
        const {
          storagePath: newStoragePath
        } = fileUtils.getStoragePath({ fileName: rename, uuid });
        // Update every metadata impacted by the file name change
        Object.assign(file, {
          fileName: rename,
          storagePath: newStoragePath
        });

        possiblyRenamedFileUploadResult = uploadResult.then(async result => {
          if (result instanceof Error) return result;

          await result.file.rename(newStoragePath);
          result.file = cloudStorage.bucket.file(newStoragePath);
          return result;
        });

        // Also update the req.body fields used for schema validation. In case of renames
        // we must only validate the renamed file, and ignore the original file name
        req.body['files[]'][index].name = rename;
      }

      Object.assign(file, {
        tags: tagGroupsInFileOrder[index],
        errorList: [],
        uploadResult: possiblyRenamedFileUploadResult
      });
    });

    req.filesMetadataList = filesMetadataList;
    req.performCleanupAsync = performCleanupAsync;
  }

  /**
   * Prepare override of stack viewport image, will be used as a preValidation hook
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<object>}
   * @async
   */
  async function prepareOverride(req) {
    const { viewport } = req.query;
    const { uuid: stackUuid } = req.params;
    req.log.info(`Preparing to override file in stack with uuid: ${stackUuid}`);
    const { parseFormDataAsync } = fastify.multipart;

    // We have to manually convert the query parameters since we are inside a preValidation hook
    const revert = Boolean(req.query.revert === 'true');
    const cropOffsetX = Number(req.query.crop_offset_x);
    const cropOffsetY = Number(req.query.crop_offset_y);
    const cropWidth = Number(req.query.crop_width);
    const cropHeight = Number(req.query.crop_height);

    const { targetViewport, stackEntity } = await stackUtils.checkStackModificationAsync(
      stackUuid, viewport, revert, cropOffsetX, cropOffsetY, cropWidth, cropHeight
    );

    const { naming, mimeTypes, maxFileBytes } = fileRulesConfig;
    const formDataOptions = {
      naming,
      mimeTypes,
      maxFileBytes,
      maxFiles: 1,
      maxFields: 0,
      allowedFileFieldNames: ['file'],
      measurements: {
        imageDimensions: imageDimensionsMeasurement,
        bytes: bytesMeasurement,
        contentAsBuffer: contentAsBufferReducer
      }
    };

    // The new file is uploaded with a new random UUID in its name and
    // will not conflict with any other file in the storage bucket.
    // We will later replace the overriden file with it
    const formDataFieldsMap = await parseFormDataAsync(
      req, formDataOptions, fieldData => fileUtils.processFileStreamAsync(fieldData)
    );

    // Process formDataFieldsMap
    req.body = {};
    let fileMetadata = null;

    if (formDataFieldsMap) {
      [...formDataFieldsMap.entries()].forEach(([fieldName, fieldData]) => {
        let processedValue;

        switch (fieldName) {
          case 'file': {
            let content = '';
            let name = '';

            fileMetadata = fieldData;
            if (typeof fileMetadata === 'string') {
              content = 'plain form field';
              name = fileMetadata;
            } else if (this.utils.isObject(fileMetadata) && fileMetadata.fileName) {
              const { value, fileName } = fileMetadata;
              content = value;
              name = fileName;
            }

            processedValue = {
              content,
              name
            };
            break;
          }
          default: {
            processedValue = fieldData;
          }
        }

        // Prepare request body object so that the schema validation
        // step can check form data inputs
        req.body[fieldName] = processedValue;
      });
    }

    if (!revert && !cropWidth && !cropHeight && !fileMetadata) {
      httpErrors.throwBadRequest(
        'There is nothing to update with the current inputs', { errClass }
      );
    }

    /**
     * Delete file uploaded to cloud storage if the request is invalid
     *
     * @returns {Promise<void>}
     */
    const performCleanupAsync = async () => {
      if (!fileMetadata?.uploadResult) return;
      const [uploadErr, value] = await utils.to(fileMetadata.uploadResult);

      // We need to clean up only if the file is successfully uploaded
      // to cloud storage, since failed uploads are not kept anyways
      if (!uploadErr && value?.cleanUpAsync) {
        await value.cleanUpAsync();
      }
    };

    if (revert && fileMetadata?.uploadResult) {
      await performCleanupAsync();
      httpErrors.throwBadRequest(
        'When reverting on override, no file should be sent for upload', { errClass }
      );
    }

    req.fileMetadata = {
      ...fileMetadata,
      targetViewport,
      stackEntity
    };
    req.performCleanupAsync = performCleanupAsync;
  }

  if (!fastify.hooks[version]) {
    fastify.hooks[version] = {};
  }

  fastify.hooks[version][moduleName] = {
    prepareBulkUpload,
    prepareOverride
  };
}
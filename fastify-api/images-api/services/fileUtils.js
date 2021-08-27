/**
 * Utils class used to manage sub-operations with entities
 */
export class FileUtils {
  /**
   * @param {object} opts - parameters object
   * @param {object} opts.fileNamingConfig - configuration for file naming
   * @param {object} opts.db - Sequelize instance
   * @param {object} opts.cloudStorage - cloud storage instance
   * @param {object} opts.log - Fastify logger instance
   * @param {object} opts.utils - utils dictionary
   * @returns {object} class instance
   */
  constructor({ fileNamingConfig, db, cloudStorage, log, utils }) {
    this.fileNamingConfig = fileNamingConfig;
    this.db = db;
    this.cloudStorage = cloudStorage;
    this.log = log;
    this.utils = utils;
    this.errClass = 108;
  }

  /**
   * Download file from storage bucket
   *
   * @param {File} gcpFile - the File object from GCP
   * @returns {Promise<Buffer>} - the buffer for the uploaded file
   */
  async downloadFile(gcpFile) {
    this.log.info('Downloading file from GCP');
    const [contents] = await gcpFile.download();
    return contents;
  }

  /**
   * Check file dimensions
   *
   * @param {Object} fileSize - object containing width and height
   * @param {Object} sizeConfig  - config containing min/max
   * @returns {void}
   */
  isFileDimensionOk(fileSize, sizeConfig) {
    this.log.info('Checking if file dimension is ok');
    const {
      min_rez_vertical: minRezVertical,
      min_rez_horizontal: minRezHorizontal,
      max_rez_vertical: maxRezVertical,
      max_rez_horizontal: maxRezHorizontal
    } = sizeConfig;
    const { width, height } = fileSize;
    if (!(
      width >= minRezHorizontal
      && width <= maxRezHorizontal
      && height >= minRezVertical
      && height <= maxRezVertical
    )) {
      return false;
    }
    return true;
  }

  /**
   * Process file stream from a multipart data payload. Files are streamed to a
   * cloud storage bucket.
   * This is the only way we can have end-to-end streaming of file uploads
   * from multi-part data to cloud storage upload.
   *
   * @param {object} fieldData - object with field metadata
   * @param {string} fieldData.fieldName - form field name
   * @param {string} fieldData.fileName - uploaded file name
   * @param {Stream} fieldData.fileStream - file contents as a stream
   * @param {string} fieldData.mimeType - file content type as mimeType
   * @param {string} fieldData.value - file content mock value for schema validation
   * @param {Map} fieldData.formDataFieldsMap - form data fields received so far
   * @param {object} fieldData.options - file validation rules
   * @param {object} fieldData.options.mimeTypes - list of allowed mimeTypes
   * @param {object} fieldData.options.measurements - measurements to perform on file stream
   * @param {object} fieldData.options.allowedFileFieldNames - allowed file filed names
   * @returns {Promise<object>} result object with the following properties:
   *   uploadResult (cloud upload operation Promise or Error), fileName,
   *   mimeType, uuid, storagePath, errorList
   */
  async processFileStreamAsync(fieldData) {
    const {
      fieldName,
      fileName,
      fileStream,
      mimeType,
      options,
      value
    } = fieldData;

    let uploadResult = null;
    const { mimeTypes, measurements, allowedFileFieldNames } = options;
    const uuid = this.utils.UUID.v4();
    const { storagePath, sanitizedFileName } = this.getStoragePath({ fileName, uuid });

    if (!allowedFileFieldNames.includes(fieldName)) {
      // Consume the file stream so that it doesn't block the request
      fileStream.resume();

      const fileFieldNameErr = this.utils.httpErrors.throwBadRequest(
        'File upload failed for [{{fileName}}] '
        + 'because an invalid fieldName was used',
        {
          errClass: this.errClass,
          params: { fileName },
          justReturnError: true
        }
      );

      return {
        uploadResult: fileFieldNameErr,
        fileName,
        mimeType,
        uuid: null,
        storagePath: null,
        value
      };
    }

    // First check content type via mimeType and skip it if it's not allowed
    if (mimeTypes.includes(mimeType)) {
      // The upload must start immediately because we receive files and their
      // streams one after another, interlaced with other form fields.
      // We will pipe the multi-part file stream directly to the cloud storage
      // upload stream so that we only store small chunks of files in memory
      uploadResult = this.cloudStorage.upload(fileStream, {
        mimeType, storagePath, measurements
      }).then(async result => {
        // If the file was over the size limit we need to clean it from cloud storage
        // because it is just partially uploaded and then return an error for this
        if (fileStream.truncated) {
          const { maxFileBytes } = options;
          await result.cleanUpAsync();
          return this.utils.httpErrors.throwBadRequest(
            'File upload failed for [{{fileName}}] because file size exceeds '
            + 'maximum limit of [{{maxFileBytes}}] bytes',
            {
              params: { fileName, maxFileBytes },
              errClass: this.errClass,
              justReturnError: true
            }
          );
        }
        return result;
      });
    } else {
      uploadResult = this.utils.httpErrors.throwBadRequest(
        'File upload failed for [{{fileName}}] '
        + 'because content type is not allowed',
        {
          errClass: this.errClass,
          params: { fileName },
          justReturnError: true
        }
      );

      // Consume the file stream so that it doesn't block the request
      fileStream.resume();
    }

    return {
      uploadResult,
      fileName: sanitizedFileName,
      mimeType,
      uuid,
      storagePath,
      value
    };
  }

  /**
   * Determine cloud storage path for an input file
   *
   * @returns {Promise<void>}
   */
  getStoragePath({ fileName, uuid }) {
    const { match, replaceWith } = this.fileNamingConfig;
    const sanitizedFileName = fileName.replace(match, replaceWith);
    const storagePath = `${uuid}/o/${sanitizedFileName}`;
    return { storagePath, sanitizedFileName };
  }
}
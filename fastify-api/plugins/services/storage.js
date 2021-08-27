import { Storage } from '@google-cloud/storage';
import util from 'util';
import { pipeline, Stream } from 'stream';
import { bufferToIterator } from './utils.js';

const pump = util.promisify(pipeline);

/**
 * Storage wrapper class
 */
export class StorageBucket {
  /**
   * Google cloud storage wrapper
   *
   * @param {bucket} bucketName - name of the bucket from the cloud storage
   * @param {object} utils - utils dictionary
   */
  constructor(bucketName, utils) {
    // Cloud Storage client configuration is taken from the file path stored in the
    // GOOGLE_APPLICATION_CREDENTIALS env variable (as the docs recommend)
    // See https://cloud.google.com/docs/authentication/production
    this.storage = new Storage();
    this.utils = utils;
    this.bucket = this.storage.bucket(bucketName);
  }

  /**
   * Upload file to cloud storage
   *
   * @param {Stream|Buffer|string} inputStream - file stream to pipe to Cloud storage
   * @param {object} options - upload options
   * @param {string} options.storagePath - file path that indicates
   *   where to store the file in the bucket
   * @param {string} [options.mimeType = "application/octet-stream"]
   *   mimeType of file
   * @param {object} [options.measurements = {}]
   *   measurements to perform on input file stream
   *   See makeStreamMeasurementsIterator JSDoc
   * @returns {Promise<object>} object with measurement results plus:
   *   - a cleanUpAsync property which contains an async function that deletes
   *   the file from the bucket (if a clean-up / rollback is needed)
   */
  async upload(inputStream, options) {
    const { storagePath, mimeType, measurements = {} } = options;
    if (!(inputStream instanceof Stream
      || inputStream instanceof Buffer
      || typeof inputStream === 'string') || !storagePath) {
      throw new TypeError('Bad stream (Stream|Buffer|string) or storagePath inputs');
    }

    const file = this.bucket.file(storagePath);
    const uploadStreamOptions = {
      resumable: false,
      contentType: mimeType || 'application/octet-stream'
    };
    const storageUploadStream = file.createWriteStream(uploadStreamOptions);

    const {
      reduceStreamAsyncIterator,
      measurementResults
    } = this.utils.makeStreamIterator(measurements);

    const processedInput = inputStream instanceof Stream
      ? inputStream
      : bufferToIterator(inputStream);

    await pump(
      processedInput,
      reduceStreamAsyncIterator,
      storageUploadStream
    );

    return {
      ...measurementResults,
      cleanUpAsync: () => file.delete({ ignoreNotFound: true }),
      file
    };
  }
}
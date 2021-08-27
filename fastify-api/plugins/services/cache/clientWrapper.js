/* eslint-disable valid-jsdoc */
import { promisify } from 'util';
import { hashThis } from '../utils.js';

const waitAsync = promisify(setTimeout);

/**
 * Caching client wrapper
 */
export default class ClientWrapper {
  /**
   * Cache constructor
   *
   * Make sure that the caching service does not last more than the
   * original data request. For SQL DBs, a query takes at least a few ms
   * and a cached request should not take longer than an actual DB request,
   * in all cases except cache deletion.
   *
   * @param {object} cacheClient - cache client instance to use
   * @param {string} namespace - namespace to be used as prefix for all cache keys
   * @param {object} log - logger instance which must have .trace
   *   property that maps to trace log level

   * @returns {void}
   */
  constructor(cacheClient, namespace, log) {
    this.cacheClient = cacheClient;
    this.namespace = namespace;
    this.log = log;
    // Set default runtime configuration options
    this.setRuntimeConfig({
      timeoutMs: 5000,
      deleteBatchSize: 50
    });
  }

  /**
   * Handle run-time configuration options changes.
   * If only one option is given to be updated, the other ones keep their values.
   * The options are provided via an object because this allows us to change only a subset
   * of all values, regardless of their order, which is not always possible with function params.
   * Use an arrow function to allow easy function passing as an event handler
   *
   * @param {object} opts - config object
   * @param {number} opts.timeoutMs - timeout after which cache queries are aborted
   * @param {number} opts.deleteBatchSize - size of commands pipeline / buffer
   * @returns {void}
   */
  setRuntimeConfig = (opts) => {
    const optionNames = ['deleteBatchSize', 'timeoutMs'];
    optionNames.forEach(optionName => {
      // Only update the provided options
      if (Object.prototype.hasOwnProperty.call(opts, optionName)) {
        this[optionName] = opts[optionName];
      }
    });
  }

  /**
   * Throws a timeout error.
   * Use an arrow function to allow easy function passing
   *
   */
  throwTimeoutError = () => {
    throw new Error(`Timeout of ${this.timeoutMs}ms exceeded`);
  }

  /**
   * Set a value:key pair in the cache, with specified TTL (defaults to 60 seconds).
   * The default value is chosen to be 60 seconds to mitigate the risk of
   * having a failed delete key query which would cause a cache invalidation to
   * also fail and thus produce wrong / outdated get response for at most 60 seconds
   *
   * @param {string} key
   * @param {any} value
   * @param {number} ttl
   * @param {boolean} useJson
   * @param {boolean} useKeyHashing
   * @returns {Promise<any>}
   */
  async set(key, value, ttl = 60, useJson = true, useKeyHashing = false) {
    const scopedKey = `${this.namespace}:${key}`;
    const finalKey = useKeyHashing ? hashThis(scopedKey) : scopedKey;
    const finalValue = useJson ? JSON.stringify(value) : value;

    try {
      await Promise.race([
        this.cacheClient.set(finalKey, finalValue, 'EX', ttl),
        waitAsync(this.timeoutMs).then(this.throwTimeoutError)
      ]);
      return true;
    } catch (err) {
      this.log.trace(`Error in clientWrapper.set(): ${err.message}`);
      return null;
    }
  }

  /**
   * Returns a value from the cache, based on specified key
   *
   * @param {string} key
   * @param {boolean} useJson
   * @param {boolean} useKeyHashing
   * @returns {Promise<any>}
   */
  async get(key, useJson = true, useKeyHashing = false) {
    const scopedKey = `${this.namespace}:${key}`;
    const finalKey = useKeyHashing ? hashThis(scopedKey) : scopedKey;

    try {
      let result = await Promise.race([
        this.cacheClient.get(finalKey),
        waitAsync(this.timeoutMs).then(this.throwTimeoutError)
      ]);

      if (useJson === true) {
        result = JSON.parse(result);
      }
      return result;
    } catch (err) {
      this.log.trace(`Error in clientWrapper.get(): ${err.message}`);
      return null;
    }
  }

  /**
   * Return TTL of specified key in seconds
   *
   * @param {string} key
   * @param {boolean} useKeyHashing
   * @returns {number}
   */
  async ttl(key, useKeyHashing = false) {
    const scopedKey = `${this.namespace}:${key}`;
    const finalKey = useKeyHashing ? hashThis(scopedKey) : scopedKey;

    try {
      const ttl = await Promise.race([
        this.cacheClient.ttl(finalKey),
        waitAsync(this.timeoutMs).then(this.throwTimeoutError)
      ]);

      return ttl;
    } catch (err) {
      this.log.trace(`Error in clientWrapper.ttl(): ${err.message}`);
      return null;
    }
  }

  /**
   * Remove specified key from the cache
   *
   * @param {string} key
   * @param {boolean} useKeyHashing
   * @returns {Promise<any>}
   */
  async delete(key, useKeyHashing = false) {
    const scopedKey = `${this.namespace}:${key}`;
    const finalKey = useKeyHashing ? hashThis(scopedKey) : scopedKey;

    try {
      await this.cacheClient.del(finalKey);
      return true;
    } catch (err) {
      this.log.trace(`Error in clientWrapper.delete(): ${err.message}`);
      return null;
    }
  }

  /**
   * Remove specified keys from the cache in batches. We use a pipeline to group
   * multiple commands together and send them all at once for better performance.
   * UNLINK is very similar to DEL: it just unlinks the keys from the keyspace.
   * The actual removal will happen later asynchronously.
   * https://tech.oyorooms.com/finding-and-deleting-the-redis-keys-by-pattern-the-right-way-123629d7730
   *
   * @param {string} like
   * @returns {Promise<void>}
   */
  async deleteLikeKey(like = '*') {
    try {
      // First test the connection to Redis
      await this.cacheClient.info();

      // Build a stream that emits with batches of found keys
      // (the keys are searched with the provided pattern)
      const streamCache = this.cacheClient.scanStream({
        match: `${this.namespace}:${like}`,
        count: this.deleteBatchSize
      });

      // Initialiaze pipeline buffer
      // eslint-disable-next-line require-jsdoc
      const makePipeline = () => this.cacheClient.pipeline();
      let pipeline = makePipeline();
      let currentPipelineSize = 0;
      let totalCount = 0;

      await new Promise((resolve, reject) => {
        currentPipelineSize = 0;

        // When we receive a batch of found keys we will
        streamCache.on('data', resultKeys => {
          if (!resultKeys.length) return;

          // Count progress so far
          currentPipelineSize += resultKeys.length;
          totalCount += resultKeys.length;

          // Add a `unlink key` command to the pipeline / buffer of Redis commands
          pipeline.unlink(resultKeys);

          // When enough commands are in the pipeline / buffer, send it to the server
          if (currentPipelineSize > this.deleteBatchSize) {
            pipeline.exec();

            // Reset pipeline buffer
            currentPipelineSize = 0;
            pipeline = makePipeline();
          }
        });
        streamCache.on('error', reject);
        // When the stream ends we also flush any remaining commands in the pipeline
        streamCache.on('end', () => pipeline.exec(() => resolve(totalCount)));
      });

      return totalCount;
    } catch (err) {
      this.log.trace(`Error in clientWrapper.deleteLikeKey(): ${err.message}`);
      return null;
    }
  }

  /**
   * The native cache handler
   *
   * @returns {object}
   */
  handle() {
    return this.cacheClient;
  }
}
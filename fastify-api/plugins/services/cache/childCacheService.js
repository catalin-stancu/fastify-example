/**
 * Cache child service specialized for a given resource controller which
 * provides common high level cache operations
 */
export default class ChildCacheService {
  static globalDisable = false;

  /**
   * @typedef extractFunction
   * @type {function}
   * @param {object} idKeys - object which contains the unique keys
   *   (can also be an model /row instance if it contains these id fields)
   *   that specify the item to be deleted
   * @returns {string} stringified unique id
   */

  /**
   * Create a cache child service
   *
   * @constructor
   * @param {ClientWrapper} clientWrapper - caching client wrapper instance to use
   * @param {string} resourceName - the module name used to scope the key names
   * @param {extractFunction} extractUniqueIdFn - a function to extract a
   *   string which must identify uniquely each individual instance
   *   value: (idKeys: object) => string
   * @param {object} log - logger instance which must have .info and .trace
   *   properties that map to those log levels
   */
  constructor(clientWrapper, resourceName, extractUniqueIdFn, log) {
    this.clientWrapper = clientWrapper;
    this.resourceName = resourceName;
    this.extractUniqueIdFn = extractUniqueIdFn;
    this.log = log;
    // Set default runtime configuration options
    this.setRuntimeConfig({ disabled: false });
  }

  /**
   * Handle run-time configuration options changes globally (across all instances of the class)
   * Useful for debugging, in tests.
   *
   * @param {object} opts - config object
   * @param {number} opts.globalDisable - if true, the all caching instances will not cache.
   *   This override the instance level `disabled` option
   * @returns {void}
   */
  static setGlobalRuntimeConfig({ globalDisable }) {
    ChildCacheService.globalDisable = globalDisable;
  }

  /**
   * Handle run-time configuration options changes, only for this instance
   * Useful for debugging, in tests.
   * Use an arrow function to allow easy function passing as an event handler
   *
   * @param {object} opts - config object
   * @param {number} opts.disabled - if true this instance will not cache.
   *   This is overriden at the global level by the static `globalDisable`
   *   option if that is set to true. If `globalDisable` is false, then only
   *   `disabled` decides if caching is enabled or not for the instance.
   * @returns {void}
   */
  setRuntimeConfig = ({ disabled }) => {
    this.disabled = disabled;
  }

  /**
   * Find a list stored in cache, uniquely identified by the search query
   *
   * @param {object} query - search query to uniquely identify the results
   * @returns {Promise<any>} found value if an item was found, or null otherwise
   */
  async getListAsync(query) {
    if (ChildCacheService.globalDisable || this.disabled) return null;

    const cacheKey = `${this.resourceName}:find:${JSON.stringify(query)}`;
    this.log.trace(`Checking [${this.resourceName}] cache for results`);

    const foundInCache = await this.clientWrapper.get(cacheKey);
    if (foundInCache) {
      const ttl = await this.clientWrapper.ttl(cacheKey);
      this.log.trace(`[${this.resourceName}] cache hit! TTL: ${ttl} seconds`);
      return foundInCache;
    }

    this.log.trace(`[${this.resourceName}] cache not hit. `
      + 'Standard operations started');
  }

  /**
   * Alias for getListAsync()
   *
   * @param {object} query - search query to uniquely identify the results
   * @returns {Promise<any>} found value if an item was found, or null otherwise
   */
  async getList(query) {
    return this.getListAsync(query);
  }

  /**
   * Save a list to cache, and each individual item in it separately
   *
   * @param {object} query - search query to uniquely identify the results
   * @param {any} listOutput - list value to cache
   * @param {Array<object>} itemsList - optional array of individual items to
   *   cache from the list
   * @returns {Promise<void>}
   */
  async saveListAndItemsAsync(query, listOutput, itemsList = []) {
    if (ChildCacheService.globalDisable || this.disabled) return null;

    const cacheKey = `${this.resourceName}:find:${JSON.stringify(query)}`;

    // Save list to cache
    const listPromise = this.clientWrapper.set(cacheKey, listOutput);

    // Save each single element to cache, in parallel
    const itemsPromisesList = itemsList.map(row => {
      const cacheKeySingle = `${this.resourceName}:findById:`
      + this.extractUniqueIdFn(row);
      return this.clientWrapper.set(cacheKeySingle, row);
    });

    const results = await Promise.all([listPromise, ...itemsPromisesList]);
    const setCount = results.reduce((first, second) => first + second);
    if (setCount) {
      this.log.trace(`Cached [${this.resourceName}] list results`);
    }
  }

  /**
   * Alias for saveListAndItemsAsync()
   *
   * @param {object} query - search query to uniquely identify the results
   * @param {any} listOutput - list value to cache
   * @param {Array<object>} itemsList - optional array of individual items to
   *   cache from the list
   * @returns {Promise<void>}
   */
  async saveListAndItems(...args) {
    return this.saveListAndItemsAsync(...args);
  }

  /**
   * Find an instance stored in cache, uniquely identified by the idKeys properties
   *
   * @param {object} idKeys - object which contains the unique keys
   *   (can also be an model /row instance if it contains these id fields)
   *   that specify the item to be deleted,
   * @returns {Promise<any>} found value if an item was found, or null otherwise
   */
  async getItemAsync(idKeys) {
    if (ChildCacheService.globalDisable || this.disabled) return null;

    const cacheKey = `${this.resourceName}:findById:`
      + this.extractUniqueIdFn(idKeys);

    this.log.trace(`Checking [${this.resourceName}] cache for results`);
    const foundInCache = await this.clientWrapper.get(cacheKey);

    if (foundInCache) {
      const ttl = await this.clientWrapper.ttl(cacheKey);
      this.log.trace(`[${this.resourceName}] cache hit! TTL: ${ttl} seconds`);
      return foundInCache;
    }

    this.log.trace(`[${this.resourceName}] cache not hit. `
      + 'Standard operations started');
  }

  /**
   * Alias for getItemAsync()
   *
   * @param {object} idKeys - object which contains the unique keys
   *   (can also be an model /row instance if it contains these id fields)
   *   that specify the item to be deleted,
   * @returns {Promise<any>} found value if an item was found, or null otherwise
   */
  async getItem(...args) {
    return this.getItemAsync(...args);
  }

  /**
   * Save an instance in the cache
   *
   * @param {object} value - value to save
   * @returns {Promise<void>}
   */
  async saveItemAsync(value) {
    if (ChildCacheService.globalDisable || this.disabled) return null;

    const cacheKey = `${this.resourceName}:findById:${this.extractUniqueIdFn(value)}`;
    const success = await this.clientWrapper.set(cacheKey, value);
    if (success) {
      this.log.trace(`Cached [${this.resourceName}] result`);
    }
  }

  /**
   * Alias for saveItemAsync()
   *
   * @param {object} value - value to save
   * @returns {Promise<void>}
   */
  async saveItem(...args) {
    return this.saveItemAsync(...args);
  }

  /**
   * Deletes all lists stored in this cache child service
   * The time is logged as well since it's pretty large in many cases (up to 70ms)
   *
   * @returns {Promise<void>}
   */
  async invalidateAllListsAsync() {
    if (ChildCacheService.globalDisable || this.disabled) return null;

    const startTime = process.hrtime.bigint();
    const deleteCount = await this.clientWrapper
      .deleteLikeKey(`${this.resourceName}:find:*`);

    if (deleteCount) {
      const queryTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      this.log.trace(`Deleted ${deleteCount} [${this.resourceName}] key in ${queryTimeMs}ms`);
    }
  }

  /**
   * Alias for invalidateAllListsAsync()
   *
   * @returns {Promise<void>}
   */
  async invalidateAllLists(...args) {
    return this.invalidateAllListsAsync(...args);
  }

  /**
   * Deletes the specified item(s) from the cache
   * The time is logged as well since it's pretty large in many cases (up to 70ms)
   *
   * @param {object} idKeys - object which contains the unique keys
   *   (can also be an model /row instance if it contains these id fields)
   *   that specify the item to be deleted, can be a glob pattern as well
   *   i.e. a value of `*` will become a `:*` match pattern in the key scan
   * @returns {Promise<void>}
   *
   * @example
   * // Deletes item with uuid1 and version1
   * invalidateItemOrPattern({ uuid: uuid1, version: version1 });
   *
   * // Deletes all versions with same uuid
   * invalidateItemOrPattern({ uuid: uuid1, version: '*' });
   *
   * // Deletes all uuids and all versions
   * invalidateItemOrPattern({ uuid: '*', version: '*' });
   */
  async invalidateItemOrPatternAsync(idKeys) {
    if (ChildCacheService.globalDisable || this.disabled) return null;

    let suffix = this.extractUniqueIdFn(idKeys);

    const wildcardRegex = new RegExp(/\*(:\*)*$/);
    const searchRequiresGlobPattern = wildcardRegex.test(suffix);

    let deleteCount;
    const startTime = process.hrtime.bigint();

    if (searchRequiresGlobPattern) {
      // Simplify patterns like "prefix:*:*:*" to "prefix:*"
      suffix = suffix.replace(wildcardRegex, '*');

      deleteCount = await this.clientWrapper.deleteLikeKey(
        `${this.resourceName}:findById:${suffix}`
      );
    } else {
      deleteCount = Number(await this.clientWrapper
        .delete(`${this.resourceName}:findById:${suffix}`));
    }

    if (deleteCount) {
      const queryTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      this.log.trace(`Deleted ${deleteCount} [${this.resourceName}] keys in ${queryTimeMs}ms`);
    }
  }

  /**
   * Alias for invalidateItemOrPatternAsync()
   *
   * @param {object} idKeys - object which contains the unique keys
   *   (can also be an model /row instance if it contains these id fields)
   *   that specify the item to be deleted, can be a glob pattern as well
   *   i.e. a value of `*` will become a `:*` match pattern in the key scan
   * @returns {Promise<void>}
   */
  async invalidateItemOrPattern(...args) {
    return this.invalidateItemOrPatternAsync(...args);
  }
}
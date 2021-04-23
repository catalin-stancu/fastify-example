/**
 * Simple caching wrapper
 */
 class Cache {
    /**
     * Cache constructor
     * @returns {void}
     */
    constructor(redisClient) {
        this.cache = redisClient;
        this.eventLocation = 'ro';
    }

    /**
     * Set a value:key pair in the cache, with specified TTL
     * @param {string} key
     * @param {any} value
     * @param {number} ttl
     * @param {boolean} useJson
     * @returns {Promise<*>}
     */
    async set(key, value, ttl = 60, useJson = true) {
        // prefix with current service name
        key = `${this.eventLocation}:${key}`;
        if (useJson === true) value = JSON.stringify(value);
        return this.cache.set(key, value, 'EX', ttl);
    }

    /**
     * Returns a value from the cache, based on specified key
     * @param {string} key
     * @param {boolean} useJson
     * @returns {Promise<*>}
     */
    async get(key, useJson = true) {
        // prefix with current service name
        key = `${this.eventLocation}:${key}`;
        if (useJson === true) return JSON.parse(await this.cache.get(key));
        return this.cache.get(key);
    }

    /**
     * Return TTL of specified key in seconds
     * @param {string} key
     * @returns {number}
     */
    async ttl(key) {
        // prefix with current service name
        key = `${this.eventLocation}:${key}`;
        return this.cache.ttl(key);
    }

    /**
     * Remove specified key from the cache
     * @param {string} key
     * @returns {Promise<*>}
     */
    async delete(key) {
        // prefix with current service name
        key = `${this.eventLocation}:${key}`;
        return this.cache.del(key);
    }

    /**
     * Remove specified keys from the cache
     * Launches non-blocking async events, doesn't return anything
     * @param {string} like
     * @returns {void}
     */
    deleteLikeKey(like = '*') {
        // prefix with current service name
        like = `${this.eventLocation}:${like}`;
        const streamCache = this.cache.scanStream({match: like, count: 100});
        let pipeline = this.cache.pipeline(),
            localKeys = [];
        streamCache.on('data', (resultKeys) => {
            const length = resultKeys.length;
            for (let i = 0; i < length; i++) {
                localKeys.push(resultKeys[i]);
                pipeline.del(resultKeys[i]);
            }
            if (localKeys.length > 100) {
                pipeline.exec(() => {
                    console.log("One batch of cache keys delete complete");
                });
                localKeys = [];
                pipeline = this.cache.pipeline();
            }
        });
        streamCache.on('end', () => {
            pipeline.exec(() => {
                console.log("Final batch of cache keys delete complete");
            });
        });
        streamCache.on('error', (err) => {
            throw err;
        });
    }
}

module.exports = Cache
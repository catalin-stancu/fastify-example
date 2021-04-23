const fp = require('fastify-plugin');
const Cache = require('../utils/cache');

module.exports = fp(async (fastify, opts) => {
    const cacheService = new Cache(fastify.redis);
    fastify.decorate('cacheService', cacheService);
}, {
    name: 'cacheService',
    dependencies: ['redisClient']
});
const fp = require('fastify-plugin');

module.exports = fp(async (fastify, opts) => {
    fastify.register(require('fastify-redis'), {
        port: process.env.CACHE_REMOTE_PORT,
        host: process.env.CACHE_HOST_DEV
    })
}, {
    name: 'redisClient'
});
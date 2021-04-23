const fp = require('fastify-plugin');

module.exports = fp(async (fastify, opts) => {
    fastify.register(require('fastify-swagger'), {
        routePrefix: '/swagger',
        swagger: {
          info: {
            title: 'Fastify Example API',
            description: 'Testing the fastify swagger api',
            version: '0.1.0'
          },
          externalDocs: {
            url: 'https://swagger.io',
            description: 'Find more info here'
          },
          host: 'localhost:3000',
          schemes: ['http'],
          consumes: ['application/json'],
          produces: ['application/json'],
        },
        exposeRoute: true
      })
});
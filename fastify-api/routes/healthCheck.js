'use strict'

module.exports = async (fastify, opts) => {
  fastify.route({
    url: '/',
    method: 'GET',
    schema: {
      tags: ['Healthcheck'],
      description: 'Healtcheck endpoint to determine if service is up and running',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            timestamp: {type: 'string', format: 'date-time' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      return { success: true, timestamp: new Date().toISOString() }
    }
  })
}

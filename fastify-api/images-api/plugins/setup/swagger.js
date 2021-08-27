import fp from 'fastify-plugin';
import Swagger from 'fastify-swagger';
import fs from 'fs';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates Swagger documentation generation
 * https://github.com/fastify/fastify-swagger
 * Swagger spec docs https://swagger.io/specification/
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - extra configuration or override options
 *   object to be passed to the swagger plugin instances
 * @param {string} opts.routePrefix - route used to load swagger docs
 * @param {any} opts.[overrides] - any extra options will be passed to the
 *   swagger plugin and will override any default options that are set here
 * @returns {Promise<void>}
 * @async
 */
async function swaggerAsync(fastify, opts) {
  const { routePrefix = '/docs' } = opts;
  // We provide the path relative to the CWD (server.js location)
  const packageData = JSON.parse(fs.readFileSync(path.resolve('./package.json')));
  const { version, description, title, homepage } = packageData;

  // The prefix field in options determines where to serve the OpenAPI files
  const swaggerOptions = {
    // The OpenAPI document header.
    openapi: {
      openapi: '3.0.3',
      info: {
        title,
        description,
        version
      },
      externalDocs: {
        url: homepage,
        description: 'Find more info here'
      },
      components: {
        securitySchemes: {}
      }
    },
    // Whether to serve the Swagger-UI
    exposeRoute: true,

    // Generated Docs UI config
    uiConfig: {
      filter: true,
      showCommonExtensions: true,
      defaultModelsExpandDepth: -1,
      defaultModelExpandDepth: 5
    },
    hideUntagged: true,
    routePrefix,
    ...opts
  };

  // Swagger documentation generator for Fastify. It uses metadata added to
  // the schemas to generate a swagger compliant doc.
  fastify.register(Swagger, swaggerOptions);

  fastify.log.info('Documentation is generated at: http://localhost:'
      + `${fastify.env.PORT}${routePrefix}`);
}

export default fp(swaggerAsync, {
  name: moduleName
});
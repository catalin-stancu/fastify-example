import fp from 'fastify-plugin';
import S from 'fluent-json-schema';
import http from 'http';
import path from 'path';
import globalSchemasObj, {
  updateSchema as updateSchemaNoAddProps
} from '../services/globalSchemas.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin loads global schemas
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {object} opts.unsafeAllowExtraPropsByDefault - options object
 * @param {object} opts.globalSchemas - object with schema factories as
 *   property values; each one will be called to generate a schema which
 *   will be added to the fastify schema store
 * @param {function} opts.updateSchema - this function will be applied to
 *   every schema that is declared for every route added in fastify
 * @param {any} opts.[extraOpts] - any extra options will be passed to the
 *   global schema factories that are declared in globalSchemas
 * @returns {Promise<void>}
 * @async
 */
async function loadGlobalSchemasAsync(fastify, opts) {
  const {
    unsafeAllowExtraPropsByDefault = false,
    globalSchemas = globalSchemasObj,
    updateSchema = updateSchemaNoAddProps,
    ...extraOpts
  } = opts;

  const { getSchema, validatorCompiler } = fastify;
  // The `addSchema` method needs the fastify instance to be bound to its `this`
  const addSchema = fastify.addSchema.bind(fastify);

  // Load every global schema
  Object.values(globalSchemas)
    .forEach(getGlobalSchema => addSchema(getGlobalSchema(extraOpts)));

  // Load a customized schema for every status code response in HTTP
  Object.entries(http.STATUS_CODES)
    .forEach(([statusCode, shortDescription]) => {
      let schema;
      if (statusCode >= 200 && statusCode < 300) {
        schema = S.object()
          .id(`#global.response.${statusCode}`)
          .description(`${shortDescription} success response`)
          .prop('messages', getSchema('#global.responseMessages'));
      } else if (statusCode >= 400 && statusCode < 600) {
        schema = S.object()
          .id(`#global.response.${statusCode}`)
          .description(`${shortDescription} response`)
          .extend(getSchema('#global.errorResponse'));
      }

      if (schema) {
        addSchema(schema);
      }
    });

  // Add hooks to modify input validation JSON schemas so that
  // they don't allow extra properties
  const removeExtraPropsOpts = {
    body: true,
    headers: false,
    params: false,
    query: false,
    response: true,
    ...opts?.removeExtraProps
  };

  // If a schema is not specified for body or query etc. fastify will allow
  // anything to pass validation and to be used in the handlers. We must not
  // allow this in order to prevents bugs where we forget to place a schema
  // and the code handles inputs that did not pass validation.
  if (!unsafeAllowExtraPropsByDefault) {
    fastify.addHook('onRoute', route => {
      const { method, path: routePath, schema: routeSchema } = route;
      if (routeSchema) {
        const routeMetaSchema = S.object()
          .additionalProperties(false)
          // Request inputs from client
          .prop('query', S.object())
          .prop('querystring', S.object())
          .prop('body', S.object())
          .prop('params', S.object())
          .prop('headers', S.object())
          .prop('response', S.object())
          // OpenAPI specific metadata
          .prop('hide', S.boolean())
          .prop('description', S.string())
          .prop('summary', S.string())
          .prop('tags', S.array().items(S.string()))
          .prop('security', S.array().items(S.object()))
          .prop('consumes', S.array().items(S.string()))
          .valueOf();

        // Validate the schema types / fields (to prevent typos) in
        // the route definitions and show message to prevent silent bugs
        const routeSchemaDefValidator = validatorCompiler({
          schema: routeMetaSchema
        });

        const validationResult = routeSchemaDefValidator(routeSchema);
        if (!validationResult) {
          const problematicRoute = `${method} ${routePath}`;
          const allowedFields = Object.keys(routeMetaSchema.properties).join(', ');
          const inputFields = Object.keys(routeSchema).join(', ');

          throw new Error(`Bad schema types [${inputFields}] in `
            + `${problematicRoute} route definition; `
            + `allowed values are: ${allowedFields}`);
        }

        // Modify all schemas to disallow additional properties by default
        // This is applied only if the original schema doesn't specify a
        // specific value for additionalProperties (neither true nor false)
        if (removeExtraPropsOpts.body) {
          routeSchema.body = updateSchema(
            routeSchema?.body?.valueOf()
          ) || undefined;
        }
        if (removeExtraPropsOpts.headers) {
          routeSchema.headers = updateSchema(
            routeSchema?.headers?.valueOf()
          ) || undefined;
        }
        if (removeExtraPropsOpts.params) {
          routeSchema.params = updateSchema(
            routeSchema?.params?.valueOf()
          ) || undefined;
        }
        // Fastify allows us to use both querystring and query
        if (removeExtraPropsOpts.querystring || removeExtraPropsOpts.query) {
          routeSchema.query = updateSchema(
            routeSchema?.querystring?.valueOf()
            || routeSchema?.query?.valueOf()
          ) || undefined;
        }
        // Remove additional properties from response schemas too
        if (removeExtraPropsOpts.response) {
          if (!route?.schema?.response) return;

          Object.entries(routeSchema.response)
            .forEach(([statusCode, schema]) => {
              routeSchema.response[statusCode] = updateSchema(schema.valueOf());
            });
        }
      }
    });
  }
}

export default fp(loadGlobalSchemasAsync, {
  name: moduleName
});
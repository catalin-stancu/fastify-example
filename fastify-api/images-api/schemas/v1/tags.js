import path from 'path';
import fp from 'fastify-plugin';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin contains all the basic schemas needed for notifications
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
async function addTagsSchemasAsync(fastify) {
  const { utils: { S, capitalizeFirstLetter }, getSchema } = fastify;
  const resourceTag = `[${version}] ${capitalizeFirstLetter(moduleName)}`;

  const tagsPayloadSchema = S.object()
    .id(`#${moduleName}`)
    .description('Tag payload')
    .prop('name', getSchema('#global.identifierName').required());

  const responseDataSchema = S.mergeSchemas(
    S.object()
      .description('Tag response structure')
      .prop('uuid', getSchema('#global.uuid')),
    tagsPayloadSchema
  );

  const schemaCollection = {
    find: {
      description: 'Find all tags in the database',
      summary: 'List tags',
      tags: [resourceTag],
      query: S.object()
        .prop('limit', getSchema('#global.pageLimit'))
        .prop('offset', getSchema('#global.pageOffset'))
        .prop('total_count', getSchema('#global.totalCount'))
        .prop('where', getSchema('#global.filterFields'))
        .prop('order', getSchema('#global.orderFields')),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', S.array().items(responseDataSchema))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    findById: {
      description: 'Find tag with the specified UUID',
      summary: 'Display one tag',
      tags: [resourceTag],
      params: S.object()
        .prop('uuid', getSchema('#global.uuid')
          .description('The uuid of the tag')
          .required()),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('data', responseDataSchema)
        ),
        400: getSchema('#global.response.400'),
        404: getSchema('#global.response.404'),
        500: getSchema('#global.response.500')
      }
    },
    create: {
      description: 'Create a new tag to be associated with a file or folder',
      summary: 'Create tag',
      tags: [resourceTag],
      body: S.mergeSchemas(
        tagsPayloadSchema,
        S.object().description('The tag name to persist in the database')
      ),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('data', responseDataSchema)
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    bulkDelete: {
      description: 'Delete a list of tags, if a filtering'
        + 'condition is not specified nothing is deleted',
      summary: 'Delete tags',
      tags: [resourceTag],
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('meta', getSchema('#global.responseMeta'))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    deleteById: {
      description: 'Delete tag with the specified UUID',
      summary: 'Delete tag',
      tags: [resourceTag],
      params: S.object()
        .prop('uuid', getSchema('#global.uuid')
          .description('The uuid of the tag')
          .required()),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('meta', getSchema('#global.responseMeta'))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    }
  };

  if (!fastify.schemaCollections[version]) {
    fastify.schemaCollections[version] = {};
  }

  fastify.schemaCollections[version][moduleName] = schemaCollection;
}

export default fp(addTagsSchemasAsync);
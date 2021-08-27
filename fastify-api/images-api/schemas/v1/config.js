import path from 'path';
import fp from 'fastify-plugin';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin contains all the basic schemas needed for config
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
async function addConfigSchemasAsync(fastify) {
  const { utils: { S, capitalizeFirstLetter }, getSchema } = fastify;
  const resourceTag = `[${version}] ${capitalizeFirstLetter(moduleName)}`;

  const configPayloadSchema = S.object()
    .id(`#${moduleName}`)
    .description('Config payload')
    .prop('id', getSchema('#global.identifierName')
      .description('Unique ID for an asset destination module')
      .examples(['dam', 'pim', 'cms']))
    .required()
    .prop('min_rez_vertical', S.number()
      .description('Minimum vertical image resolution')
      .examples([768])
      .minimum(1)
      .multipleOf(1)
      .required())
    .prop('min_rez_horizontal', S.number()
      .description('Minimum horizontal image resolution')
      .examples([1024])
      .minimum(1)
      .multipleOf(1)
      .required())
    .prop('max_rez_vertical', S.number()
      .description('Maximum vertical image resolution')
      .examples([4000])
      .minimum(1)
      .multipleOf(1)
      .required())
    .prop('max_rez_horizontal', S.number()
      .description('Maximum horizontal image resolution')
      .examples([1024])
      .minimum(1)
      .multipleOf(1)
      .required())
    .prop('variant_resolutions', S.object()
      .description('Resolution types by viewports')
      .raw({ nullable: true })
      .minProperties(1)
      .maxProperties(20)
      .additionalProperties(S.object()
        .description('Viewport variants')
        .minProperties(1)
        .maxProperties(10)
        .additionalProperties(S.object()
          .description('Viewport resolution variant')
          .prop('width', S.number()
            .examples([1024])
            .required()
            .minimum(1)
            .multipleOf(1))
          .prop('height', S.number()
            .examples([768])
            .required()
            .minimum(1)
            .multipleOf(1)))))
    .prop('global_background', S.object()
      .description('Global background color RGBA')
      .examples([{ r: 0, g: 0, b: 0, alpha: 1 }])
      .raw({ nullable: true })
      .prop('r', S.number()
        .description('Amount of Red color channel intensity')
        .required()
        .multipleOf(1)
        .minimum(0)
        .maximum(255))
      .prop('g', S.number()
        .description('Amount of Green color channel intensity')
        .required()
        .multipleOf(1)
        .minimum(0)
        .maximum(255))
      .prop('b', S.number()
        .description('Amount of Blue color channel intensity')
        .required()
        .multipleOf(1)
        .minimum(0)
        .maximum(255))
      .prop('alpha', S.number()
        .description('Amount of transparency')
        .examples([0, 1, 0.3])
        .required()
        .minimum(0)
        .maximum(1)))
    .prop('resource_types', S.array()
      .description('Type of resource allowed')
      .examples([['banner', 'page', 'block'], ['product']])
      .required()
      .raw({ nullable: true })
      .items(S.string()));

  const responseDataSchema = S.mergeSchemas(
    S.object()
      .description('Config response structure')
      .prop('created_by', S.object()
        .prop('name', S.string()
          .maxLength(100)
          .description('Who created this entity')
          .examples(['John Doe']))
        .prop('uuid', S.ref('#global.uuid')))
      .prop('modified_by', S.object()
        .prop('name', S.string()
          .maxLength(100)
          .description('Who last modified this entity')
          .examples(['John Doe']))
        .prop('uuid', S.ref('#global.uuid')))
      .prop('max_file_bytes', S.number()
        .description('Maximum size per file in bytes')
        .examples([1789099]))
      .prop('max_files', S.number()
        .description('Maximum files allowed for upload')
        .examples([20]))
      .prop('supported_image_types', S.array()
        .description('Supported image types for upload')
        .items(S.string())
        .examples(['jpeg', 'png'])),
    configPayloadSchema
  );

  const schemaCollection = {
    find: {
      description: 'Find all config rows in the database',
      summary: 'List config rows',
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
      description: 'Find config row with the specified ID',
      summary: 'Display one config row',
      tags: [resourceTag],
      params: S.object()
        .prop('id', getSchema('#global.identifierName')
          .description('The id of the config row')
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
      description: 'Create a new config row',
      summary: 'Create config row',
      tags: [resourceTag],
      body: S.mergeSchemas(
        configPayloadSchema,
        S.object().description('The config row id name to persist in the database')
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
    updateById: {
      description: 'Update a config row',
      summary: 'Update config row',
      tags: [resourceTag],
      params: S.object()
        .prop('id', getSchema('#global.identifierName')
          .description('The id of the config row')
          .required()),
      body: S.exclude(
        S.mergeSchemas(
          configPayloadSchema,
          S.object().description('The config row id name to update in the database')
        ), ['id']
      ),
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
    deleteById: {
      description: 'Delete config row with the specified id',
      summary: 'Delete config row',
      tags: [resourceTag],
      params: S.object()
        .prop('id', getSchema('#global.identifierName')
          .description('The id of the config row')
          .required()),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('meta', getSchema('#global.responseMeta'))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    bulkDelete: {
      description: 'Delete a list of config rows, if a filtering'
        + 'condition is not specified nothing is deleted',
      summary: 'Delete config rows',
      tags: [resourceTag],
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

export default fp(addConfigSchemasAsync);
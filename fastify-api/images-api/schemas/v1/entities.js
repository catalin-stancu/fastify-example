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
async function addEntitiesSchemasAsync(fastify) {
  const { utils, getSchema, instantiatedServices } = fastify;
  const { S, capitalizeFirstLetter } = utils;
  const { configUtils } = instantiatedServices;
  const { resourceTypes } = await configUtils.getUsageAndResourceTypes();

  const resourceTag = `[${version}] ${capitalizeFirstLetter(moduleName)}`;

  const entitiesPayloadSchema = S.object()
    .id(`#${moduleName}`)
    .description('The entity metadata to persist in the database')
    .prop('name', getSchema('#global.identifierName').required())
    .prop('tags', S.array().items(
      getSchema('#global.identifierName')
    ))
    .prop('parent', getSchema('#global.uuid')
      .description('Parent folder to store the created entity into')
      .raw({ nullable: true }));

  const responseDataSchema = S.mergeSchemas(
    S.object()
      .description('Entity structure')
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
      .prop('name', S.string())
      .prop('local_path', S.string()
        .description('Path in DAM module'))
      .prop('storage_path', S.string()
        .description('Path in cloud storage')
        .raw({ nullable: true }))
      .prop('type', S.string()
        .description('Type of entity')
        .examples(['file', 'folder']))
      .prop('content_type', S.string()
        .examples(['image/jpeg', 'image/png', null])
        .raw({ nullable: true }))
      .prop('usage', S.string()
        .raw({ nullable: true })
        .description('Location where the file will be used'))
      .prop('resource_id', S.string()
        .raw({ nullable: true })
        .description('ID of the resource where the file will be used'))
      .prop('resource_name', S.string()
        .raw({ nullable: true })
        .description('Name of the resource where the file will be used'))
      .prop('resource_type', S.string()
        .description('Type of the resource where the file will be used')
        .raw({ nullable: true })
        .examples(resourceTypes))
      .prop('stack_status', S.string()
        .description('Stack generation status')
        .raw({ nullable: true })
        .examples([
          'pending',
          'finished',
          'empty',
          'error: <step which failed>'
        ]))
      .prop('priority', S.number()
        .description('Sort priority, the higher the number => '
          + ' the higher rank in search results')
        .multipleOf(1)
        .minimum(0)
        .maximum(1000))
      .prop('status', S.string().enum(['active', 'disabled']))
      .prop('bytes', S.number())
      .prop('width', S.number().raw({ nullable: true }))
      .prop('height', S.number().raw({ nullable: true }))
      .prop('breadcrumbs', S.array().required().items(S.object()
        .description('Ordered list of ancestors from root to self\'s parent')
        .prop('uuid', getSchema('#global.uuid'))
        .prop('name', S.string())
        .prop('parent', getSchema('#global.uuid').raw({ nullable: true }))))
      .prop('uuid', getSchema('#global.uuid'))
      .prop('crop_offset_x', S.number()
        .description('Optional horizontal crop offset, in pixels relative to top left corner'))
      .prop('crop_offset_y', S.number()
        .description('Optional vertical crop offset, in pixels relative to top left corner'))
      .prop('crop_width', S.number()
        .description('Image width after crop, in pixels'))
      .prop('crop_height', S.number()
        .description('Image height after crop, in pixels'))
      .prop('image_version', S.number()
        .description('Image version, starts at 1, incremented at each change (crop or replace)'))
      .prop('preview_path', S.string()
        .raw({ nullable: true })
        .description('Path in cloud storage for viewport image preview (thumbnail)'))
      .prop('root_uuid', getSchema('#global.uuid').raw({ nullable: true }))
      .prop('stack_time_ms', S.number()
        .multipleOf(1)
        .minimum(1)
        .maximum(32760))
      .prop('created_at', S.string()
        .format('date-time')
        .description('The date when the entity was created')
        .examples(['2020-04-09T11:18:15.445Z']))
      .prop('modified_at', S.string()
        .format('date-time')
        .description('The date when the entity was modified')
        .examples(['2020-06-09T11:18:15.445Z'])),
    entitiesPayloadSchema
  );

  // We don't compute breadcrumbs for lists of entities, since it implies several
  // DB requests for each element in the list, so we exclude it in list responses
  const responseDataSchemaNoBreadcrumbs = S.exclude(responseDataSchema, ['breadcrumbs']);

  const schemaCollection = {
    find: {
      description: 'Find all files and folders in the database',
      summary: 'List entities',
      tags: [resourceTag],
      query: S.object()
        .prop('limit', getSchema('#global.pageLimit'))
        .prop('offset', getSchema('#global.pageOffset'))
        .prop('total_count', getSchema('#global.totalCount'))
        .prop('where', getSchema('#global.filterFields'))
        .prop('order', getSchema('#global.orderFields'))
        .prop('search_tags_instead', S.boolean())
        .description('Search entities by tags instead of standard fields')
        .examples([true, false]),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', S.array().items(responseDataSchemaNoBreadcrumbs))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    findById: {
      description: 'Find file or folder with the specified UUID',
      summary: 'Display one entity',
      tags: [resourceTag],
      params: S.object()
        .prop('uuid', getSchema('#global.uuid')
          .description('The uuid of the file or folder')
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
      description: 'Create a new folder in the directory structure',
      summary: 'Create folder',
      tags: [resourceTag],
      body: S.mergeSchemas(
        entitiesPayloadSchema,
        S.object().description('The folder metadata to persist in the database')
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
      description: 'Delete a list of instance, if a filtering'
        + 'condition is not specified nothing is deleted',
      summary: 'Delete folders or files',
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
      description: 'Delete instance with the specified UUID',
      summary: 'Delete folder or file',
      tags: [resourceTag],
      params: S.object()
        .prop('uuid', getSchema('#global.uuid')
          .description('The uuid of the instance')
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

export default fp(addEntitiesSchemasAsync);
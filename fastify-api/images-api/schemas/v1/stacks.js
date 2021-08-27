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
  const {
    usageModules,
    enabledUsageModules,
    resourceTypes
  } = await configUtils.getUsageAndResourceTypes();

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

  const urlsSchema = S.object()
    .description('General schema for urls')
    .additionalProperties(S.object()
      .description('Viewport variants')
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
          .multipleOf(1))
        .prop('url', S.string())));

  const schemaCollection = {
    find: {
      description: 'Find all urls for given stacks',
      summary: 'List urls for stacks',
      tags: [resourceTag],
      body: S.object()
        .description('Schema for input payload, a list of UUIDs provided directly in '
          + 'the querystring is not used because it can grow to be too large.')
        .additionalProperties(false)
        .prop('uuids', S.array()
          .description('Array of entity UUIDs of type stack')
          .items(getSchema('#global.uuid'))
          .minItems(1)
          .required()),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', S.array().items(S.object()
              .prop('uuid', getSchema('#global.uuid'))
              .prop('urls', urlsSchema)))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    findById: {
      description: 'Find all data and variants for a given stack, specified with its root UUID',
      summary: 'Display stack and its root variants',
      tags: [resourceTag],
      params: S.object()
        .prop('uuid', getSchema('#global.uuid')
          .description('The uuid of the root entity')
          .required()),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object()
            .prop('data', S.object()
              .prop('rootEntity', responseDataSchemaNoBreadcrumbs)
              .prop('urls', urlsSchema))
        ),
        400: getSchema('#global.response.400'),
        404: getSchema('#global.response.404'),
        500: getSchema('#global.response.500')
      }
    },
    bulkDelete: {
      description: 'Delete a list of stacks, if a filtering'
        + 'condition is not specified nothing is deleted',
      summary: 'Delete stacks',
      tags: [resourceTag],
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('meta', S.mergeSchemas(
            getSchema('#global.responseMeta'),
            S.object().prop('entity_count', S.number())
          ))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    deleteById: {
      description: 'Delete stack with root having the specified UUID',
      summary: 'Delete stack',
      tags: [resourceTag],
      params: S.object()
        .prop('uuid', getSchema('#global.uuid')
          .description('The uuid of the instance')
          .required()),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('meta', S.mergeSchemas(
            getSchema('#global.responseMeta'),
            S.object().prop('entity_count', S.number())
          ))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    bulkUpload: {
      description: 'Upload one or more files to cloud storage and generate stack',
      summary: 'Upload files and generate stack',
      tags: [resourceTag],
      query: S.object()
        .prop('parent', getSchema('#global.uuid')
          .description('Parent folder to store the uploaded files into. For root '
            + 'folder, you can specify the string "null", or just don\'t send it')
          .raw({ nullable: true }))
        .prop('usage', S.string()
          .description('Location where the files will be used')
          .enum(usageModules)
          .required())
        .prop('resource_id', S.removeId(getSchema('#global.identifierName')
          .description('ID of the resource where the file will be used')))
        .prop('resource_name', S.removeId(getSchema('#global.identifierName')
          .description('Name of the resource where the file will be used')))
        .prop('resource_type', S.string()
          .description('Type of resource where the file will be used')
          .enum(resourceTypes)),
      consumes: ['multipart/form-data'],
      body: S.object()
        .description('Schema for form data used in multipart file uploads')
        .prop('renames[]', S.array()
          .description('To pass an array use multiple params with this name. '
            + 'The renames are assigned in order to each uploaded file. '
            + 'To skip a rename, use an empty string. Any spaces are replaced with -')
          .items(S.anyOf([
            getSchema('#global.identifierName'),
            S.string().const('')
          ]))
          .required())
        .prop('tags[]', S.array()
          .required()
          .description('To pass an array use multiple params with this name. '
            + 'The tags are assigned in order to each uploaded file. To assign '
            + 'multiple tags to a file, concatenate them in a single string and '
            + 'separate each one with comma. To assign no tags use an empty string.')
          .items(S.array()
            .items(S.anyOf([
              getSchema('#global.identifierName'),
              S.string().const('')
            ]))))
        .prop('files[]', S.array()
          .description('To upload multiple files use multiple params with this name. '
            + 'The file name must not contain special characters since they appear in URLs '
            + 'and may be downloaded to a filesystem. Any spaces are replaced with a dash -.')
          .items(S.object()
            // The 'multipart file stream' value is assigned automatically for file
            // uploads, thus this checks that 'files[]' has file multipart streams
            // We use enum instead of const because AJV provides a much better error message
            .prop('content', S.string()
              .description('Multipart form data file content stream')
              .enum(['multipart file stream']))
            .prop('name', getSchema('#global.identifierName')))
          .required()),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', S.array().items(responseDataSchemaNoBreadcrumbs))
        ),
        207: S.mergeSchemas(
          getSchema('#global.response.207'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', S.array().items(responseDataSchemaNoBreadcrumbs))
        ),
        400: S.mergeSchemas(
          getSchema('#global.response.400'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
        ),
        500: getSchema('#global.response.500')
      }
    },
    uploadOverride: {
      description: 'Upload or crop an override file for a stack',
      summary: 'Upload or crop stack viewport',
      tags: [resourceTag],
      params: S.object()
        .prop('uuid', getSchema('#global.uuid')
          .description('UUID of the stack to be modified')
          .required()),
      query: S.object()
        .prop('viewport', S.string()
          .description('Stack viewport to override')
          .required())
        .prop('revert', S.boolean()
          .description('If true, the viewport override is reverted back to the original image')
          .default(false))
        .prop('crop_offset_x', S.number()
          .minimum(0)
          .multipleOf(1)
          .default(0)
          .description('Optional horizontal crop offset, in pixels relative to top left corner'))
        .prop('crop_offset_y', S.number()
          .minimum(0)
          .multipleOf(1)
          .default(0)
          .description('Optional vertical crop offset, in pixels relative to top left corner'))
        .prop('crop_width', S.number()
          .minimum(0)
          .multipleOf(1)
          .default(0)
          .description('Image width after crop, in pixels'))
        .prop('crop_height', S.number()
          .minimum(0)
          .multipleOf(1)
          .default(0)
          .description('Image height after crop, in pixels')),
      consumes: ['multipart/form-data'],
      body: S.object()
        .description('Schema for form data used in multipart file upload')
        .prop('file', S.object()
          .description('Optional file used to replace a stack viewport. '
            + 'The file name must not contain special characters since they appear in URLs '
            + 'and may be downloaded to a filesystem. Any spaces are replaced with a dash -.')
          // The 'multipart file stream' value is assigned automatically for file
          // uploads, thus this checks that 'file[]' has a file multipart stream
          // We use enum instead of const because AJV provides a much better error message
          .prop('content', S.string()
            .description('Multipart form data file content stream')
            .enum(['multipart file stream']))
          .prop('name', getSchema('#global.identifierName'))),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', responseDataSchemaNoBreadcrumbs)
        ),
        207: S.mergeSchemas(
          getSchema('#global.response.207'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', responseDataSchemaNoBreadcrumbs)
        ),
        400: S.mergeSchemas(
          getSchema('#global.response.400'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
        ),
        404: getSchema('#global.response.404'),
        500: getSchema('#global.response.500')
      }
    },
    generateStack: {
      description: 'Generate asset variation when asset is used outside DAM',
      summary: 'Generate asset variation',
      tags: [resourceTag],
      body: S.object()
        .description('Schema for body used in asset generation')
        .additionalProperties(false)
        .prop('uuids', S.array()
          .description('Array of entity UUIDs of type stack:empty')
          .items(getSchema('#global.uuid'))
          .minItems(1)
          .required())
        .prop('usage', S.string()
          .description('Where the image will be used')
          .enum(enabledUsageModules)
          .required())
        .prop('resource_type', S.string()
          .description('Type of resource where the file will be used')
          .enum(resourceTypes))
        // These resource info are optional because the FE may not know them when uploading images
        // to be attached to a resource. They are available e.g. only after a product is saved i.e.
        // published. Until then everything is just a draft on the UI that can be discarded.
        .prop('resource_id', S.removeId(getSchema('#global.identifierName')
          .description('ID of the resource where the file will be used')))
        .prop('resource_name', S.removeId(getSchema('#global.identifierName')
          .description('Name of the resource where the file will be used'))),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', S.array().items(responseDataSchemaNoBreadcrumbs))
        ),
        207: S.mergeSchemas(
          getSchema('#global.response.207'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', S.array().items(responseDataSchemaNoBreadcrumbs))
        ),
        400: S.mergeSchemas(
          getSchema('#global.response.400'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
        ),
        404: getSchema('#global.response.404'),
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
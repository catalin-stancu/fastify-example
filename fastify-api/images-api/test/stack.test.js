/* eslint-disable no-console */
/* eslint-disable no-loop-func */
/* eslint-disable max-len */
import fs from 'fs';
import path from 'path';
import serializeToQuerystring from 'fastify-global-plugins/test/helpers/query.js';
import fastify from 'fastify';
import fastifyExplorer from 'fastify-explorer';
import fastifyDeprecations from 'fastify/lib/warnings.js';
import {
  baseServerConfig,
  baseSetupConfig
} from 'fastify-global-plugins/baseConfig.js';
import appSetup from '../setup.js';
import testHelper from './helpers/index.js';

// Disable useless buggy deprecation warnings caused by fastify.inject() calls
fastifyDeprecations.emitted.set('FSTDEP001', true);
fastifyDeprecations.emitted.set('FSTDEP002', true);

const {
  EXPECT,
  frisby,
  BASE_URL,
  pollAsync,
  deleteTestEntities,
  getConfig,
  generateConfigSampleData,
  deleteConfigs,
  createStackEntity,
  createFolder,
  expectErrorWithCode,
  createAssetVariation,
  compareImages,
  deleteStacks,
  waitAsync,
  makeRangeIterator,
  average,
  stdDev,
  stackGenerationFinishedCondition
} = testHelper;

const { Joi } = frisby;

const INSTANCE_SCHEMA_DATA = {
  uuid: Joi.string().guid({ version: ['uuidv4'] }).required(),
  name: Joi.string().required(),
  created_by: Joi.object({
    name: Joi.string().required(),
    uuid: Joi.string().guid({ version: ['uuidv4'] }).required()
  }),
  modified_by: Joi.object({
    name: Joi.string().required(),
    uuid: Joi.string().guid({ version: ['uuidv4'] }).required()
  }),
  parent: Joi.string().guid({ version: ['uuidv4'] }).allow(null).required(),
  bytes: Joi.number().integer().positive().allow(0)
    .required(),
  status: Joi.string().valid('active', 'disabled').required(),
  local_path: Joi.string().allow('').required(),
  storage_path: Joi.string().allow(null).required(),
  type: Joi.string().required(),
  content_type: Joi.string().allow(null),
  priority: Joi.number().integer().positive().allow(0),
  root_uuid: Joi.string().allow(null).required(),
  usage: Joi.string().required(),
  resource_type: Joi.string().allow(null).required(),
  resource_name: Joi.string().allow(null).required(),
  resource_id: Joi.string().allow(null).required(),
  width: Joi.number().min(0).allow(null).required(),
  height: Joi.number().min(0).allow(null).required(),
  stack_status: Joi.string().allow(null).required(),
  crop_offset_x: Joi.number().min(0).required(),
  crop_offset_y: Joi.number().min(0).required(),
  crop_width: Joi.number().min(0).required(),
  crop_height: Joi.number().min(0).required(),
  image_version: Joi.number().min(0).required(),
  preview_path: Joi.string().allow(null).required(),
  created_at: Joi.date(),
  modified_at: Joi.date()
};

const INSTANCE_SCHEMA_DATA_SINGLE = {
  data: INSTANCE_SCHEMA_DATA
};

const INSTANCE_ERROR_MESSAGE = {
  content: Joi.string()
};

const INSTANCE_SCHEMA_ERROR_DATA = {
  statusCode: Joi.number().valid(200, 400, 404, 401),
  name: Joi.string(),
  code: Joi.string().regex(new RegExp('^\\d{3}.\\d*.\\d*$')),
  type: Joi.number().valid(0, 1, 2),
  details: Joi.array().items(INSTANCE_ERROR_MESSAGE),
  status: Joi.number().valid(200, 400, 404, 401),
  stack: Joi.string()
};

const INSTANCE_SCHEMA_ERROR = {
  meta: Joi.object().allow({}),
  messages: Joi.array().items(INSTANCE_SCHEMA_ERROR_DATA),
  data: Joi.object().allow({}, null)
};
const INSTANCE_SCHEMA_LIST_METADATA = {
  total_items: Joi.number().integer().positive().allow(0),
  end: Joi.boolean(),
  count: Joi.number().integer().positive().allow(0)
};
const INSTANCE_SCHEMA_LIST = {
  meta: INSTANCE_SCHEMA_LIST_METADATA,
  messages: Joi.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: Joi.array().items(INSTANCE_SCHEMA_DATA).allow([])
};

/**
  * Get variants from a root uuid. the main feature
  *
  * @param {*} rootUuid uuid of the root entity
  * @return {*}
  */
describe('Stack generation tests', () => {
  let variantResolutions;
  let globalUsage;
  let resourceType;
  let rootEntity;
  let folderEntity;
  let nrOfEntitiesToGenerate = 0;
  let nrOfViewportsToGenerate = 0;
  let nrOfVariantsToGenerate = 0;
  const resourceId = '891dd299-9543-42f9-b726-629b9cf2f8f4';
  const resourceName = 'SJX-123';

  before(async () => {
    [variantResolutions, globalUsage, resourceType] = await getConfig();

    if (!globalUsage) {
      throw Error('No usage found in config that has non-empty '
       + 'variant_resolutions and resource_types');
    }

    // Count the number of viewports and variants that should be generated
    Object.keys(variantResolutions).forEach(viewportName => {
      const viewport = variantResolutions[viewportName];
      if (viewport) {
        const nrOfVariantsPerViewport = Object.keys(viewport).length;
        nrOfViewportsToGenerate += 1;
        nrOfVariantsToGenerate += nrOfVariantsPerViewport;
        // The 1 below represents the viewport itself
        nrOfEntitiesToGenerate += nrOfVariantsPerViewport + 1;
      }
    });
  });

  describe('POST /entities/upload', () => {
    const maxTimeoutMs = 10000;
    describe('Generate stack on upload - Valid requests', () => {
      /**
       * Generate the stack for an uploaded file.
       * Called once per DESCRIBE block to avoid stack generation for every unit test (IT block),
       * because it takes a lot of time
      */
      before(async function generateStack() {
        const pollIntervalMs = 500;

        this.timeout(maxTimeoutMs);

        folderEntity = await createFolder();

        const [rootStack] = await createStackEntity(folderEntity.uuid,
          globalUsage, { resourceType, resourceId, resourceName });

        rootEntity = await pollAsync(async () => {
          const response = await frisby.get(`${BASE_URL}/entities/${rootStack.uuid}`);

          return response.json.data;
        }, stackGenerationFinishedCondition, pollIntervalMs);
      });

      after(async () => {
        await Promise.all([
          deleteStacks([rootEntity.uuid]),
          deleteTestEntities([folderEntity.uuid])
        ]);
      });

      it('Should have all viewport folders and resizes generated', async () => {
        const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
          root_uuid: {
            $eq: rootEntity.uuid
          }
        })}&limit=500&offset=0`)
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
        const { meta, data } = response.json;

        EXPECT(response.json.messages, 'error list').to.be.undefined;
        EXPECT(meta.count, 'find count').to.equal(nrOfEntitiesToGenerate);
        EXPECT(data).to.not.be.undefined;
        EXPECT(rootEntity.type).to.equal('stack');
        EXPECT(rootEntity.stack_status).to.equal('finished');
      });

      it('Should have all viewport folders generated', async () => {
        const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
          $and: [
            {
              root_uuid: {
                $eq: rootEntity.uuid
              }
            },
            {
              type: {
                $like: 'folder:'
              }
            }
          ]
        })}&limit=500&offset=0`)
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
        const { meta, data } = response.json;

        EXPECT(response.json.messages, 'error list').to.be.undefined;
        EXPECT(meta.count, 'find count').to.equal(nrOfViewportsToGenerate);
        EXPECT(data).to.not.be.undefined;
        EXPECT(rootEntity.type).to.equal('stack');
        EXPECT(rootEntity.stack_status).to.equal('finished');
      });

      it('Should have all variants generated', async () => {
        const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
          $and: [
            {
              root_uuid: {
                $eq: rootEntity.uuid
              }
            },
            {
              type: {
                $like: 'file:image:'
              }
            }
          ]
        })}&limit=500&offset=0`)
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
        const { meta, data } = response.json;

        EXPECT(response.json.messages, 'error list').to.be.undefined;
        EXPECT(meta.count, 'find count').to.equal(nrOfVariantsToGenerate);
        EXPECT(data).to.not.be.undefined;
        EXPECT(rootEntity.type).to.equal('stack');
        EXPECT(rootEntity.stack_status).to.equal('finished');
      });
    });

    describe('Generate stack on upload - Invalid requests', () => {
      it('Should return "400 Bad Request" error response, missing [usage]', async () => {
        const form = frisby.formData();
        form.append('renames[]', '');
        form.append('tags[]', '');
        const response = await frisby.post(`${BASE_URL}/entities/upload`, {
          headers: { 'Content-Type': form.getHeaders()['content-type'] },
          body: form
        })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 528, 107);
      });

      it('Should return "400 Bad Request" error response, invalid [usage]', async () => {
        const form = frisby.formData();
        form.append('renames[]', '');
        form.append('tags[]', '');
        const response = await frisby.post(`${BASE_URL}/entities/upload?usage=something_invalid`, {
          headers: { 'Content-Type': form.getHeaders()['content-type'] },
          body: form
        })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 528, 107);
      });

      it('Should return "400 Bad Request" error response, valid [usage], invalid [resource_type] for that usage', async () => {
        const form = frisby.formData();
        form.append('renames[]', '');
        form.append('tags[]', '');
        const response = await frisby.post(
          `${BASE_URL}/entities/upload?usage=${globalUsage}&resource_type=something_invalid`,
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 872, 107);
      });

      it('Should return "400 Bad Request" error response, valid [usage], missing [resource_type]', async () => {
        const form = frisby.formData();
        form.append('renames[]', '');
        form.append('tags[]', '');
        const response = await frisby.post(`${BASE_URL}/entities/upload?usage=${globalUsage}`, {
          headers: { 'Content-Type': form.getHeaders()['content-type'] },
          body: form
        })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 752, 107);
      });

      it('Should return 400 Bad Request error response, image size too big', async function unitTest() {
        const form = frisby.formData();
        this.timeout(maxTimeoutMs);

        form.append('files[]', fs.createReadStream(path.resolve('./test/samples/big-image-1.png')));
        form.append('renames[]', '');
        form.append('tags[]', 'tag1');
        const response = await frisby.post(
          `${BASE_URL}/entities/upload?usage=${globalUsage}&resource_type=${resourceType}`,
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 528, 108);
      });

      it('Should return 400 Bad Request error response, image type not supported', async () => {
        const form = frisby.formData();
        form.append('files[]', fs.createReadStream(path.resolve('./test/samples/good-gif.gif')));
        form.append('renames[]', '');
        form.append('tags[]', 'tag1');
        const response = await frisby.post(
          `${BASE_URL}/entities/upload?usage=${globalUsage}&resource_type=${resourceType}`,
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 456, 108);
      });
    });

    describe('Generate stack on upload - Using new config', () => {
      it('Should upload file when using a new config', async function unitTest() {
        this.timeout(maxTimeoutMs);
        const pollIntervalMs = 500;

        const configData = generateConfigSampleData({
          resource_types: [resourceType],
          min_rez_vertical: 1,
          min_rez_horizontal: 1,
          max_rez_vertical: 1500,
          max_rez_horizontal: 1500
        });

        await frisby.post(`${BASE_URL}/config`, configData, { json: true })
          .expect('status', 200);

        folderEntity = await createFolder();

        const [rootStack] = await createStackEntity(folderEntity.uuid,
          configData.id, { resourceType, resourceId, resourceName });

        rootEntity = await pollAsync(async () => {
          const response = await frisby.get(`${BASE_URL}/entities/${rootStack.uuid}`);

          return response.json.data;
        }, stackGenerationFinishedCondition, pollIntervalMs);

        EXPECT(rootEntity.usage).to.be.equal(configData.id);
        EXPECT(rootEntity.resource_type).to.be.equal(resourceType);
        EXPECT(configData.resource_types).to.include(rootEntity.resource_type);

        await Promise.all([
          deleteStacks([rootEntity.uuid]),
          deleteTestEntities([folderEntity.uuid])
        ]);

        await deleteConfigs(configData.id);
      });
    });
  });

  describe('POST /entities/stack', () => {
    const maxTimeoutMs = 10000;

    describe('Generate asset variation when asset is used - Valid request', () => {
      let rootStack;

      before(async function beforeUnitTest() {
        this.timeout(maxTimeoutMs);
        folderEntity = await createFolder();

        const form = frisby.formData();
        form.append('files[]', fs.createReadStream(path.resolve('./test/samples/good-image-1.jpg')));
        form.append('renames[]', '');
        form.append('tags[]', '');

        // We can also specify the root folder as the null string for parent query param
        const response = await frisby.post(`${BASE_URL}/entities/upload?parent=${folderEntity.uuid}&usage=dam`, {
          headers: { 'Content-Type': form.getHeaders()['content-type'] },
          body: form
        })
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);

        [rootStack] = response.json.data;
        EXPECT(rootStack.stack_status).to.equal('empty');
        EXPECT(rootStack.type).to.equal('stack:empty');
        EXPECT(rootStack.resource_id).to.equal(null);
        EXPECT(rootStack.resource_name).to.equal(null);
        EXPECT(rootStack.resource_type).to.equal(null);
        EXPECT(rootStack.usage).to.equal('dam');

        await createAssetVariation(rootStack.uuid, globalUsage, resourceName, resourceType, resourceId);

        rootEntity = await pollAsync(async () => {
          const result = await frisby.get(`${BASE_URL}/entities/${rootStack.uuid}`);
          return result.json.data;
        }, stackGenerationFinishedCondition, 500);
      });

      after(async () => {
        await Promise.all([
          deleteStacks([rootEntity.uuid]),
          deleteTestEntities([folderEntity.uuid])
        ]);
      });

      it('Should generate all viewport folders and variants and set resource info on them', async () => {
        const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
          root_uuid: {
            $eq: rootEntity.uuid
          }
        })}&limit=500&offset=0`)
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
        const { meta, data } = response.json;

        EXPECT(response.json.messages, 'error list').to.be.undefined;
        EXPECT(meta.count, 'find count').to.equal(nrOfEntitiesToGenerate);
        EXPECT(data).to.not.be.undefined;
        EXPECT(rootEntity.type).to.equal('stack');
        EXPECT(rootEntity.stack_status).to.equal('finished');
        EXPECT(rootEntity.resource_id).to.equal(resourceId);
        EXPECT(rootEntity.resource_name).to.equal(resourceName);
        EXPECT(rootEntity.resource_type).to.equal(resourceType);
        EXPECT(rootEntity.usage).to.equal(globalUsage);
      });

      it('Should have all viewport folders generated', async () => {
        const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
          $and: [
            {
              root_uuid: {
                $eq: rootEntity.uuid
              }
            },
            {
              type: {
                $like: 'folder:'
              }
            }
          ]
        })}&limit=500&offset=0`)
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
        const { meta, data } = response.json;

        EXPECT(response.json.messages, 'error list').to.be.undefined;
        EXPECT(meta.count, 'find count').to.equal(nrOfViewportsToGenerate);
        EXPECT(data).to.not.be.undefined;
        EXPECT(rootEntity.type).to.equal('stack');
        EXPECT(rootEntity.stack_status).to.equal('finished');
        EXPECT(rootEntity.resource_id).to.equal(resourceId);
        EXPECT(rootEntity.resource_name).to.equal(resourceName);
        EXPECT(rootEntity.resource_type).to.equal(resourceType);
        EXPECT(rootEntity.usage).to.equal(globalUsage);
      });

      it('Should have all variants generated', async () => {
        const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
          $and: [
            {
              root_uuid: {
                $eq: rootEntity.uuid
              }
            },
            {
              type: {
                $like: 'file:image:'
              }
            }
          ]
        })}&limit=500&offset=0`)
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
        const { meta, data } = response.json;

        EXPECT(response.json.messages, 'error list').to.be.undefined;
        EXPECT(meta.count, 'find count').to.equal(nrOfVariantsToGenerate);
        EXPECT(data).to.not.be.undefined;
        EXPECT(rootEntity.type).to.equal('stack');
        EXPECT(rootEntity.stack_status).to.equal('finished');
        EXPECT(rootEntity.resource_id).to.equal(resourceId);
        EXPECT(rootEntity.resource_name).to.equal(resourceName);
        EXPECT(rootEntity.resource_type).to.equal(resourceType);
        EXPECT(rootEntity.usage).to.equal(globalUsage);
      });
    });

    describe('Generate asset variation when asset is used - Invalid request', () => {
      const nonExistingEntityUuid = '2d075fc3-fd6d-4033-b197-828a0a8635c0';
      const pollIntervalMs = 500;

      it('Should return 404 Not Found error response, valid [uuids], no record in database', async () => {
        const body = {
          uuids: [nonExistingEntityUuid],
          usage: globalUsage,
          resource_type: resourceType,
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 404)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 1, 105);
      });

      it('Should return 400 Bad Request error response, empty [uuids]', async () => {
        const body = {
          uuids: [],
          usage: globalUsage,
          resource_type: resourceType,
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 902, 4);
      });

      it('Should return 400 Bad Request error response, missing [usage]', async () => {
        const body = {
          uuids: [nonExistingEntityUuid],
          resource_type: resourceType,
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 902, 4);
      });

      it('Should return 400 Bad Request error response, invalid [usage]', async () => {
        const body = {
          uuids: [nonExistingEntityUuid],
          usage: 'invalid',
          resource_type: resourceType,
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 902, 4);
      });

      it('Should return 400 Bad Request error response, valid [usage], but value is DAM', async () => {
        const body = {
          uuids: [nonExistingEntityUuid],
          usage: 'dam',
          resource_type: resourceType,
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 902, 4);
      });

      it('Should return 400 Bad Request error response, invalid [resource_type]', async () => {
        const body = {
          uuids: [nonExistingEntityUuid],
          usage: globalUsage,
          resource_type: 'invalid',
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 902, 4);
      });

      it('Should return 400 Bad Request error response, invalid [resource_type] for that usage', async () => {
        const resizeOptions = {};
        const validUsages = [];

        const config = (await frisby.get(`${BASE_URL}/config`)).json.data;
        config.forEach(conf => {
          const { id, ...configWithoutId } = conf;
          resizeOptions[id] = configWithoutId;
        });

        for (const usage in resizeOptions) {
          if (resizeOptions[usage].variant_resolutions
        && Object.keys(resizeOptions[usage].variant_resolutions).length
        && resizeOptions[usage].resource_types.length) {
            validUsages.push({
              usage,
              resourceTypes: resizeOptions[usage].resource_types
            });
          }
        }

        const body = {
          uuids: [nonExistingEntityUuid],
          usage: validUsages[0].usage,
          resource_type: validUsages[1].resourceTypes[0],
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 872, 107);
      });

      it('Should return 400 Bad Request error response, missing [resource_type]', async () => {
        const body = {
          uuids: [nonExistingEntityUuid],
          usage: globalUsage,
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 752, 107);
      });

      it('Should return 400 Bad Request error response, invalid body', async () => {
        const body = {};

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 902, 4);
      });

      it('Should return 400 Bad Request error response, valid [body], but entity is not an empty stack', async function unitTest() {
        this.timeout(maxTimeoutMs);
        const folderEntityTest = await createFolder();

        const [rootStack] = await createStackEntity(folderEntityTest.uuid,
          globalUsage, { resourceType, resourceId, resourceName });

        rootEntity = await pollAsync(async () => {
          const response = await frisby.get(`${BASE_URL}/entities/${rootStack.uuid}`);

          return response.json.data;
        }, stackGenerationFinishedCondition, pollIntervalMs);

        const body = {
          uuids: [rootStack.uuid],
          usage: globalUsage,
          resource_type: resourceType,
          resource_id: resourceId,
          resource_name: resourceName
        };

        const response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 8, 105);
      });
    });

    describe('Generate stack on upload - Using new config', () => {
      let rootStack;

      it('Should upload file when using a new config', async function unitTest() {
        this.timeout(maxTimeoutMs);
        const pollIntervalMs = 500;

        const configData = generateConfigSampleData({
          resource_types: [resourceType],
          min_rez_vertical: 1,
          min_rez_horizontal: 1,
          max_rez_vertical: 1500,
          max_rez_horizontal: 1500
        });

        await frisby.post(`${BASE_URL}/config`, configData, { json: true })
          .expect('status', 200);

        this.timeout(maxTimeoutMs);

        folderEntity = await createFolder();

        const form = frisby.formData();
        form.append('files[]', fs.createReadStream(path.resolve('./test/samples/good-image-1.jpg')));
        form.append('renames[]', '');
        form.append('tags[]', '');

        // We can also specify the root folder as the null string for parent query param
        const response = await frisby.post(`${BASE_URL}/entities/upload?parent=${folderEntity.uuid}&usage=dam`, {
          headers: { 'Content-Type': form.getHeaders()['content-type'] },
          body: form
        })
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);

        [rootStack] = response.json.data;
        EXPECT(rootStack.stack_status).to.equal('empty');
        EXPECT(rootStack.type).to.equal('stack:empty');
        EXPECT(rootStack.resource_id).to.equal(null);
        EXPECT(rootStack.resource_name).to.equal(null);
        EXPECT(rootStack.resource_type).to.equal(null);
        EXPECT(rootStack.usage).to.equal('dam');

        await createAssetVariation(rootStack.uuid, configData.id, resourceName, resourceType, resourceId);

        rootEntity = await pollAsync(async () => {
          const result = await frisby.get(`${BASE_URL}/entities/${rootStack.uuid}`);
          return result.json.data;
        }, stackGenerationFinishedCondition, pollIntervalMs);

        EXPECT(rootEntity.usage).to.be.equal(configData.id);
        EXPECT(rootEntity.resource_type).to.be.equal(resourceType);
        EXPECT(configData.resource_types).to.include(rootEntity.resource_type);

        await Promise.all([
          deleteStacks([rootEntity.uuid]),
          deleteTestEntities([folderEntity.uuid])
        ]);

        await deleteConfigs(configData.id);
      });
    });
  });

  describe('PATCH /entities/:uuid/upload', () => {
    describe('Replace/Crop viewport image - Valid request', () => {
      let viewport;
      const maxTimeoutMs = 10000;
      const pollIntervalMs = 500;

      beforeEach(async function generateStack() {
        [viewport] = Object.keys(variantResolutions);
        globalUsage = 'cms';
        this.timeout(maxTimeoutMs);

        folderEntity = await createFolder();
        const [rootStack] = await createStackEntity(folderEntity.uuid,
          globalUsage, { resourceType, resourceId, resourceName });

        rootEntity = await pollAsync(async () => {
          const response = await frisby.get(`${BASE_URL}/entities/${rootStack.uuid}`);

          return response.json.data;
        }, stackGenerationFinishedCondition, pollIntervalMs);
      });

      afterEach(async () => {
        await Promise.all([
          deleteStacks([rootEntity.uuid]),
          deleteTestEntities([folderEntity.uuid])
        ]);
      });

      context('When replacing the original image with a new one', () => {
        it('Should replace the original image and increase image version', async function unitTest() {
          this.timeout(maxTimeoutMs);
          const form = frisby.formData();
          const pathToFile = path.resolve('./test/samples/good-image-2.jpg');
          form.append('file', fs.createReadStream(pathToFile));
          const originalName = rootEntity.name;

          await frisby.patch(
            `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`,
            {
              headers: { 'Content-Type': form.getHeaders()['content-type'] },
              body: form
            }
          )
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_DATA_SINGLE);
          rootEntity = await pollAsync(async () => {
            const response = await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}`);

            return response.json.data;
          }, stackGenerationFinishedCondition, pollIntervalMs);

          const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
            $and: [
              {
                root_uuid: {
                  $eq: rootEntity.uuid
                }
              },
              {
                type: {
                  $like: `:${viewport}`
                }
              }
            ]
          })}&limit=20&offset=0`)
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
          const { meta, data } = response.json;
          EXPECT(response.json.messages, 'error list').to.be.undefined;
          EXPECT(meta.count, 'find count').to.be.greaterThanOrEqual(2);
          EXPECT(data).to.not.be.undefined;
          EXPECT(rootEntity.type).to.equal('stack');
          EXPECT(rootEntity.stack_status).to.equal('finished');
          EXPECT(rootEntity.resource_id).to.equal(resourceId);
          EXPECT(rootEntity.resource_name).to.equal(resourceName);
          EXPECT(rootEntity.resource_type).to.equal(resourceType);
          EXPECT(rootEntity.usage).to.equal(globalUsage);

          let storagePathImg2;
          data.forEach(entity => {
            const [type] = entity.type.split(':');
            if (type === 'folder') {
              // storage path for viewports will contain the new image name
              EXPECT(entity.storage_path).to.contain('good-image-2.jpg');
              EXPECT(entity.preview_path).to.not.be.undefined;
              EXPECT(entity.preview_path).to.have.string(`${viewport}/preview/2`);
              EXPECT(entity.image_version).to.equal(2);
              storagePathImg2 = entity.storage_path;
            } else {
              const [fileVersion, oldImageName] = entity.storage_path.split('/').slice(-2);
              EXPECT(entity.preview_path).to.be.null;
              EXPECT(fileVersion).to.equal('2');
              // storage path for variants contain the old image name
              EXPECT(oldImageName).to.have.string(originalName);
            }
          });

          // Check if the replaced image content is the correct one
          const scoreReplaced = await compareImages(pathToFile, storagePathImg2);
          EXPECT(scoreReplaced).to.be.least(0.95);
          EXPECT(scoreReplaced).to.be.lessThanOrEqual(1);
        });
      });

      context('When replacing the original image and cropping the new one', () => {
        it('Should replace the original image, increase image version and add crop coordinates', async function unitTest() {
          this.timeout(maxTimeoutMs);
          const form = frisby.formData();
          const pathToFile = path.resolve('./test/samples/good-image-2.jpg');
          form.append('file', fs.createReadStream(pathToFile));
          const originalName = rootEntity.name;
          await frisby.patch(
            `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`
             + '&crop_width=200&crop_height=400&crop_offset_x=100&crop_offset_y=150',
            {
              headers: { 'Content-Type': form.getHeaders()['content-type'] },
              body: form
            }
          )
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_DATA_SINGLE);
          rootEntity = await pollAsync(async () => {
            const response = await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}`);

            return response.json.data;
          }, stackGenerationFinishedCondition, pollIntervalMs);

          const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
            $and: [
              {
                root_uuid: {
                  $eq: rootEntity.uuid
                }
              },
              {
                type: {
                  $like: `:${viewport}`
                }
              }
            ]
          })}&limit=20&offset=0`)
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
          const { meta, data } = response.json;
          EXPECT(response.json.messages, 'error list').to.be.undefined;
          EXPECT(meta.count, 'find count').to.be.greaterThanOrEqual(2);
          EXPECT(data).to.not.be.undefined;
          EXPECT(rootEntity.type).to.equal('stack');
          EXPECT(rootEntity.stack_status).to.equal('finished');
          EXPECT(rootEntity.resource_id).to.equal(resourceId);
          EXPECT(rootEntity.resource_name).to.equal(resourceName);
          EXPECT(rootEntity.resource_type).to.equal(resourceType);
          EXPECT(rootEntity.usage).to.equal(globalUsage);

          let storagePathImg2;
          data.forEach(entity => {
            const [type] = entity.type.split(':');
            if (type === 'folder') {
              // storage path for viewports will contain the new image name
              EXPECT(entity.storage_path).to.contain('good-image-2.jpg');
              EXPECT(entity.preview_path).to.not.be.undefined;
              EXPECT(entity.preview_path).to.have.string(`${viewport}/preview/2`);
              EXPECT(entity.image_version).to.equal(2);
              EXPECT(entity.crop_offset_x).to.equal(100);
              EXPECT(entity.crop_offset_y).to.equal(150);
              EXPECT(entity.crop_height).to.equal(400);
              EXPECT(entity.crop_width).to.equal(200);
              storagePathImg2 = entity.storage_path;
            } else {
              const [fileVersion, oldImageName] = entity.storage_path.split('/').slice(-2);
              EXPECT(entity.preview_path).to.be.null;
              EXPECT(fileVersion).to.equal('2');
              // storage path for variants contain the old image name
              EXPECT(oldImageName).to.have.string(originalName);
            }
          });

          // Check if the replaced image content is the correct one
          const scoreReplaced = await compareImages(pathToFile, storagePathImg2);
          EXPECT(scoreReplaced).to.be.least(0.95);
          EXPECT(scoreReplaced).to.be.lessThanOrEqual(1);
        });
      });

      context('When cropping the original image', () => {
        it('Should increase image version and add crop coordinates', async function unitTest() {
          this.timeout(maxTimeoutMs);
          const originalName = rootEntity.name;

          await frisby.patch(
            `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`
             + '&crop_width=100&crop_height=200&crop_offset_x=50&crop_offset_y=50',
            {
              body: {}
            }
          )
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_DATA_SINGLE);
          rootEntity = await pollAsync(async () => {
            const response = await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}`);

            return response.json.data;
          }, stackGenerationFinishedCondition, pollIntervalMs);

          const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
            $and: [
              {
                root_uuid: {
                  $eq: rootEntity.uuid
                }
              },
              {
                type: {
                  $like: `:${viewport}`
                }
              }
            ]
          })}&limit=20&offset=0`)
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
          const { meta, data } = response.json;
          EXPECT(response.json.messages, 'error list').to.be.undefined;
          EXPECT(meta.count, 'find count').to.be.greaterThanOrEqual(2);
          EXPECT(data).to.not.be.undefined;
          EXPECT(rootEntity.type).to.equal('stack');
          EXPECT(rootEntity.stack_status).to.equal('finished');
          EXPECT(rootEntity.resource_id).to.equal(resourceId);
          EXPECT(rootEntity.resource_name).to.equal(resourceName);
          EXPECT(rootEntity.resource_type).to.equal(resourceType);
          EXPECT(rootEntity.usage).to.equal(globalUsage);

          let storagePathImg2;
          data.forEach(entity => {
            const [type] = entity.type.split(':');
            if (type === 'folder') {
              // When just cropping, the image name doesn't change
              EXPECT(entity.storage_path).to.contain(originalName);
              EXPECT(entity.preview_path).to.not.be.undefined;
              EXPECT(entity.preview_path).to.have.string(`${viewport}/preview/2`);
              EXPECT(entity.image_version).to.equal(2);
              EXPECT(entity.crop_offset_x).to.equal(50);
              EXPECT(entity.crop_offset_y).to.equal(50);
              EXPECT(entity.crop_height).to.equal(200);
              EXPECT(entity.crop_width).to.equal(100);
              storagePathImg2 = entity.storage_path;
            } else {
              const [fileVersion, oldImageName] = entity.storage_path.split('/').slice(-2);
              EXPECT(entity.preview_path).to.be.null;
              EXPECT(fileVersion).to.equal('2');
              // storage path for variants contain the old image name
              EXPECT(oldImageName).to.have.string(originalName);
            }
          });

          // Check if the cropped image content is the correct one (the original image was not changed)
          const pathToFile = path.resolve('./test/samples/good-image-1.jpg');
          const scoreReplaced = await compareImages(pathToFile, storagePathImg2);
          EXPECT(scoreReplaced).to.be.least(0.95);
          EXPECT(scoreReplaced).to.be.lessThanOrEqual(1);
        });
      });
    });

    describe('Revert to original image - Valid request', () => {
      let viewport;
      const maxTimeoutMs = 10000;
      const pollIntervalMs = 500;
      // Replace the original image with a new image
      beforeEach(async function generateStack() {
        [viewport] = Object.keys(variantResolutions);
        globalUsage = 'cms';

        this.timeout(maxTimeoutMs);

        folderEntity = await createFolder();
        const [rootStack] = await createStackEntity(folderEntity.uuid,
          globalUsage, { resourceType, resourceId, resourceName });

        rootEntity = await pollAsync(async () => {
          const response = await frisby.get(`${BASE_URL}/entities/${rootStack.uuid}`);

          return response.json.data;
        }, stackGenerationFinishedCondition, pollIntervalMs);

        const form = frisby.formData();
        form.append('file', fs.createReadStream(path.resolve('./test/samples/good-image-2.jpg')));
        await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`
            + '&crop_width=300&crop_height=600&crop_offset_x=100&crop_offset_y=150',
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_DATA_SINGLE);
      });

      afterEach(async () => {
        await Promise.all([
          deleteStacks([rootEntity.uuid]),
          deleteTestEntities([folderEntity.uuid])
        ]);
      });

      context('When reverting to the original image', () => {
        it('Should increase image version and revert back to original image', async function unitTest() {
          this.timeout(maxTimeoutMs);
          const originalName = rootEntity.name;

          // Wait for viewport + variants regeneration
          rootEntity = await pollAsync(async () => {
            const response = await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}`);

            return response.json.data;
          }, stackGenerationFinishedCondition, pollIntervalMs);

          // Revert back to original
          await frisby.patch(
            `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}&revert=true`,
            {
              body: {}
            }
          )
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_DATA_SINGLE);
          rootEntity = await pollAsync(async () => {
            const response = await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}`);

            return response.json.data;
          }, stackGenerationFinishedCondition, pollIntervalMs);

          const response = await frisby.get(`${BASE_URL}/entities?${serializeToQuerystring({
            $and: [
              {
                root_uuid: {
                  $eq: rootEntity.uuid
                }
              },
              {
                type: {
                  $like: `:${viewport}`
                }
              }
            ]
          })}&limit=20&offset=0`)
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
          const { meta, data } = response.json;
          EXPECT(response.json.messages, 'error list').to.be.undefined;
          EXPECT(meta.count, 'find count').to.be.greaterThanOrEqual(2);
          EXPECT(data).to.not.be.undefined;
          EXPECT(rootEntity.type).to.equal('stack');
          EXPECT(rootEntity.stack_status).to.equal('finished');
          EXPECT(rootEntity.resource_id).to.equal(resourceId);
          EXPECT(rootEntity.resource_name).to.equal(resourceName);
          EXPECT(rootEntity.resource_type).to.equal(resourceType);
          EXPECT(rootEntity.usage).to.equal(globalUsage);

          let storagePathImg2;
          data.forEach(entity => {
            const [type] = entity.type.split(':');
            if (type === 'folder') {
              // When reverting, the image name will be the original one
              EXPECT(entity.storage_path).to.contain(originalName);
              EXPECT(entity.preview_path).to.not.be.undefined;
              EXPECT(entity.preview_path).to.have.string(`${viewport}/preview/3`);
              EXPECT(entity.image_version).to.equal(3);
              // Reverting to original will reset crop coordinates
              EXPECT(entity.crop_offset_x).to.equal(0);
              EXPECT(entity.crop_offset_y).to.equal(0);
              EXPECT(entity.crop_height).to.equal(0);
              EXPECT(entity.crop_width).to.equal(0);
              storagePathImg2 = entity.storage_path;
            } else {
              const [fileVersion, oldImageName] = entity.storage_path.split('/').slice(-2);
              EXPECT(entity.preview_path).to.be.null;
              EXPECT(fileVersion).to.equal('3');
              // storage path for variants contain the old image name
              EXPECT(oldImageName).to.have.string(originalName);
            }
          });

          // Check if reverted image content is ok (should be equal to the original image)
          const pathToFile = path.resolve('./test/samples/good-image-1.jpg');
          const scoreReplaced = await compareImages(pathToFile, storagePathImg2);
          EXPECT(scoreReplaced).to.be.least(0.95);
          EXPECT(scoreReplaced).to.be.lessThanOrEqual(1);
        });
      });
    });

    describe('Replace/Crop/Revert - Invalid requests', () => {
      let viewport;
      const maxTimeoutMs = 10000;
      const pollIntervalMs = 500;

      before(async function generateStack() {
        [viewport] = Object.keys(variantResolutions);
        globalUsage = 'cms';

        this.timeout(maxTimeoutMs);

        folderEntity = await createFolder();
        const [rootStack] = await createStackEntity(folderEntity.uuid,
          globalUsage, { resourceType, resourceId, resourceName });

        rootEntity = await pollAsync(async () => {
          const response = await frisby.get(`${BASE_URL}/entities/${rootStack.uuid}`);

          return response.json.data;
        }, stackGenerationFinishedCondition, pollIntervalMs);
      });

      after(async () => {
        await Promise.all([
          deleteStacks([rootEntity.uuid]),
          deleteTestEntities([folderEntity.uuid])
        ]);
      });

      it('Should return 400 Bad Request error response, image dimensions are wrong', async () => {
        const form = frisby.formData();
        form.append('file', fs.createReadStream(path.resolve('./test/samples/bad-dimensions-1.png')));
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`,
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 328, 105);
      });

      it('Should return 400 Bad Request error response, missing [file][crop][revert]', async () => {
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`,
          {
            body: {}
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 24, 106);
      });

      it('Should return 400 Bad Request error response, no query params sent', async () => {
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`,
          {
            body: {}
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 24, 106);
      });

      it('Should return 400 Bad Request error response, revert and crop at the same time', async () => {
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}&revert=true`
             + '&crop_width=300&crop_height=600&crop_offset_x=100&crop_offset_y=150',
          {
            body: {}
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 320, 109);
      });

      it('Should return 400 Bad Request error response, revert and replace at the same time', async () => {
        const form = frisby.formData();
        form.append('file', fs.createReadStream(path.resolve('./test/samples/good-image-1.jpg')));
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}&revert=true`,
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 752, 106);
      });

      it('Should return 400 Bad Request error response, missing [crop] width/height', async () => {
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`
             + '&crop_height=600&crop_offset_x=100&crop_offset_y=150',
          {
            body: {}
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 992, 109);
      });

      it('Should return 400 Bad Request error response, [crop] area exceeds source image bounds', async () => {
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`
             + '&crop_height=600&crop_width=600&crop_offset_x=10000&crop_offset_y=15000',
          {
            body: {}
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 472, 109);
      });

      it('Should return 400 Bad Request error response, [crop] coordinates are not valid integer numbers', async () => {
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`
             + '&crop_height=100.123&crop_width=100.1456&crop_offset_x=100.123&crop_offset_y=150.1054350',
          {
            body: {}
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 902, 4);
      });

      it('Should return 404 Not Found error response, entity does not exist', async () => {
        const response = await frisby.patch(
          `${BASE_URL}/entities/891dd299-9543-42f9-b726-629b9cf2f8f2/upload?viewport=${viewport}`,
          {
            body: {}
          }
        )
          .expect('status', 404)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 768, 109);
      });

      it('Should return 404 Not Found error response, [viewport] does not exist', async () => {
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=something_invalid`,
          {
            body: {}
          }
        )
          .expect('status', 404)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 352, 109);
      });

      it('Should return 404 Bad Request error response, [usage] is different than CMS', async () => {
        const form = frisby.formData();
        form.append('files[]', fs.createReadStream(path.resolve('./test/samples/good-image-1.jpg')));
        form.append('renames[]', '');
        form.append('tags[]', '');

        const folderEntityDAM = await createFolder();
        const damEntity = await frisby.post(
          `${BASE_URL}/entities/upload?parent=${folderEntityDAM.uuid}&usage=dam`,
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);

        const entityUuid = damEntity.json.data[0].uuid;
        const response = await frisby.patch(
          `${BASE_URL}/entities/${entityUuid}/upload?viewport=${viewport}&revert=true`,
          {
            body: {}
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 64, 109);

        await Promise.all([
          deleteTestEntities([damEntity.uuid, folderEntityDAM.uuid])
        ]);
      });

      it('Should return 400 Bad Request error response, image size too big', async function unitTest() {
        this.timeout(maxTimeoutMs);

        const form = frisby.formData();
        form.append('file', fs.createReadStream(path.resolve('./test/samples/big-image-1.png')));
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`,
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 528, 108);
      });

      it('Should return 400 Bad Request error response, image type not supported', async () => {
        const form = frisby.formData();
        form.append('file', fs.createReadStream(path.resolve('./test/samples/good-gif.gif')));
        const response = await frisby.patch(
          `${BASE_URL}/entities/${rootEntity.uuid}/upload?viewport=${viewport}`,
          {
            headers: { 'Content-Type': form.getHeaders()['content-type'] },
            body: form
          }
        )
          .expect('status', 400)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

        expectErrorWithCode(response, 456, 108);
      });
    });
  });
});

describe.skip('Queue tests', async function unitTestsAsync() {
  // This is a long test
  this.timeout(0);
  let globalUsage;
  let validResourceType;
  let app;

  before(async () => {
    // Create a test fastify instance which we can manipulate during runtime
    app = fastify({
      ...baseServerConfig,
      // In tests show only errors from the log
      logger: {
        level: 'error',
        timestamp: () => `,'time':'${new Date().toLocaleString()}'`,
        prettyPrint: {
          levelFirst: true,
          ignore: 'pid,hostname'
        }
      }
    });

    // This plugin will allow us to access and mutate any decorator from fastify
    app.register(fastifyExplorer);
    app.register(appSetup, { ...baseSetupConfig, explorer: { name: 'override' } });

    // Wait for the test fastify instance to fully load
    await app.ready();

    [, globalUsage, validResourceType] = await getConfig(app.inject);

    if (!globalUsage) {
      throw Error('No usage found in config that has non-empty '
       + 'variant_resolutions and resource_types');
    }
  });

  after(async () => {
    // In case of errors we may still need to wait for db connections to close
    await waitAsync(5000);
    return app.close();
  });

  // Enable these tests only if needed because they take too long
  describe('Queue configuration', () => {
    it('Should have all stacks generated fully under load test conditions', async () => {
      const nrParallelRequests = 20;
      // Get a reference to the appConfig decorator
      const appConfigDecorator = app.giveMe('override', 'appConfig');
      const queueDecorator = app.giveMe('override', 'queue');

      // We need to make sure that the first and last value are dummy values and that
      // their measurements will be ignored because the load on the threads will be
      // ramping up/down in the first/last measurements and thus will be unreliable
      // More than 8 will cause Node to throw Out of Memory exceptions for 1GB allocated RAM
      const concurrencyRange = [4, 4, 5, 6, 7, 8];
      const allStacksUuidsList = [];
      const stackTimesWithQueueDict = {};
      const stackTimesWithQueueStatsDict = {};
      const stackTimesNoQueue = [];
      let index = 1;

      const samplesRange = [...makeRangeIterator(1, nrParallelRequests)];
      console.log(`Starting long load-test with number of parallel requests: ${nrParallelRequests}\n`);

      // Run the measurements for queue enabled
      for await (const concurrency of concurrencyRange) {
        const queueRef = queueDecorator[appConfigDecorator.jobQueue.name];
        queueRef.setRuntimeConfig({
          enabled: true,
          concurrency
        });
        const { rss } = process.memoryUsage();
        console.log(`Rss (total) memory: ${(rss / 1024 / 1024).toFixed(2)} MB`);

        const folderEntity1 = await createFolder(app.inject);
        const createdStacksUuidsList = [];

        // Upload empty stacks to DAM to prepare them for stack generation
        await Promise.allSettled(
          samplesRange.map(async () => {
            const stack = await createStackEntity(folderEntity1.uuid, 'dam', {
              resourceType: validResourceType
            }, app.inject);

            createdStacksUuidsList.push(stack[0].uuid);
          })
        );

        if (!stackTimesWithQueueDict[concurrency]) {
          stackTimesWithQueueDict[concurrency] = [];
        }

        // Generate stack for the empty stacks from above
        await Promise.allSettled(
          createdStacksUuidsList.map(async stackUuid => {
            const stack = await createAssetVariation(
              stackUuid, globalUsage, null, validResourceType, null, app.inject
            );
            allStacksUuidsList.push(stackUuid);

            if (index > 1) {
              stackTimesWithQueueDict[concurrency].push(stack.stack_time_ms);
            }
          })
        );

        if (index > 1) {
          console.log('piscina stats threads', queueRef.piscina.threads.length);
          console.log('piscina stats utilization', queueRef.piscina.utilization);
          console.log('piscina stats waitTime', queueRef.piscina.waitTime);

          const numbers = stackTimesWithQueueDict[concurrency];
          stackTimesWithQueueStatsDict[concurrency] = `Mean: ${average(numbers).toFixed(2)}, `
            + `Std Dev: ${stdDev(numbers).toFixed(2)}`;
        }
        console.log(`Queue ON: Finished iteration ${index}\n`);
        index += 1;
      }
      console.log('======================');

      // Run the measurements for queue disabled
      queueDecorator[appConfigDecorator.jobQueue.name].setRuntimeConfig({
        enabled: false
      });

      // We need to run the execution twice because we want to avoid biased
      // measurements in the ramp-down implied by the last generation step
      for await (const measure of [true, false]) {
        const folderEntity1 = await createFolder(app.inject);
        const createdStacksUuidsList = [];

        // Upload empty stacks to DAM to prepare them for stack generation
        await Promise.allSettled(
          samplesRange.map(async () => {
            const stack = await createStackEntity(folderEntity1.uuid, 'dam', {
              resourceType: validResourceType
            }, app.inject);

            createdStacksUuidsList.push(stack[0].uuid);
          })
        );

        // Generate stack for the empty stacks from above
        await Promise.allSettled(
          createdStacksUuidsList.map(async stackUuid => {
            const stack = await createAssetVariation(
              stackUuid, globalUsage, null, validResourceType, null, app.inject
            );
            allStacksUuidsList.push(stackUuid);
            if (measure) {
              stackTimesNoQueue.push(stack.stack_time_ms);
            }
          })
        );
      }

      const stackTimesNoQueueStats = `Mean: ${average(stackTimesNoQueue).toFixed(2)}, `
          + `Std Dev: ${stdDev(stackTimesNoQueue).toFixed(2)}`;
      console.log('======================\n');

      await deleteStacks(allStacksUuidsList, app.inject);

      console.log('Stack Times With Queue Stats:', stackTimesWithQueueStatsDict);
      console.log('Stack Time No Queue Stats:', stackTimesNoQueueStats);
      console.log('Stack Times With Queue:', stackTimesWithQueueDict);
      console.log('Stack Time No Queue:', stackTimesNoQueue);

      EXPECT(allStacksUuidsList.length, 'generated stacks')
        .to.be.equal((concurrencyRange.length + 2) * nrParallelRequests);
    });

    it('Should obtain large number of stack urls in less than 60 seconds', async () => {
      const nrParallelRequests = 200;
      const readBatchSize = 2000;

      const createBatchSize = 20;
      const totalStacksNeeded = 5000;

      const cacheDecorator = app.giveMe('override', 'cache');
      cacheDecorator.ChildCacheService.setGlobalRuntimeConfig({ globalDisable: true });

      console.log(`Starting long test which needs ${totalStacksNeeded} stacks\n`);

      // Create stacks until enough are present in DAM for the test
      const result = await app.inject()
        .get(`${BASE_URL}/entities?total_count=true&fld[type][eq]=stack`);
      const { total_items: existingStacksCount } = result.json().meta;

      console.log(`Found ${existingStacksCount} stacks\n`);

      if (existingStacksCount < totalStacksNeeded) {
        const totalStacksToGenerate = totalStacksNeeded - existingStacksCount;
        console.log(`Generating ~${totalStacksToGenerate} stacks needed to attain target stack count\n`);

        const generationStepRange = [...makeRangeIterator(
          0, Math.floor(totalStacksToGenerate / createBatchSize)
        )];
        const batchIndexRange = [...makeRangeIterator(1, createBatchSize)];

        let generatedCount = 0;
        for await (const generationStep of generationStepRange) {
          const folderEntity = await createFolder(app.inject);

          // Upload empty stacks to DAM to prepare them for stack generation
          const createdStacksUuidsList = [];

          let outcome = await Promise.race([
            Promise.allSettled(
              batchIndexRange.map(async () => {
                const stack = await createStackEntity(folderEntity.uuid, 'dam', {
                  resourceType: validResourceType
                }, app.inject);

                createdStacksUuidsList.push(stack[0].uuid);
              })
            ),
            waitAsync(10000).then(() => 0)
          ]);

          if (outcome === 0) {
            console.log('Timeout occurred during initial creation');
          }

          // Generate stack for the empty stacks from above, if uploaded successfully
          outcome = await Promise.race([
            await Promise.allSettled(
              createdStacksUuidsList.map(async stackUuid => {
                await createAssetVariation(
                  stackUuid, globalUsage, null, validResourceType, null, app.inject
                );
                generatedCount += 1;
              })
            ),
            waitAsync(10000).then(() => 0)
          ]);

          if (outcome === 0) {
            console.log('Timeout occurred during generation');
          }

          console.log(`Generated ${generatedCount} stacks`);
          await waitAsync(5000);
        }

        console.log('======================\n');
      }

      // Get UUIDs of all stacks we want to query
      const allStacksUuidsList = [];
      const requestForUuidRange = [...makeRangeIterator(0, Math.floor((totalStacksNeeded - 1) / 500))];

      for await (const requestCount of requestForUuidRange) {
        const response = await app.inject()
          .get(`${BASE_URL}/entities?limit=500&offset=${requestCount * 500}&fld[type][eq]=stack`);

        allStacksUuidsList.push(...response.json().data.map(entity => entity.uuid));
      }

      // Simulate multiple parallel requests to obtain the URLs for lots of stacks in batches
      const parallelRequestRange = [...makeRangeIterator(0, nrParallelRequests - 1)];
      const startTime = process.hrtime.bigint();
      const allReadUrls = [];

      await Promise.all(parallelRequestRange.map(async requestIndex => {
        // Pick a random batch of UUIDs to read the URLs for
        const uuidsInCurrentReadBatch = [];
        for (const step of makeRangeIterator(1, readBatchSize)) {
          const randomIndex = Math.floor(Math.random() * totalStacksNeeded);
          uuidsInCurrentReadBatch.push(allStacksUuidsList[randomIndex]);
        }

        const response = await app.inject()
          .post(`${BASE_URL}/stacks`)
          .payload({ uuids: uuidsInCurrentReadBatch })
          .end();

        console.log(`Iteration ${requestIndex.toString().padStart(3)}: `
          + `read ${response.json()?.data?.length} stacks`);
        response.json().data?.forEach(stackData => {
          const { uuid } = stackData;
          allReadUrls.push(uuid);
        });
      }));

      const totalReadTimeMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      console.log('\nTotal time:', (totalReadTimeMs / 1000).toFixed(2), 's');
      console.log('Total stacks read:', allReadUrls.length);

      EXPECT(totalReadTimeMs / 1000, 'total read time in bulk').to.be.lessThan(60);
    });
  });
});
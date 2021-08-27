/**
 * These tests will test ONLY the expected functionality of the URL feature (EXP-630)
 * The following conditions are expected to be fullfiled for the current context:
 *  - succesful upload of the image
 *  - correct dimensions of the image
 * For these tests to run properly, please wait for the
 * `Connection to caching server established successfully` info message from server.
 * This will probably be implemented automatically in the future
 * when we will run another server instance for the tests
 */

import testHelper from './helpers/index.js';

const {
  ENABLE_ALL_TESTS,
  EXPECT,
  frisby,
  BASE_URL,
  pollAsync,
  deleteTestEntities,
  deleteStacks,
  getConfig,
  createStackEntity,
  createFolder,
  stackGenerationFinishedCondition
} = testHelper;

const maxTimeoutMs = 10000;
const pollIntervalMs = 1000;

const { Joi } = frisby;

const INSTANCE_SCHEMA_ROOT = {
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
  local_path: Joi.string().allow('').required(),
  storage_path: Joi.string().allow(null).required(),
  type: Joi.string().valid('folder', 'file'),
  content_type: Joi.string().allow(null),
  priority: Joi.number().integer().positive().allow(0),
  status: Joi.string().valid('active', 'disabled').required(),
  bytes: Joi.number().integer().positive().allow(0)
    .required(),
  created_at: Joi.date(),
  modified_at: Joi.date()
};

const INSTANCE_SCHEMA_DATA = {
  rootEntity: INSTANCE_SCHEMA_ROOT,
  urls: Joi.object()
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

const unknownUuid = '891dd299-9543-42f9-b726-629b9cf2f8f4';

/**
 * get variants from a root uuid. the main feature
 *
 * @param {*} rootUuid uuid of the root entity
 * @return {*}
 */
describe('URLs tests', () => {
  let variantResolutions;
  let globalUsage;
  let globalResourceType;

  before(async () => {
    [variantResolutions, globalUsage, globalResourceType] = await getConfig();

    if (!globalUsage) {
      throw Error('No usage found in config that has non-empty '
      + 'variant_resolutions and resource_types');
    }
  });

  if (ENABLE_ALL_TESTS) {
    it('Should return a response in the specified format', async function unitTest() {
      this.timeout(maxTimeoutMs);

      const folderEntity = await createFolder();

      let [rootEntity] = await createStackEntity(
        folderEntity.uuid, globalUsage, { resourceType: globalResourceType }
      );

      rootEntity = await pollAsync(async () => {
        const response = await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}`);

        return response.json.data;
      }, stackGenerationFinishedCondition, pollIntervalMs);

      const response = await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}/urls`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DATA);

      const { data: { urls, rootEntity: entity }, data } = response.json;

      EXPECT(data).to.not.be.undefined;
      EXPECT(urls).to.not.be.undefined;
      EXPECT(urls).to.be.an('object');
      EXPECT(entity).to.be.an('object');

      EXPECT(urls).to.have.keys(Object.keys(variantResolutions));

      Object.keys(variantResolutions).forEach(variant => {
        EXPECT(urls[variant]).to.be.an('object');
        EXPECT(urls[variant]).to.have.keys(
          Object.keys(variantResolutions[variant])
        );
        Object.keys(variantResolutions[variant]).forEach(version => {
          EXPECT(urls[variant][version]).to.be.an('object');
          EXPECT(urls[variant][version]).to.have.keys(['width', 'height', 'url']);
        });
      });

      await Promise.all([
        deleteStacks([rootEntity.uuid]),
        deleteTestEntities([folderEntity.uuid])
      ]);
    });

    it('Should return an error when root entity not found',
      async () => {
        await frisby.get(`${BASE_URL}/entities/${unknownUuid}/urls`)
          .expect('status', 404)
          .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
      });

    it('Should reject request with root entity which has its usage for DAM', async function unitTest() {
      this.timeout(maxTimeoutMs);
      const folderEntity = await createFolder();

      let [rootEntity] = await createStackEntity(folderEntity
        .uuid, 'dam', 'anything_i_guess');

      rootEntity = await pollAsync(async () => {
        const response = await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}`);

        return response.json.data;
      }, entity => (entity?.stack_status !== 'pending'), pollIntervalMs);

      await frisby.get(`${BASE_URL}/entities/${rootEntity.uuid}/urls`)
        .expect('status', 404)
        .expect('jsonTypes', INSTANCE_SCHEMA_DATA);

      await Promise.all([
        deleteStacks([rootEntity.uuid]),
        deleteTestEntities([folderEntity.uuid])
      ]);
    });
  }
});
import serializeToQuerystring from 'fastify-global-plugins/test/helpers/query.js';
import INDEX from './helpers/index.js';

const { BASE_URL, EXPECT, frisby: FRISBY } = INDEX;
const JOI = FRISBY.Joi;

const INSTANCE_SCHEMA_DATA = {
  uuid: JOI.string().guid({ version: ['uuidv4'] }).required(),
  name: JOI.string().required(),
  created_by: JOI.object({
    name: JOI.string().required(),
    uuid: JOI.string().guid({ version: ['uuidv4'] }).required()
  }),
  modified_by: JOI.object({
    name: JOI.string().required(),
    uuid: JOI.string().guid({ version: ['uuidv4'] }).required()
  }),
  parent: JOI.string().guid({ version: ['uuidv4'] }).allow(null).required(),
  bytes: JOI.number().integer().positive().allow(0)
    .required(),
  status: JOI.string().valid('active', 'disabled').required(),
  local_path: JOI.string().allow('').required(),
  storage_path: JOI.string().allow(null).required(),
  type: JOI.string().valid('folder', 'file'),
  content_type: JOI.string().allow(null),
  priority: JOI.number().integer().positive().allow(0),
  created_at: JOI.date(),
  modified_at: JOI.date()
};
const INSTANCE_ERROR_MESSAGE = {
  content: JOI.string()
};
const INSTANCE_SCHEMA_ERROR_DATA = {
  statusCode: JOI.number().valid(200, 400, 404, 401),
  name: JOI.string(),
  code: JOI.string().regex(new RegExp('^\\d{3}.\\d*.\\d*$')),
  type: JOI.number().valid(0, 1, 2),
  details: JOI.array().items(INSTANCE_ERROR_MESSAGE),
  status: JOI.number().valid(200, 400, 404, 401),
  stack: JOI.string()
};
const INSTANCE_SCHEMA_LIST_METADATA = {
  total_items: JOI.number().integer().positive().allow(0),
  end: JOI.boolean(),
  count: JOI.number().integer().positive().allow(0)
};
const INSTANCE_SCHEMA_UPDATE_METADATA = {
  total_items: JOI.number().integer().positive().allow(0),
  count: JOI.number().integer().positive().allow(0)
};
const INSTANCE_SCHEMA_DELETE_METADATA = {
  count: JOI.number().integer().positive().allow(0)
};
const INSTANCE_SCHEMA_ERROR = {
  meta: JOI.object().allow({}),
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA),
  data: JOI.object().allow({}, null)
};
const INSTANCE_SCHEMA_ERROR_LIST = {
  meta: JOI.object().allow({}),
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA),
  data: JOI.array().allow([])
};
const INSTANCE_SCHEMA = {
  meta: JOI.object().allow({}),
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: INSTANCE_SCHEMA_DATA
};
const INSTANCE_SCHEMA_LIST = {
  meta: INSTANCE_SCHEMA_LIST_METADATA,
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: JOI.array().items(INSTANCE_SCHEMA_DATA).allow([])
};
const INSTANCE_SCHEMA_UPDATE = {
  meta: INSTANCE_SCHEMA_UPDATE_METADATA,
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: JOI.object(INSTANCE_SCHEMA_DATA)
};
const INSTANCE_SCHEMA_UPDATE_LIST = {
  meta: INSTANCE_SCHEMA_UPDATE_METADATA,
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: JOI.array().items(INSTANCE_SCHEMA_DATA).allow([])
};
const INSTANCE_SCHEMA_DELETE = {
  meta: INSTANCE_SCHEMA_DELETE_METADATA,
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: JOI.object().allow({}, null)
};
const INSTANCE_SCHEMA_DELETE_LIST = {
  meta: INSTANCE_SCHEMA_DELETE_METADATA,
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: JOI.object().allow({}, null)
};

const _generateSampleData = (extra = {}) => ({
  name: `sample-${Math.random()}`.replace(/\:/g, '-'),
  ...extra
});
const _deleteExtraSamples = async (uuids = []) => {
  if (uuids.length === 0) return false;
  const RESULTS = await FRISBY.delete(`${BASE_URL}/entities/?${serializeToQuerystring({
    uuid: {
      $in: uuids
    }
  })}`)
    .expect('status', 200)
    .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
  EXPECT(RESULTS.json.messages).to.be.undefined;
  return RESULTS.json.data;
};

let sample_1 = {};
describe('Any module endpoints', () => {
  // before each test create a sample instance to work with
  // before each test create a sample instance to work with
  beforeEach(async () => {
    const response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
      .expect('status', 200);

    EXPECT(response.json.messages).to.be.undefined;
    sample_1 = response.json.data;
  });
  // after each test remove the sample instance previously created
  afterEach(async () => {
    const response = await FRISBY.delete(`${BASE_URL}/entities/${sample_1.uuid}`)
      .expect('status', 200)
      .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);

    EXPECT(response.json.messages).to.be.undefined;
  });

  describe('/Caching', () => {
    it('Should return "200 OK" success response, data is stored correctly and list queries discriminate between different resources', async () => {
      // Create second item
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200);

      EXPECT(response.json.messages).to.be.undefined;
      const sample_2 = response.json.data;

      // Retrieve a list with instances
      const query = serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      });

      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const bannerElement = response.json.data[0];
      let { meta } = response.json;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);
      EXPECT(meta.end).to.equal(true);
      EXPECT(bannerElement.uuid).to.equal(sample_1.uuid);

      // Retrieve a list with file instances, with the same query as the first line
      response = await FRISBY.get(`${BASE_URL}/tags?${query}&limit=2&offset=0`)
        .expect('status', 200);
      const blockElement = response.json.data[0];
      meta = response.json.meta;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);
      EXPECT(meta.end).to.equal(true);
      EXPECT(blockElement.uuid).to.equal(sample_2.uuid);

      // Check if the lists are discriminated correctly even though they have the same query params,
      // The contents of the list should be different, including the first element's uuids
      EXPECT(bannerElement.uuid).to.not.equal(blockElement.uuid);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it.skip('Should return "200 OK" success response, data is refreshed correctly when items are updated individually', async () => {
      // Get instance
      let response = await FRISBY.get(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.data.uuid).to.equal(sample_1.uuid);

      // Then update it
      const SAMPLE_DATA = _generateSampleData();

      response = await FRISBY.patch(`${BASE_URL}/entities/${sample_1.uuid}`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_UPDATE);
      EXPECT(response.json.messages).to.be.undefined;

      // Get instance again after update
      const secondResponse = await FRISBY.get(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(secondResponse.json.messages).to.be.undefined;
      const dataRecheck = secondResponse.json.data;

      // Check the read value is equal with the value used for update
      EXPECT(dataRecheck.uuid).to.be.equal(sample_1.uuid);
      EXPECT(dataRecheck.name).to.equal(SAMPLE_DATA.name);
    });

    it('Should return "404 Not Found" error response, items are not stored after they are deleted individually', async () => {
      // Get instance
      let response = await FRISBY.get(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(response.json.data.uuid).to.equal(sample_1.uuid);

      // Delete it and check it succeeded
      response = await FRISBY.delete(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      const { meta } = response.json;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);

      // If we request the same instance again we should not be able to find it
      response = await FRISBY.get(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 404)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      EXPECT(response.json.messages).to.have.lengthOf(1);
    });

    it.skip('Should return "200 OK" success response, data for lists is refreshed when a containing item is updated individually', async () => {
      // Create second item
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200);
      EXPECT(response.json.messages).to.be.undefined;
      const sample_2 = response.json.data;

      // Retrieve list with the previously created entities
      const query = serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      }, [['created_at', 'ASC']]);

      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const list = response.json.data;
      let { meta } = response.json;

      EXPECT(meta.count).to.equal(2);
      EXPECT(meta.end).to.equal(true);
      EXPECT(list[0].uuid).to.equal(sample_1.uuid);
      EXPECT(list[1].uuid).to.equal(sample_2.uuid);

      // Then update the first in the list
      const SAMPLE_DATA = _generateSampleData();

      response = await FRISBY.patch(`${BASE_URL}/entities/${sample_1.uuid}`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_UPDATE);
      EXPECT(response.json.messages).to.be.undefined;

      // Retrieve list with the instances after the update
      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const listUpdated = response.json.data;
      meta = response.json.meta;

      EXPECT(meta.count).to.equal(2);
      EXPECT(meta.end).to.equal(true);

      const firstItem = listUpdated[0];
      const secondItem = listUpdated[1];

      // Check that the first was updated correctly and the second one remained unchanged
      EXPECT(firstItem.uuid).to.be.equal(sample_1.uuid);
      EXPECT(firstItem.name).to.equal(SAMPLE_DATA.name);

      EXPECT(secondItem).to.be.an('object').deep.equal(list[1]);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, data is refreshed correctly when a new item is created', async () => {
      // Create second item
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200);
      EXPECT(response.json.messages).to.be.undefined;
      const sample_2 = response.json.data;

      // Get instance after creation and check it is equal to the created value
      const secondResponse = await FRISBY.get(`${BASE_URL}/entities/${sample_2.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);

      EXPECT(secondResponse.json.messages).to.be.undefined;
      const dataRecheck = secondResponse.json.data;
      EXPECT(dataRecheck.uuid).to.be.equal(sample_2.uuid);
      EXPECT(dataRecheck.name).to.equal(sample_2.name);

      // Retrieve list with the previously created entities
      let query = serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      }, [['created_at', 'ASC']]);

      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const list = response.json.data;
      let { meta } = response.json;

      EXPECT(meta.count).to.equal(2);
      EXPECT(meta.end).to.equal(true);
      EXPECT(list[0].uuid).to.equal(sample_1.uuid);
      EXPECT(list[1].uuid).to.equal(sample_2.uuid);

      // Create third item
      response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200);
      EXPECT(response.json.messages).to.be.undefined;
      const sample_3 = response.json.data;

      // Retrieve list with the previously three created instances
      query = serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid, sample_3.uuid]
        }
      }, [['created_at', 'ASC']]);

      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=3&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const updatedList = response.json.data;
      meta = response.json.meta;

      // Check initial unmodified entities are found with their initial values in the updated list
      EXPECT(meta.count).to.equal(3);
      EXPECT(meta.end).to.equal(true);
      EXPECT(updatedList[0]).to.deep.equal(list[0]);
      EXPECT(updatedList[1]).to.deep.equal(list[1]);

      // Check the newly created is found in the updated list with correct values
      EXPECT(updatedList[2].uuid).to.be.equal(sample_3.uuid);
      EXPECT(updatedList[2].name).to.equal(sample_3.name);

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "200 OK" success response, data for lists is refreshed correctly when a containing item is deleted', async () => {
      // Create second item
      const SAMPLE_DATA = _generateSampleData();
      let response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA, { json: true })
        .expect('status', 200);
      EXPECT(response.json.messages).to.be.undefined;
      const sample_2 = response.json.data;

      // Retrieve list with the previously created instances
      const query = serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      }, [['created_at', 'ASC']]);

      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const list = response.json.data;
      let { meta } = response.json;

      EXPECT(meta.count).to.equal(2);
      EXPECT(meta.end).to.equal(true);
      EXPECT(list[0].uuid).to.equal(sample_1.uuid);
      EXPECT(list[1].uuid).to.equal(sample_2.uuid);

      // Delete the second item and check it succeeded
      response = await FRISBY.delete(`${BASE_URL}/entities/${sample_2.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      meta = response.json.meta;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);

      // Retrieve list with instances again
      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      meta = response.json.meta;

      EXPECT(meta.count).to.equal(1);
      EXPECT(meta.end).to.equal(true);

      const firstItem = data[0];
      const secondItem = data[1];

      // Check that the unmodified was kept unchanged and that the second one was deleted
      EXPECT(firstItem.uuid).to.be.equal(sample_1.uuid);
      EXPECT(firstItem.name).to.equal(sample_1.name);

      EXPECT(secondItem).to.be.undefined;
    });

    it.skip('Should return "200 OK" success response, data for lists and items in lists is refreshed correctly when items are updated via an update query', async () => {
      // Create second item
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200);
      EXPECT(response.json.messages).to.be.undefined;
      const sample_2 = response.json.data;

      // Retrieve list with the previously created instances
      const query = serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      }, [['created_at', 'ASC']]);

      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const list = response.json.data;
      let { meta } = response.json;

      EXPECT(meta.count).to.equal(2);
      EXPECT(meta.end).to.equal(true);
      EXPECT(list[0].uuid).to.equal(sample_1.uuid);
      EXPECT(list[1].uuid).to.equal(sample_2.uuid);

      // Then update the first in the list using an update query
      const SAMPLE_DATA = {
        valid_from: new Date().toISOString(),
        name: new Date().toISOString()
      };

      response = await FRISBY.patch(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: sample_1.uuid
        }
      })}`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_UPDATE_LIST);
      EXPECT(response.json.messages).to.be.undefined;
      meta = response.json.meta;
      EXPECT(meta.count).to.equal(1);

      // Retrieve the list of entities again with the updated value
      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const listUpdated = response.json.data;
      meta = response.json.meta;

      EXPECT(meta.count).to.equal(2);
      EXPECT(meta.end).to.equal(true);

      const firstItem = listUpdated[0];
      const secondItem = listUpdated[1];

      // Check the first was modified correctly
      EXPECT(firstItem.uuid).to.be.equal(sample_1.uuid);
      EXPECT(firstItem.name).to.equal(SAMPLE_DATA.name);

      // Check the second hasn't changed
      EXPECT(secondItem).to.be.an('object').deep.equal(list[1]);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, data for lists and items in lists is refreshed correctly when items are deleted via a delete query', async () => {
      // Create second item
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200);
      EXPECT(response.json.messages).to.be.undefined;
      const sample_2 = response.json.data;

      // Retrieve list with the previously created instances
      const query = serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      }, [['created_at', 'ASC']]);

      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      let list = response.json.data;
      let { meta } = response.json;

      EXPECT(meta.count).to.equal(2);
      EXPECT(meta.end).to.equal(true);
      EXPECT(list[0].uuid).to.equal(sample_1.uuid);
      EXPECT(list[1].uuid).to.equal(sample_2.uuid);

      // Then delete the second in the list using a delete query
      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: sample_2.uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      meta = response.json.meta;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);

      // Retrieve the list with instances again
      response = await FRISBY.get(`${BASE_URL}/entities?${query}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      list = response.json.data;
      meta = response.json.meta;

      EXPECT(meta.count).to.equal(1);
      EXPECT(meta.end).to.equal(true);

      const firstItem = list[0];
      const secondItem = list[1];

      // Check the first was not modified
      EXPECT(firstItem.uuid).to.be.equal(sample_1.uuid);
      EXPECT(firstItem.name).to.equal(sample_1.name);

      // Check the second was deleted
      EXPECT(secondItem).to.be.undefined;
    });
  });
});
import serializeToQuerystring from 'fastify-global-plugins/test/helpers/query.js';
import INDEX from './helpers/index.js';

const { BASE_URL, EXPECT, frisby: FRISBY } = INDEX;
const JOI = FRISBY.Joi;

const NON_EXISTENT_UUID = '6af2d336-5344-11eb-ae93-0242ac130002';
const INSTANCE_SCHEMA_DATA = {
  uuid: JOI.string().guid({ version: ['uuidv4'] }).required(),
  name: JOI.string().required()
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
const INSTANCE_SCHEMA_DELETE_METADATA = {
  count: JOI.number().integer().positive().allow(0)
};
const INSTANCE_SCHEMA_ERROR = {
  meta: JOI.object().allow({}),
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA),
  data: JOI.object().allow({}, null)
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

/**
 * Generate sample data
 * @param {object} extra - extra properties to add to sample data
 * @returns {{
 *   status: number,
 *   name: string
 * }}
 *
 * @private
 */
const _generateSampleData = (extra = {}) => ({
  name: `tag${Math.random()}`,
  ...extra
});

const _deleteExtraSamples = async (uuids = []) => {
  if (uuids.length === 0) return false;
  const RESULTS = await FRISBY.delete(`${BASE_URL}/tags/?${serializeToQuerystring({
    uuid: {
      $in: uuids
    }
  })}`)
    .expect('status', 200)
    .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
  EXPECT(RESULTS.json.messages).to.be.undefined;
  return RESULTS.json.data;
};

function _expectErrorWithCode(response, errorCode, classCode = '000') {
  const data = response?.json?.data;
  const meta = response?.json?.meta;
  const messages = response?.json?.messages;

  EXPECT(messages).to.not.be.empty;
  EXPECT(meta).to.be.undefined;
  EXPECT([null, undefined]).to.include(data);
  EXPECT(messages).to.have.length(1);
  EXPECT(messages[0].code).to.equal(`003.${classCode}.${errorCode}`);
}

let sample_1 = {};
describe('Tags endpoints', function () {
  this.timeout(5000);
  // before each test create a sample instance to work with
  beforeEach(async () => {
    const response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
      .expect('status', 200);

    EXPECT(response.json.messages).to.be.undefined;
    sample_1 = response.json.data;
  });
  // after each test remove the sample instance previously created
  afterEach(async () => {
    const response = await FRISBY.delete(`${BASE_URL}/tags/${sample_1.uuid}`)
      .expect('status', 200)
      .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);

    EXPECT(response.json.messages).to.be.undefined;
  });

  describe('POST /tags', () => {
    it('Should return "200 OK" success response, valid [data]', async () => {
      const SAMPLE_DATA = _generateSampleData();
      const response = await FRISBY.post(`${BASE_URL}/tags`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      EXPECT(sample_2.uuid, 'uuid').not.to.be.undefined;
      EXPECT(sample_2.name, 'name').to.equal(SAMPLE_DATA.name);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, valid [name] with allowed characters', async () => {
      const randomString = Math.random();
      const SAMPLE_DATA = _generateSampleData({
        name: `ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-ĂÎÂȘȚăîâșț.0123456789 ${randomString}`
      });

      const response = await FRISBY.post(`${BASE_URL}/tags`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);

      const sample_2 = response.json.data;
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(sample_2.name, 'name').to.equal(SAMPLE_DATA.name.toLowerCase());

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, invalid [name] which includes not allowed characters', async () => {
      const SAMPLE_DATA = _generateSampleData({ name: 'Test%#^,.=-' });

      const response = await FRISBY.post(`${BASE_URL}/tags`, {
        data: SAMPLE_DATA
      }, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, invalid [uuid] field', async () => {
      const SAMPLE_DATA = _generateSampleData({
        uuid: NON_EXISTENT_UUID
      });
      const response = await FRISBY.post(`${BASE_URL}/tags`, SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid [data], duplicate entry', async () => {
      const SAMPLE_DATA = _generateSampleData({
        name: sample_1.name
      });

      const response = await FRISBY.post(`${BASE_URL}/tags`, SAMPLE_DATA, { json: true })
        .expect('status', 409)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 392, 102);
    });

    it('Should return "400 Bad Request" error response, invalid structure [data]', async () => {
      const response = await FRISBY.post(`${BASE_URL}/tags`, {
        data: 'wrong'
      }, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], missing [...properties]', async () => {
      const response = await FRISBY.post(`${BASE_URL}/tags`, {}, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], invalid values [...properties]', async () => {
      const SAMPLE_DATA = _generateSampleData({
        name: 100
      });
      const response = await FRISBY.post(`${BASE_URL}/tags`, {
        data: SAMPLE_DATA
      }, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });
  });

  describe('DELETE /tags', () => {
    it('Should return "200 OK" success response, valid [query filter], delete all available tags', async () => {
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(2);
    });

    it('Should return "200 OK" success response, valid [query filter], delete some available instances', async () => {
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $eq: sample_2.uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);
    });

    it('Should return "200 OK" success response, valid [query filter], no record in database', async () => {
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $eq: sample_2.uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      let { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);

      response = await FRISBY.delete(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $eq: sample_2.uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      meta = response.json.meta;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(0);
    });

    it('Should return "400 Bad Request" error response, invalid [query filter]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $eq: sample_2.uuid
        }
      }).replace('eq', 'opBad')}`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
      _expectErrorWithCode(response, 920, 2);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });
  });

  describe('DELETE /tags/:uuid', () => {
    it('Should return "200 OK" success response, valid [uuid]', async () => {
      const response = await FRISBY.delete(`${BASE_URL}/tags/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);
    });

    it('Should return "200 OK" success response, valid [uuid], no record in database', async () => {
      let response = await FRISBY.delete(`${BASE_URL}/tags/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      let { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);

      response = await FRISBY.delete(`${BASE_URL}/tags/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      meta = response.json.meta;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(0);
    });

    it('Should return "400 Bad Request" error response, invalid [uuid]', async () => {
      const response = await FRISBY.delete(`${BASE_URL}/tags/wrong`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });
  });

  describe('GET /tags', () => {
    it('Should return "200 OK" success response, valid [query filter, limit, offset], return all available tags', async () => {
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      })}&limit=2&offset=0&total_count=true`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { meta } = response.json;
      const { data } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(2);
      // Make sure we ignore the order
      const actualUuids = [data[0].uuid, data[1].uuid].sort();
      const expectedUuids = [sample_1.uuid, sample_2.uuid].sort();
      EXPECT(actualUuids[0], 'first element uuid').to.equal(expectedUuids[0]);
      EXPECT(actualUuids[1], 'second element uuid').to.equal(expectedUuids[1]);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, total_count not requested, return all available tags', async () => {
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      })}&limit=2&offset=0&total_count=false`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { meta } = response.json;
      const { data } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items, 'total items in database').to.be.undefined;
      // Make sure we ignore the order
      const actualUuids = [data[0].uuid, data[1].uuid].sort();
      const expectedUuids = [sample_1.uuid, sample_2.uuid].sort();
      EXPECT(actualUuids[0], 'first element uuid').to.equal(expectedUuids[0]);
      EXPECT(actualUuids[1], 'second element uuid').to.equal(expectedUuids[1]);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, return some available tags, first page', async () => {
      const randomString = Math.random();
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData({ name: `SaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData({ name: `AaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_3 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid, sample_3.uuid]
        }
      })}&limit=1&offset=0&total_count=true`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(false);
      EXPECT(meta.total_items).to.equal(3);

      EXPECT(data[0].uuid, 'first result uuid').to.equal(sample_3.uuid);
      EXPECT(data[1], 'second result').to.be.undefined;

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "200 OK" success response, return some available instances, last page', async () => {
      const randomString = Math.random();
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData({ name: `SaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData({ name: `AaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_3 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid, sample_3.uuid]
        }
      })}&limit=1&offset=1&total_count=true`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(false);
      EXPECT(meta.total_items).to.equal(3);

      EXPECT(data[0].uuid, 'first result uuid').to.equal(sample_2.uuid);
      EXPECT(data[1], 'second result').to.be.undefined;

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, invalid [query filter], valid [limit, offset]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $eq: sample_1.uuid
        }
      }).replace('eq', 'opBad')}&limit=1&offset=1`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
      EXPECT(response.json.messages, 'error list').to.have.lengthOf(1);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, valid [query filter], invalid [limit, offset]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/tags`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/tags?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      })}&limit=wrong&offset=wrong`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
      _expectErrorWithCode(response, 902, 4);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });
  });

  describe('GET /tags/:uuid', () => {
    it('Should return "200 OK" success response, valid [uuid]', async () => {
      const response = await FRISBY.get(`${BASE_URL}/tags/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      const { data } = response.json;

      EXPECT(response.json.messages, 'errors list').to.be.undefined;
      EXPECT(data.uuid, 'uuid').to.equal(sample_1.uuid);
      EXPECT(data.name, 'name').to.equal(sample_1.name);
    });

    it('Should return "404 Not Found" error response, valid [uuid], no record in database', async () => {
      let response = await FRISBY.delete(`${BASE_URL}/tags/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);

      response = await FRISBY.get(`${BASE_URL}/tags/${sample_1.uuid}`)
        .expect('status', 404)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 544, 102);
    });

    it('Should return "400 Bad Request" error response, invalid [uuid]', async () => {
      const response = await FRISBY.get(`${BASE_URL}/tags/wrong`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });
  });
});
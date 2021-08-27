/* eslint-disable camelcase */
/* eslint-disable no-underscore-dangle */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-expressions */
import serializeToQuerystring from 'fastify-global-plugins/test/helpers/query.js';
import testHelper from './helpers/index.js';

const {
  BASE_URL,
  EXPECT,
  frisby: FRISBY,
  generateConfigSampleData: _generateSampleData,
  deleteConfigs: _deleteExtraSamples,
  createFolder,
  createStackEntity,
  stackGenerationFinishedCondition,
  pollAsync,
  deleteTestEntities,
  deleteStacks
} = testHelper;
const JOI = FRISBY.Joi;

const INSTANCE_SCHEMA_DATA = {
  id: JOI.string().required(),
  min_rez_vertical: JOI.number().required(),
  min_rez_horizontal: JOI.number().required(),
  max_rez_vertical: JOI.number().required(),
  max_rez_horizontal: JOI.number().required(),
  variant_resolutions: JOI.object().required().allow(null),
  global_background: JOI.object().required().allow(null),
  resource_types: JOI.array().required().allow(null).items(JOI.string()),
  created_by: JOI.object({
    name: JOI.string().required(),
    uuid: JOI.string().guid({ version: ['uuidv4'] }).required()
  }),
  modified_by: JOI.object({
    name: JOI.string().required(),
    uuid: JOI.string().guid({ version: ['uuidv4'] }).required()
  })
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
const INSTANCE_SCHEMA = {
  meta: JOI.object().allow({}),
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: INSTANCE_SCHEMA_DATA
};
const INSTANCE_SCHEMA_LIST = {
  meta: INSTANCE_SCHEMA_LIST_METADATA,
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: JOI.array().items([INSTANCE_SCHEMA_DATA, JOI.string()]).allow([])
};
const INSTANCE_SCHEMA_UPDATE = {
  meta: INSTANCE_SCHEMA_UPDATE_METADATA,
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: JOI.object(INSTANCE_SCHEMA_DATA)
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

function _removePropertiesFromObject(targetObject, properties) {
  const filteredObject = { ...targetObject };
  properties.forEach(element => (delete filteredObject[element]));
  return filteredObject;
}

function _checkResponse(messages, actual, expected, identifier = '', checkId = false) {
  EXPECT(messages, `${identifier} error list`).to.be.undefined;

  if (checkId) {
    EXPECT(actual.id, `${identifier} id`).to.equal(expected.id);
  } else {
    EXPECT(actual.id, `${identifier} id`).not.to.be.undefined;
  }

  EXPECT(actual.min_rez_vertical, `${identifier} min_rez_vertical`).to.equal(expected.min_rez_vertical);
  EXPECT(actual.min_rez_horizontal, `${identifier} min_rez_horizontal`).to.equal(expected.min_rez_horizontal);
  EXPECT(actual.max_rez_vertical, `${identifier} max_rez_vertical`).to.equal(expected.max_rez_vertical);
  EXPECT(actual.max_rez_horizontal, `${identifier} max_rez_horizontal`).to.equal(expected.max_rez_horizontal);
  EXPECT(actual.variant_resolutions, `${identifier} variant_resolutions`).to.deep.equal(expected.variant_resolutions);
  EXPECT(actual.global_background, `${identifier} global_background`).to.deep.equal(expected.global_background);
  EXPECT(actual.resource_types, `${identifier} resource_types`).to.deep.equal(expected.resource_types);
  EXPECT(actual.created_by, `${identifier} created by`).to.be.an('object').that.has.all.keys('name', 'uuid');
  EXPECT(actual.created_by.name, `${identifier} created by name`).not.to.be.undefined;
  EXPECT(actual.modified_by, `${identifier} modified by`).to.be.an('object').that.has.all.keys('name', 'uuid');
  EXPECT(actual.modified_by.name, `${identifier} modified by name`).not.to.be.undefined;
}

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
describe('Config endpoints', function () {
  this.timeout(20000);
  const maxTimeoutMs = 10000;
  const resourceId = '891dd299-9543-42f9-b726-629b9cf2f8f4';
  const resourceName = 'SJX-123';

  // before each test create a sample instance to work with
  beforeEach(async () => {
    const response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData(), { json: true })
      .expect('status', 200);

    EXPECT(response.json.messages).to.be.undefined;
    sample_1 = response.json.data;
  });
  // after each test remove the sample instance previously created
  afterEach(async () => {
    const response = await FRISBY.delete(`${BASE_URL}/config/${sample_1.id}`)
      .expect('status', 200)
      .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);

    EXPECT(response.json.messages).to.be.undefined;
  });

  describe('POST /config', () => {
    it('Should return "200 OK" success response, valid [data]', async () => {
      const SAMPLE_DATA = _generateSampleData();
      const response = await FRISBY.post(`${BASE_URL}/config`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      const { data: sample, messages } = response.json;
      _checkResponse(messages, sample, SAMPLE_DATA);

      await _deleteExtraSamples([
        sample_2.id
      ]);
    });

    it('Should return "200 OK" success response, valid [id] with allowed characters', async () => {
      const SAMPLE_DATA = _generateSampleData();

      const response = await FRISBY.post(`${BASE_URL}/config`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);

      const sample_2 = response.json.data;

      const { data: sample, messages } = response.json;
      _checkResponse(messages, sample, SAMPLE_DATA);

      await _deleteExtraSamples([
        sample_2.id
      ]);
    });

    it('Should return "200 OK" success response, valid [data], valid variant_resolutions aspect ratios', async () => {
      const variant_resolutions = {
        desktop: {
          v1: {
            width: 1920,
            height: 1080
          },
          v2: {
            width: 1366,
            height: 768
          }
        },
        mobile: {
          v1: {
            width: 2,
            height: 4
          },
          v2: {
            width: 200,
            height: 400
          },
          v3: {
            width: 400,
            height: 800
          }
        }
      };

      const SAMPLE_DATA = _generateSampleData({ variant_resolutions });
      const response = await FRISBY.post(`${BASE_URL}/config`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      const { data: sample, messages } = response.json;
      _checkResponse(messages, sample, SAMPLE_DATA);

      await _deleteExtraSamples([
        sample_2.id
      ]);
    });

    it('Should return "400 Bad Request" error response, invalid [id] which includes not allowed characters', async () => {
      const SAMPLE_DATA = _generateSampleData({ id: 'Test%#^,.=-' });

      const response = await FRISBY.post(`${BASE_URL}/config`, {
        data: SAMPLE_DATA
      }, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, empty [id] field', async () => {
      const SAMPLE_DATA = _generateSampleData({
        id: ''
      });
      const response = await FRISBY.post(`${BASE_URL}/config`, SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid [data], duplicate entry', async () => {
      const SAMPLE_DATA = _generateSampleData({
        id: sample_1.id
      });

      const response = await FRISBY.post(`${BASE_URL}/config`, SAMPLE_DATA, { json: true })
        .expect('status', 409)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 152, 103);
    });

    it('Should return "400 Bad Request" error response, invalid structure [data]', async () => {
      const response = await FRISBY.post(`${BASE_URL}/config`, {
        data: 'wrong'
      }, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], missing [...properties]', async () => {
      const response = await FRISBY.post(`${BASE_URL}/config`, {}, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], invalid values [...properties]', async () => {
      const SAMPLE_DATA = _generateSampleData({
        resource_types: 100
      });
      const response = await FRISBY.post(`${BASE_URL}/config`, {
        data: SAMPLE_DATA
      }, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 OK" error response, valid [data], invalid variant_resolutions aspect ratios', async () => {
      const variant_resolutions = {
        desktop: {
          v1: {
            width: 1920,
            height: 1080
          },
          v2: {
            width: 1366,
            height: 768
          }
        },
        mobile: {
          v1: {
            width: 2,
            height: 4
          },
          v2: {
            width: 200,
            height: 456
          },
          v3: {
            width: 400,
            height: 800
          }
        }
      };

      const SAMPLE_DATA = _generateSampleData({ variant_resolutions });
      const response = await FRISBY.post(`${BASE_URL}/config`, SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 968, 104);
    });
  });

  describe('DELETE /config', () => {
    it('Should return "200 OK" success response, valid [query filter], delete filtered configs, which are not reserved and/or used by stacks', async () => {
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $eq: sample_2.id
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);
    });

    it('Should return "200 OK" success response, valid [query filter], no record in database', async () => {
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $eq: sample_2.id
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      let { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);

      response = await FRISBY.delete(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $eq: sample_2.id
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      meta = response.json.meta;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(0);
    });

    it('Should return "400 Bad Request" error response, invalid [query filter]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $eq: sample_2.id
        }
      }).replace('eq', 'opBad')}`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
      _expectErrorWithCode(response, 920, 2);

      await _deleteExtraSamples([
        sample_2.id
      ]);
    });

    it('Should return "400 Bad request" error response, valid [query filter], if all of the queried configs are reserved configs', async () => {
      const response = await FRISBY.delete(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $in: ['cms', 'dam', 'pim']
        }
      })}`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
      _expectErrorWithCode(response, 808, 103);
    });

    it('Should return "400 Bad request" error response, valid [query filter], if all of the queried configs are used by stacks', async function unitTest() {
      const pollIntervalMs = 500;
      this.timeout(maxTimeoutMs);

      // create config
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData({
        min_rez_vertical: 1,
        min_rez_horizontal: 1,
        max_rez_vertical: 1500,
        max_rez_horizontal: 1500
      }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;

      const configData = response.json.data;

      const folderEntity = await createFolder();

      const [rootStack] = await createStackEntity(folderEntity.uuid,
        configData.id, { resourceType: configData.resource_types[0], resourceId, resourceName });

      const rootEntity = await pollAsync(async () => {
        const stackResponse = await FRISBY.get(`${BASE_URL}/entities/${rootStack.uuid}`);

        return stackResponse.json.data;
      }, stackGenerationFinishedCondition, pollIntervalMs);

      response = await FRISBY.delete(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $eq: configData.id
        }
      })}`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 24, 103);

      // delete entity
      await deleteStacks([rootEntity.uuid]);
      await deleteTestEntities([folderEntity.uuid]);

      await _deleteExtraSamples([
        configData.id
      ]);
    });
  });

  describe('DELETE /config/:id', () => {
    it('Should return "200 OK" success response, valid [id]', async () => {
      const response = await FRISBY.delete(`${BASE_URL}/config/${sample_1.id}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);
    });

    it('Should return "200 OK" success response, valid [id], no record in database', async () => {
      let response = await FRISBY.delete(`${BASE_URL}/config/${sample_1.id}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      let { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);

      response = await FRISBY.delete(`${BASE_URL}/config/${sample_1.id}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      meta = response.json.meta;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(0);
    });

    it('Should return "400 Bad Request" error response, invalid [id]', async () => {
      const response = await FRISBY.delete(`${BASE_URL}/config/wrong!@#`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, [id] DAM, CMS and PIM cannot be deleted', async () => {
      const modulesToDeleteArr = ['dam', 'cms', 'pim'];

      const deleteResponseList = await Promise.all(
        modulesToDeleteArr.map(
          module => (
            FRISBY.delete(`${BASE_URL}/config/${module}`)
              .expect('status', 400)
              .expect('jsonTypes', INSTANCE_SCHEMA_ERROR)
          )
        )
      );

      deleteResponseList.forEach(response => {
        _expectErrorWithCode(response, 808, 103);
      });
    });

    it('Should return "400 Bad request" if the config is used by an entity', async function unitTest() {
      // create an entity with set usage
      const pollIntervalMs = 500;
      this.timeout(maxTimeoutMs);

      // create config
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData({
        min_rez_vertical: 1,
        min_rez_horizontal: 1,
        max_rez_vertical: 1500,
        max_rez_horizontal: 1500
      }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;

      const configData = response.json.data;

      const folderEntity = await createFolder();

      const [rootStack] = await createStackEntity(folderEntity.uuid,
        configData.id, { resourceType: configData.resource_types[0], resourceId, resourceName });

      const rootEntity = await pollAsync(async () => {
        const stackResponse = await FRISBY.get(`${BASE_URL}/entities/${rootStack.uuid}`);

        return stackResponse.json.data;
      }, stackGenerationFinishedCondition, pollIntervalMs);

      // send DELETE with the above mentioned usage
      response = await FRISBY.delete(`${BASE_URL}/config/${configData.id}`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 984, 103);

      // delete entity
      await deleteStacks([rootEntity.uuid]);
      await deleteTestEntities([folderEntity.uuid]);

      await _deleteExtraSamples([
        configData.id
      ]);
    });
  });

  describe('PATCH /config/:id', () => {
    it('Should return "200 OK" success response, valid [id, data], update resource_types', async () => {
      sample_1.resource_types = ['updated-test-value'];
      const sample_1_filtered = _removePropertiesFromObject(sample_1,
        ['id', 'created_by', 'modified_by', 'max_file_bytes', 'max_files', 'supported_image_types']);
      const response = await FRISBY.patch(`${BASE_URL}/config/${sample_1.id}`, sample_1_filtered, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_UPDATE);

      const { data: updated, messages: messagesForUpdated } = response.json;

      _checkResponse(
        messagesForUpdated,
        updated,
        sample_1,
        '',
        true
      );

      const getResponse = await FRISBY.get(`${BASE_URL}/config/${sample_1.id}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      const { data } = getResponse.json;

      EXPECT(getResponse.json.messages, 'errors list').to.be.undefined;
      EXPECT(data.id, 'id').to.equal(sample_1.id);
      EXPECT(data.resource_types[0], 'resource_types').to.equal(sample_1.resource_types[0]);
    });

    it('Should return "200 OK" success response, valid [data], valid variant_resolutions aspect ratios', async () => {
      const variant_resolutions = {
        desktop: {
          v1: {
            width: 1920,
            height: 1080
          },
          v2: {
            width: 1366,
            height: 768
          }
        },
        mobile: {
          v1: {
            width: 2,
            height: 4
          },
          v2: {
            width: 200,
            height: 400
          },
          v3: {
            width: 400,
            height: 800
          }
        }
      };

      sample_1.variant_resolutions = variant_resolutions;
      const patchData = _removePropertiesFromObject(sample_1,
        ['id', 'created_by', 'modified_by', 'max_file_bytes', 'max_files', 'supported_image_types']);
      const response = await FRISBY.patch(`${BASE_URL}/config/${sample_1.id}`, patchData, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_UPDATE);

      const { data, messages } = response.json;

      EXPECT(messages, 'error list').to.be.undefined;

      EXPECT(data.id, 'id').to.equal(sample_1.id);
      EXPECT(data.variant_resolutions, 'resource_types').to.deep.equal(sample_1.variant_resolutions);
    });

    it('Should return "400 Bad Request" error response, invalid [data], additional properties [id]', async () => {
      const SAMPLE_DATA = _generateSampleData({
        id: 'JababurNuAreCumSaExiste',
        giani: 'cocalarul'
      });
      await FRISBY.patch(`${BASE_URL}/config/${sample_1.uuid}`,
        SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
    });

    it('Should return "404 Not Found" error response, valid [id, data], no record in database', async () => {
      let SAMPLE_DATA = _generateSampleData();
      SAMPLE_DATA = _removePropertiesFromObject(SAMPLE_DATA, ['id']);
      await FRISBY.patch(`${BASE_URL}/config/idinexistentlol`, SAMPLE_DATA, { json: true })
        .expect('status', 404)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
    });

    it('Should return "400 Bad Request" error response, valid [data], invalid [id]', async () => {
      let SAMPLE_DATA = _generateSampleData();
      SAMPLE_DATA = _removePropertiesFromObject(SAMPLE_DATA, ['id']);
      await FRISBY.patch(`${BASE_URL}/config/wrong@#$%`, SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
    });

    it('Should return "400 Bad Request" error response, invalid structure [data], valid [id]', async () => {
      await FRISBY.patch(`${BASE_URL}/config/${sample_1.id}`, 'wrong', { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], missing [...properties], valid [id]', async () => {
      await FRISBY.patch(`${BASE_URL}/config/${sample_1.id}`, {}, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], invalid values [...properties], valid [id]', async () => {
      const SAMPLE_DATA = _generateSampleData({
        global_background: 1,
        min_rez_vertical: 'hehe',
        variant_resolutions: 'wow'
      });
      await FRISBY.patch(`${BASE_URL}/config/${sample_1.id}`, SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], invalid variant_resolutions aspect ratios', async () => {
      const variant_resolutions = {
        desktop: {
          v1: {
            width: 1920,
            height: 1080
          },
          v2: {
            width: 1366,
            height: 768
          }
        },
        mobile: {
          v1: {
            width: 2,
            height: 4
          },
          v2: {
            width: 300,
            height: 400
          },
          v3: {
            width: 400,
            height: 800
          }
        }
      };

      sample_1.variant_resolutions = variant_resolutions;
      const patchData = _removePropertiesFromObject(sample_1,
        ['id', 'created_by', 'modified_by', 'max_file_bytes', 'max_files', 'supported_image_types']);

      const response = await FRISBY.patch(`${BASE_URL}/config/${sample_1.id}`, patchData, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 968, 104);
    });
  });

  describe('GET /config', () => {
    it('Should return "200 OK" success response, valid [query filter, limit, offset], return all available config', async () => {
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $in: [sample_1.id, sample_2.id]
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

      const { id: id1 } = data.find(element => element.id === sample_1.id);
      const { id: id2 } = data.find(element => element.id === sample_2.id);

      EXPECT(id1, 'first element id').to.equal(sample_1.id);
      EXPECT(id2, 'second element id').to.equal(sample_2.id);

      await _deleteExtraSamples([
        sample_2.id
      ]);
    });

    it('Should return "200 OK" success response, total_count not requested, return all available config', async () => {
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $in: [sample_1.id, sample_2.id]
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

      const { id: id1 } = data.find(element => element.id === sample_1.id);
      const { id: id2 } = data.find(element => element.id === sample_2.id);

      EXPECT(id1, 'first element id').to.equal(sample_1.id);
      EXPECT(id2, 'second element id').to.equal(sample_2.id);

      await _deleteExtraSamples([
        sample_2.id
      ]);
    });

    it('Should return "400 Bad Request" error response, invalid [query filter], valid [limit, offset]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $eq: sample_1.id
        }
      }).replace('eq', 'opBad')}&limit=1&offset=1`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 920, 2);

      await _deleteExtraSamples([
        sample_2.id
      ]);
    });

    it('Should return "400 Bad Request" error response, valid [query filter], invalid [limit, offset]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/config`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/config?${serializeToQuerystring({
        id: {
          $in: [sample_1.id, sample_2.id]
        }
      })}&limit=wrong&offset=wrong`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
      _expectErrorWithCode(response, 902, 4);

      await _deleteExtraSamples([
        sample_2.id
      ]);
    });
  });

  describe('GET /config/:id', () => {
    it('Should return "200 OK" success response, valid [id]', async () => {
      const response = await FRISBY.get(`${BASE_URL}/config/${sample_1.id}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      const { data } = response.json;

      EXPECT(response.json.messages, 'errors list').to.be.undefined;
      EXPECT(data.id, 'id').to.equal(sample_1.id);
      EXPECT(data.name, 'name').to.equal(sample_1.name);
    });

    it('Should return "404 Not Found" error response, valid [id], no record in database', async () => {
      let response = await FRISBY.delete(`${BASE_URL}/config/${sample_1.id}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);

      response = await FRISBY.get(`${BASE_URL}/config/${sample_1.id}`)
        .expect('status', 404)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 648, 103);
    });

    it('Should return "400 Bad Request" error response, invalid [id]', async () => {
      const response = await FRISBY.get(`${BASE_URL}/config/Test%#^,.=-`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });
  });
});
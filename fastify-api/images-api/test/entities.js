/* eslint-disable */
/* eslint-disable no-unused-expressions */
/* eslint-disable require-jsdoc */
/* eslint-disable no-underscore-dangle */
import FS from 'fs';
import PATH from 'path';
import serializeToQuerystring from 'fastify-global-plugins/test/helpers/query.js';
import INDEX from './helpers/index.js';

const { 
  BASE_URL,
  EXPECT,
  frisby: FRISBY,
  expectErrorWithCode: _expectErrorWithCode,
  deleteStacks
} = INDEX;
const JOI = FRISBY.Joi;
let sample_1 = {};

const SAMPLES = {
  good: {
    image: PATH.resolve('./test/samples/good-image-1.jpg'),
    imageTwo: PATH.resolve('./test/samples/good-image-2.jpg'),
    imageThree: PATH.resolve('./test/samples/good-image-3.jpg'),
    document: PATH.resolve('./test/samples/good-document-1.pdf')
  },
  bad: {
    size: {
      image: PATH.resolve('./test/samples/bad-image-1.jpg'),
      document: PATH.resolve('./test/samples/bad-document-1.pdf')
    },
    mimetype: {
      image: PATH.resolve('./test/samples/bad-image-2.svg'),
      document: PATH.resolve('./test/samples/bad-document-2.js')
    },
    naming: {
      image: PATH.resolve('./test/samples/my-craazy-âțî+_)(.jpeg')
    },
    dimensions: {
      image: PATH.resolve('./test/samples/bad-dimensions-1.png')
    }
  }
};
const NON_EXISTENT_UUID = '6af2d336-5344-11eb-ae93-0242ac130002';

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
  type: JOI.string(),
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
const INSTANCE_SCHEMA_DELETE_METADATA = {
  count: JOI.number().integer().positive().allow(0)
};
const INSTANCE_SCHEMA_ERROR = {
  meta: JOI.object().allow({}),
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA),
  data: JOI.object().allow({}, null)
};
const INSTANCE_SCHEMA_ERROR_LIST = {
  meta: INSTANCE_SCHEMA_LIST_METADATA,
  messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA),
  data: JOI.array().allow([], null)
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

const _generateSampleData = (extra = {}) => ({
  name: `root-sample-${Math.random()}`,
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

const _deleteTags = async (names = []) => {
  if (names.length === 0) return false;
  const RESULTS = await FRISBY.delete(`${BASE_URL}/tags?${serializeToQuerystring({
    name: {
      $in: names
    }
  })}`)
    .expect('status', 200)
    .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
  EXPECT(RESULTS.json.messages).to.be.undefined;
  return RESULTS.json.data;
};
const _getUserFullName = userUuid => {
  const MOCK_NAMES = [
    'George Popescu',
    'Ion Despescu',
    'Florian Grigore'
  ];

  const deterministicRandomIndex = (userUuid.charCodeAt(0) - 48) % MOCK_NAMES.length;

  return MOCK_NAMES[deterministicRandomIndex];
};
const _createFolderStructure = async () => {
  let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
    .expect('status', 200);

  EXPECT(response.json.messages).to.be.undefined;
  const folder_1 = response.json;

  response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({
    parent: folder_1.data.uuid
  }), { json: true })
    .expect('status', 200);

  EXPECT(response.json.messages).to.be.undefined;
  const folder_2 = response.json;

  response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({
    parent: folder_2.data.uuid
  }), { json: true })
    .expect('status', 200);

  EXPECT(response.json.messages).to.be.undefined;
  const folder_3 = response.json;

  response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
    uuid: {
      $in: [folder_1.data.uuid, folder_2.data.uuid, folder_3.data.uuid]
    }
  }, [['created_at', 'ASC']])}&limit=3&offset=0`)
    .expect('status', 200)
    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);

  return [...response?.json?.data];
};

async function postAndUploadEntitiesAsync(
  entityName,
  controlValue = '',
  hasResourceType = true
) {
  const columnsSearchForPost = [
    'name'
  ];
  const columnsSearchForUpload = [
    'resource_name',
    'resource_id',
    'resource_type'
  ].filter(column => (hasResourceType ? column : column !== 'resource_type'));

  let postUploadPromise = [];

  async function _doPost(column, entityName) {
    const response = await FRISBY.post(`${BASE_URL}/entities`,
      _generateSampleData({ [column]: entityName, tags: [entityName] }), { json: true })
      .expect('status', 200)
      .expect('jsonTypes', INSTANCE_SCHEMA);
    EXPECT(response.json.messages, 'error list').to.be.undefined;
    return response;
  }

  async function _doUpload(column, image) {
    let currentImage = '';
    switch (image) {
      case 1:
        currentImage = 'image';
        break;
      case 2:
        currentImage = 'imageTwo';
        break;
      case 3:
        currentImage = 'imageThree';
        break;
      default:
        // code block
        console.log('_doUpload image count is not valid: ', image);
    }

    const FORM = FRISBY.formData();
    FORM.append('files[]', FS.createReadStream(SAMPLES.good[currentImage]));
    FORM.append('renames[]', `Test ${Math.random()}`);
    FORM.append('tags[]', '');

    const uploadUrl = new URL(
      `${BASE_URL}/entities/upload?parent=null&usage=cms&resource_id=GenericId&resource_type=block&resource_name=GenericName`
    );
    uploadUrl.searchParams.set(column, entityName);

    // We can also specify the root folder as the null string for parent query param
    const response = await FRISBY.post(uploadUrl.href, {
      headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
      body: FORM
    })
      .expect('status', 200)
      .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
    return response;
  }

  for (let i = 0; i < columnsSearchForPost.length; i++) {
    postUploadPromise.push(_doPost(columnsSearchForPost[i], entityName));
  }

  for (let i = 0; i < columnsSearchForUpload.length; i++) {
    postUploadPromise.push(_doUpload(columnsSearchForUpload[i], i + 1));
  }

  // Remove resource type promise if
  // hasResourceType param specifies to
  if (!hasResourceType) {
    postUploadPromise = postUploadPromise.filter((value, index) => index !== 4);
  }

  // Push check value to verify correct ordering. Should appear last
  if (controlValue) {
    postUploadPromise.push(_doPost(columnsSearchForPost[0], controlValue));
  }

  const results = await Promise.all(postUploadPromise);

  const responseUuidsArray = results.map(result => (result.json.data[0]?.uuid || (result.json.data.uuid)));

  return responseUuidsArray;
}

describe('Entities endpoints', function () {
  this.timeout(10000);

  before(async () => {
    // In case some tests fail with error they cannot clean up after themselves so we must
    // make sure here to delete file uploaded with the same names to avoid wrong errors
    await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
      name: {
        $in: [
          'bad-document-1.pdf',
          'bad-document-2.js',
          'bad-image-1.jpg',
          'bad-image-2.svg',
          'good-document-1.pdf',
          'good-image-1.jpg',
          'my-crazy-.jpeg',
          'New-name',
          'banner'
        ]
      }
    })}`)
      .expect('status', 200)
      .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
  });

  // before each test create a sample instance to work with
  beforeEach(async () => {
    const sampleData = _generateSampleData();
    const response = await FRISBY.post(`${BASE_URL}/entities`, sampleData, { json: true })
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

  describe('POST /entities', () => {
    it('Should return "200 OK" success response, valid [data]', async () => {
      const SAMPLE_DATA = _generateSampleData({ parent: sample_1.uuid });
      const response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      EXPECT(sample_2.uuid, 'uuid').not.to.be.undefined;

      EXPECT(sample_2.bytes, 'size in bytes').to.equal(0);
      EXPECT(sample_2.status, 'status').to.equal('active');
      EXPECT(sample_2.storage_path, 'storage path').to.be.null;
      EXPECT(sample_2.local_path, 'logic path').to.be.equal(`${sample_1.name}`);
      EXPECT(sample_2.type, 'type').to.equal('folder');
      EXPECT(sample_2.priority, 'priority').to.equal(0);
      EXPECT(sample_2.parent, 'parent').to.equal(SAMPLE_DATA.parent);
      EXPECT(sample_2.name, 'name').to.equal(SAMPLE_DATA.name);
      EXPECT(sample_2.modified_by, 'modified_by').to.be.an('object').that.has.all.keys('name', 'uuid');
      EXPECT(sample_2.modified_by.name, 'modified_by name').to.equal(_getUserFullName(sample_2.modified_by.uuid));
      EXPECT(sample_2.created_by, 'created_by').to.be.an('object').that.has.all.keys('name', 'uuid');
      EXPECT(sample_2.created_by.name, 'created_by name').to.equal(_getUserFullName(sample_2.created_by.uuid));

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, valid [data], with custom tags', async () => {
      const SAMPLE_DATA = _generateSampleData({ tags: ['cat', 'dog', 'alien'] });
      const response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      EXPECT(sample_2.uuid, 'uuid').not.to.be.undefined;

      EXPECT(sample_2.bytes, 'size in bytes').to.equal(0);
      EXPECT(sample_2.status, 'status').to.equal('active');
      EXPECT(sample_2.storage_path, 'storage path').to.be.null;
      EXPECT(sample_2.local_path, 'logic path').to.equal('');
      EXPECT(sample_2.type, 'type').to.equal('folder');
      EXPECT(sample_2.priority, 'priority').to.equal(0);
      EXPECT(sample_2.parent, 'parent').to.be.null;
      EXPECT(sample_2.name, 'name').to.equal(SAMPLE_DATA.name);
      EXPECT(sample_2.modified_by, 'modified_by').to.be.an('object').that.has.all.keys('name', 'uuid');
      EXPECT(sample_2.modified_by.name, 'modified_by name').to.equal(_getUserFullName(sample_2.modified_by.uuid));
      EXPECT(sample_2.created_by, 'created_by').to.be.an('object').that.has.all.keys('name', 'uuid');
      EXPECT(sample_2.created_by.name, 'created_by name').to.equal(_getUserFullName(sample_2.created_by.uuid));
      EXPECT(sample_2.tags, 'tags').to.have.members(['cat', 'dog', 'alien']);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);

      await _deleteTags(sample_2.tags);
    });

    it('Should return "200 OK" success response, valid [name] with all allowed characters', async () => {
      const randomString = Math.random();
      const SAMPLE_DATA = _generateSampleData({
        name: `ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-ĂÎÂȘȚăîâșț.0123456789 ${randomString}`,
        parent: null
      });

      const response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);

      const sample_2 = response.json.data;
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(sample_2.name, 'name').to.equal(SAMPLE_DATA.name);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, invalid [name] which includes not allowed characters', async () => {
      const SAMPLE_DATA = _generateSampleData({ name: 'Test%#^,.=-' });

      const response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "200 OK" success response, valid [local_path, breadcrumbs, parent]', async () => {
      const SAMPLE_DATA_2 = _generateSampleData({ parent: sample_1.uuid });

      let response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA_2, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      EXPECT(sample_2.local_path, 'logic path').to.be.equal(`${sample_1.name}`);
      EXPECT(sample_2.parent, 'parent').to.equal(SAMPLE_DATA_2.parent);
      EXPECT(sample_2.name, 'name').to.equal(SAMPLE_DATA_2.name);

      const SAMPLE_DATA_3 = _generateSampleData({ parent: sample_2.uuid });

      response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA_3, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_3 = response.json.data;

      EXPECT(sample_3.local_path, 'logic path').to.be.equal(`${sample_1.name}/${sample_2.name}`);
      EXPECT(sample_3.parent, 'parent').to.equal(SAMPLE_DATA_3.parent);
      EXPECT(sample_3.name, 'name').to.equal(SAMPLE_DATA_3.name);

      EXPECT(sample_3.breadcrumbs, 'breadcrumbs').to.deep.equal([
        {
          name: sample_1.name,
          parent: null,
          uuid: sample_1.uuid
        },
        {
          name: sample_2.name,
          parent: sample_1.uuid,
          uuid: sample_2.uuid
        }
      ]);

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, invalid [uuid] field', async () => {
      const SAMPLE_DATA = _generateSampleData({
        uuid: NON_EXISTENT_UUID
      });
      const response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid [data], duplicate entry in the same folder', async () => {
      const SAMPLE_DATA = _generateSampleData({
        name: sample_1.name
      });

      const response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA, { json: true })
        .expect('status', 409)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 128, 101);
    });

    it('Should return "200 OK" success response, valid [data], duplicate entry in another folder', async () => {
      const SAMPLE_DATA_2 = _generateSampleData({ parent: sample_1.uuid });
      let response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA_2, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      const SAMPLE_DATA_3 = _generateSampleData({
        name: sample_1.name,
        parent: sample_2.uuid
      });

      response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA_3, { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
      const sample_3 = response.json.data;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(sample_1.name, 'duplicate name').to.equal(sample_3.name);

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, invalid structure [data]', async () => {
      const response = await FRISBY.post(`${BASE_URL}/entities`, {
        data: 'wrong'
      }, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid parent [uuid], no record in database', async () => {
      const response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ parent: NON_EXISTENT_UUID }), { json: true })
        .expect('status', 404)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 936, 101);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], missing [...properties]', async () => {
      const response = await FRISBY.post(`${BASE_URL}/entities`, {}, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, valid structure [data], invalid values [...properties]', async () => {
      const SAMPLE_DATA = _generateSampleData({
        parent: 'wrong',
        modified_by: 'wrong',
        status: 'wrong'
      });
      const response = await FRISBY.post(`${BASE_URL}/entities`, SAMPLE_DATA, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });
  });

  describe('DELETE /entities', () => {
    it('Should return "200 OK" success response, valid [query filter], delete all available entities', async () => {
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list after delete').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(2);
    });

    it('Should return "200 OK" success response, valid [query filter], delete some available instances', async () => {
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
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
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: sample_2.uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      let { meta } = response.json;

      EXPECT(response.json.messages, 'error list for deletion').to.be.undefined;
      EXPECT(meta.count, 'first delete count').to.equal(1);

      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: sample_2.uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      meta = response.json.meta;

      EXPECT(response.json.messages, 'error list after deletion').to.be.undefined;
      EXPECT(meta.count, 'second delete count').to.equal(0);
    });

    it('Should return "400 Bad Request" error response, invalid [query filter]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
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

  describe('DELETE /entities/:uuid', () => {
    it('Should return "200 OK" success response, valid [uuid]', async () => {
      const response = await FRISBY.delete(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);
    });

    it('Should return "200 OK" success response, valid [uuid], no record in database', async () => {
      let response = await FRISBY.delete(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      let { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);

      response = await FRISBY.delete(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      meta = response.json.meta;

      EXPECT(response.json.messages, 'error list after delete').to.be.undefined;
      EXPECT(meta.count, 'delete count after delete').to.equal(0);
    });

    it('Should return "400 Bad Request" error response, invalid [uuid]', async () => {
      const response = await FRISBY.delete(`${BASE_URL}/entities/wrong`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });
  });

  describe('GET /entities', () => {
    it('Should return "200 OK" success response, valid [query filter], return all available entities', async () => {
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      }, [['created_at', 'ASC']])}&limit=2&offset=0&total_count=true`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { meta } = response.json;
      const { data } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(2);
      EXPECT(data[0].uuid, 'first element uuid').to.equal(sample_1.uuid);
      EXPECT(data[1].uuid, 'second element uuid').to.equal(sample_2.uuid);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, total_count not requested, return all available entities', async () => {
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid]
        }
      }, [['created_at', 'ASC']])}&limit=2&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { meta } = response.json;
      const { data } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items, 'total items in database').to.be.undefined;
      EXPECT(data[0].uuid, 'first element uuid').to.equal(sample_1.uuid);
      EXPECT(data[1].uuid, 'second element uuid').to.equal(sample_2.uuid);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, valid [search_for], returns correct case-insensitive matches', async () => {
      const randomString = Math.random();
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `ZZAAA.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `AaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_3 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid, sample_3.uuid]
        }
      }, [['created_at', 'ASC']])}&limit=10&offset=0&search_for=aaa`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);

      EXPECT(data[0].uuid, 'first result uuid').to.equal(sample_3.uuid);
      EXPECT(data[1].uuid, 'second result uuid').to.equal(sample_2.uuid);

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "200 OK" success response, valid [search_for], test correct priority ordering for exact matches and one partial match', async () => {
      const searchForTestData = await postAndUploadEntitiesAsync('banner', `some text banner some text ${Math.random()}`);

      const searchForValue = 'banner';

      const response = await FRISBY.get(
        `${BASE_URL}/entities?${serializeToQuerystring({
          $and: [
            { root_uuid: { $eq: null } },
            { uuid: { $in: searchForTestData } }
          ]
        }, [['created_at', 'ASC']])}&limit=500&offset=0&total_count=true&search_for=${searchForValue}`
      )
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { meta } = response.json;
      const { data } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(5);
      EXPECT(meta.total_items).to.equal(5);

      EXPECT(data[0].uuid, 'first element uuid').to.equal(searchForTestData[0]);
      EXPECT(data[1].uuid, 'second element uuid').to.equal(searchForTestData[1]);
      EXPECT(data[2].uuid, 'third element uuid').to.equal(searchForTestData[2]);
      EXPECT(data[3].uuid, 'fourth element uuid').to.equal(searchForTestData[3]);
      EXPECT(data[4].uuid, 'fifth element uuid').to.equal(searchForTestData[4]);

      await deleteStacks(searchForTestData);
    });

    it('Should return "200 OK" success response, valid [search_for], test correct priority ordering for partial matches', async () => {
      const searchForTestData = await postAndUploadEntitiesAsync(`cool device pink ${Math.random()}`, '', false);

      const searchForValue = 'device';

      const response = await FRISBY.get(
        `${BASE_URL}/entities?${serializeToQuerystring({
          $and: [
            { root_uuid: { $eq: null } },
            { uuid: { $in: searchForTestData } }
          ]
        }, [['created_at', 'ASC']])}&limit=500&offset=0&total_count=true&search_for=${searchForValue}`
      )
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { meta } = response.json;
      const { data } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(3);
      EXPECT(meta.total_items).to.equal(3);

      EXPECT(data[0].uuid, 'first element uuid').to.equal(searchForTestData[0]);
      EXPECT(data[1].uuid, 'second element uuid').to.equal(searchForTestData[1]);
      EXPECT(data[2].uuid, 'third element uuid').to.equal(searchForTestData[2]);

      await deleteStacks(searchForTestData);
    });

    it('Should return "200 OK" success response, valid [search_for], five results on three pages, correct pagination', async () => {
      const searchForValue = 'banner';
      // Insert 5 entities
      const searchForTestData = await postAndUploadEntitiesAsync(searchForValue, `great banner ${Math.random()}`);

      const getResponse = async offset => (await FRISBY.get(
        `${BASE_URL}/entities?${serializeToQuerystring({
          $and: [
            { root_uuid: { $eq: null } },
            { uuid: { $in: searchForTestData } }
          ]
        }, [['created_at', 'ASC']])}&limit=2&offset=${offset}&total_count=true&search_for=${searchForValue}`
      )
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST)
      );

      // Check page 1
      let response = await getResponse(0);

      let { meta } = response.json;
      let { data } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.total_items).to.equal(5);

      EXPECT(data[0].uuid, 'first element uuid').to.equal(searchForTestData[0]);
      EXPECT(data[1].uuid, 'second element uuid').to.equal(searchForTestData[1]);

      // Check page 2
      response = await getResponse(2);

      meta = response.json.meta;
      data = response.json.data;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.total_items).to.equal(5);

      EXPECT(data[0].uuid, 'first element uuid').to.equal(searchForTestData[2]);
      EXPECT(data[1].uuid, 'second element uuid').to.equal(searchForTestData[3]);

      // Check page 3
      response = await getResponse(4);

      meta = response.json.meta;
      data = response.json.data;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.total_items).to.equal(5);

      EXPECT(data[0].uuid, 'first element uuid').to.equal(searchForTestData[4]);

      await deleteStacks(searchForTestData);
    });

    it('Should return "200 OK" success response, valid [search_for], [search_tags_instead] used, receive only entities with specific tag', async () => {
      // Post 5 folders, only 3 with tags, search for them by tags and check count & uuids matchings
      const searchForValue = 'UnitTestTagNoTouch';
      const postDataArr = [
        {
          name: `UnitTestFolder ${Math.random()}`,
          parent: null,
          tags: [searchForValue]
        },
        {
          name: `UnitTestFolder ${Math.random()}`,
          parent: null,
          tags: [searchForValue, 'Tagtesting']
        },
        {
          name: `UnitTestFolder ${Math.random()}`,
          parent: null
        },
        {
          name: `UnitTestFolder ${Math.random()}`,
          parent: null,
          tags: ['whattag', searchForValue, 'Tagtesting']
        },
        {
          name: `UnitTestFolder ${Math.random()}`,
          parent: null
        }
      ];

      const postResUuidArr = [];

      for (let i = 0; i < postDataArr.length; i++) {
        const postResponse = await FRISBY.post(`${BASE_URL}/entities`, postDataArr[i], { json: true })
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA);
        EXPECT(postResponse.json.messages, 'error list').to.be.undefined;
        const { data } = postResponse.json;
        postResUuidArr.push(data.uuid);
      }

      const response = await FRISBY.get(
        `${BASE_URL}/entities?${serializeToQuerystring(
          { uuid: { $in: postResUuidArr } },
          [['created_at', 'ASC']]
        )}&limit=500&offset=0&total_count=true&search_for=${searchForValue}&search_tags_instead=true`
      )
      .expect('status', 200)
      .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { meta } = response.json;
      const { data } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(3);
      EXPECT(meta.total_items).to.equal(3);

      EXPECT(data[0].uuid, 'first element uuid').to.equal(postResUuidArr[0]);
      EXPECT(data[1].uuid, 'second element uuid').to.equal(postResUuidArr[1]);
      // Skip postResUuidArr[2] because third element from array has no tags
      EXPECT(data[2].uuid, 'third element uuid').to.equal(postResUuidArr[3]);

      await _deleteExtraSamples(postResUuidArr);
    });

    it('Should return "200 OK" success response, valid [search_for], treats wildcard _ char as normal char ', async () => {
      // In case more special chars will be allowed they can simply be added to
      // the patterns in this list, except the + sign which is not encoded correctly by Frisby
      const PATTERNS = ['aaa_a'];

      const createdSamplesIdList = [];

      const createFolderWithWildcardPattern = async searchTerm => {
        const randomString = Math.random();
        const response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `${searchTerm}.${randomString}` }), { json: true })
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA);
        EXPECT(response.json.messages, 'error list').to.be.undefined;
        const sample = response.json.data;

        createdSamplesIdList.push(sample.uuid);
      };

      const checkWildcardPattern = async (searchTerm, expectedId) => {
        const response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
          uuid: {
            $in: createdSamplesIdList
          }
        })}&limit=10&offset=0&search_for=${searchTerm}`)
          .expect('status', 200)
          .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
        const { data } = response.json;
        const { meta } = response.json;

        EXPECT(response.json.messages, 'error list').to.be.undefined;
        EXPECT(meta.count, 'find count').to.equal(1);

        EXPECT(data[0].uuid, 'first result uuid').to.equal(expectedId);
        EXPECT(data[1], 'second result').to.be.undefined;
      };

      // First create all entities
      for (const searchPattern of PATTERNS) {
        await createFolderWithWildcardPattern(searchPattern);
      }

      // Then check the right result is returned among the possible names
      let index = 0;
      for (const searchPattern of PATTERNS) {
        await checkWildcardPattern(searchPattern, createdSamplesIdList[index]);
        index++;
      }

      await _deleteExtraSamples(createdSamplesIdList);
    });

    it('Should return "200 OK" success response, valid [search_for], returns exact match first', async () => {
      const randomString = Math.random();
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `ZaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `aaa.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_3 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid, sample_3.uuid]
        }
      }, [['created_at', 'ASC']])}&limit=10&offset=0&search_for=aaa`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);

      EXPECT(data[0].uuid, 'first result uuid').to.equal(sample_3.uuid);
      EXPECT(data[1].uuid, 'second result uuid').to.equal(sample_2.uuid);

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "200 OK" success response, valid [search_for], filter by type', async () => {
      const randomString = Math.random();
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `AabbAaaCD.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        $and: [
          {
            uuid: {
              $in: [sample_1.uuid, sample_2.uuid]
            }
          },
          {
            type: {
              $eq: 'folder'
            }
          }
        ]
      })}&limit=10&offset=0&search_for=aaa`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(data[0].type, 'first result type').to.equal('folder');

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "200 OK" success response, valid [search_for], return some available instances, first page', async () => {
      const randomString = Math.random();
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `SaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `AaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_3 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid, sample_3.uuid]
        }
      }, [['created_at', 'ASC']])}&limit=1&offset=0&search_for=aaa&total_count=true`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(false);
      EXPECT(meta.total_items).to.equal(2);

      EXPECT(data[0].uuid, 'first result uuid').to.equal(sample_3.uuid);
      EXPECT(data[1], 'second result').to.be.undefined;

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "200 OK" success response, valid [search_for], return some available instances, last page', async () => {
      const randomString = Math.random();
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `SaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData({ name: `AaaaB.${randomString}` }), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_3 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [sample_1.uuid, sample_2.uuid, sample_3.uuid]
        }
      }, [['created_at', 'ASC']])}&limit=1&offset=1&search_for=aaa&total_count=true`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(2);

      EXPECT(data[0].uuid, 'first result uuid').to.equal(sample_2.uuid);
      EXPECT(data[1], 'second result').to.be.undefined;

      await _deleteExtraSamples([
        sample_2.uuid, sample_3.uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, invalid [query filter], valid [limit, offset]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
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

    it('Should return "200 OK" error response, valid [query filter], missing [limit, offset]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: sample_1.uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(true);

      await _deleteExtraSamples([
        sample_2.uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, valid [query filter], invalid [limit, offset]', async () => {
      let response = await FRISBY.post(`${BASE_URL}/entities`, _generateSampleData(), { json: true })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      EXPECT(response.json.messages, 'error list').to.be.undefined;
      const sample_2 = response.json.data;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
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

  describe('GET /entities/:uuid', () => {
    it('Should return "200 OK" success response, valid [uuid]', async () => {
      const response = await FRISBY.get(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA);
      const { data } = response.json;

      EXPECT(response.json.messages, 'errors list').to.be.undefined;
      EXPECT(data.uuid, 'uuid').to.equal(sample_1.uuid);

      EXPECT(data.bytes, 'size in bytes').to.equal(sample_1.bytes);
      EXPECT(data.status, 'status').to.equal(sample_1.status);
      EXPECT(data.storage_path, 'storage path').to.equal(sample_1.storage_path);
      EXPECT(data.local_path, 'logic path').to.equal(sample_1.local_path);
      EXPECT(data.type, 'type').to.equal(sample_1.type);
      EXPECT(data.priority, 'priority').to.equal(sample_1.priority);
      EXPECT(data.parent, 'parent').to.equal(sample_1.parent);
      EXPECT(data.name, 'name').to.equal(sample_1.name);
      EXPECT(data.modified_by, 'modified_by').to.be.an('object').that.has.all.keys('name', 'uuid');
      EXPECT(data.modified_by.name, 'modified_by name').to.equal(_getUserFullName(data.modified_by.uuid));
      EXPECT(data.created_by, 'created_by').to.be.an('object').that.has.all.keys('name', 'uuid');
      EXPECT(data.created_by.name, 'created_by name').to.equal(_getUserFullName(data.created_by.uuid));

      EXPECT(data.breadcrumbs, 'breadcrumbs').to.be.empty;
    });

    it('Should return "404 Not Found" error response, valid [uuid], no record in database', async () => {
      let response = await FRISBY.delete(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
      const { meta } = response.json;

      EXPECT(response.json.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);

      response = await FRISBY.get(`${BASE_URL}/entities/${sample_1.uuid}`)
        .expect('status', 404)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 768, 101);
    });

    it('Should return "400 Bad Request" error response, invalid [uuid]', async () => {
      const response = await FRISBY.get(`${BASE_URL}/entities/wrong`)
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });
  });

  // TODO Replace live GCP bucket upload with mock
  describe('POST /entities/upload', function () {
    // set this timeout higher because we are testing uploads and it may last > 2 seconds
    this.timeout(10000);
    const TITLE = 'New name';

    it('Should return "200 OK" success response, upload one valid file, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');

      // We can also specify the root folder as the null string for parent query param
      let response = await FRISBY.post(`${BASE_URL}/entities/upload?parent=null&usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data, meta } = response.json;

      const FILENAME = PATH.basename(TITLE).replace(/[^\w\d\.]/ig, '-');
      const FILESIZE = FS.statSync(SAMPLES.good.image)?.size;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);
      EXPECT(data[0].name).to.equal(FILENAME);
      EXPECT(data[0].parent).to.equal(null);
      EXPECT(data[0].local_path).to.equal('');
      EXPECT(data[0].storage_path).to.equal(`${data[0].uuid}/o/${FILENAME}`);
      EXPECT(data[0].bytes).to.equal(FILESIZE);
      EXPECT(data[0].type).to.equal('stack:empty');
      EXPECT(data[0].priority).to.equal(1);
      EXPECT(data[0].status).to.equal('active');
      EXPECT(data[0].content_type).to.equal('image/jpeg');
      EXPECT(data[0].usage).to.equal('dam');
      EXPECT(data[0].stack_status).to.equal('empty');
      EXPECT(data[0].width).to.not.be.undefined;
      EXPECT(data[0].height).to.not.be.undefined;
      EXPECT(data[0].bytes).to.not.be.undefined;

      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: data[0].uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);

      EXPECT(response.json.messages, 'delete messages').to.be.undefined;
      EXPECT(response.json.meta.count, 'delete count').to.equal(1);
    });

    it('Should return "200 OK" success response, upload one valid file, root folder, custom tags', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', 'cat,dog,alien');
      let response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      let { meta } = response.json;

      const FILENAME = PATH.basename(TITLE).replace(/[^\w\d\.]/ig, '-');
      const FILESIZE = FS.statSync(SAMPLES.good.image)?.size;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);
      EXPECT(data[0].name).to.equal(FILENAME);
      EXPECT(data[0].parent).to.equal(null);
      EXPECT(data[0].local_path).to.equal('');
      EXPECT(data[0].storage_path).to.equal(`${data[0].uuid}/o/${FILENAME}`);
      EXPECT(data[0].bytes).to.equal(FILESIZE);
      EXPECT(data[0].type).to.equal('stack:empty');
      EXPECT(data[0].priority).to.equal(1);
      EXPECT(data[0].status).to.equal('active');
      EXPECT(data[0].tags, 'tags').to.have.members(['cat', 'dog', 'alien']);
      EXPECT(data[0].content_type).to.equal('image/jpeg');
      EXPECT(data[0].usage).to.equal('dam');
      EXPECT(data[0].stack_status).to.equal('empty');
      EXPECT(data[0].width).to.not.be.undefined;
      EXPECT(data[0].height).to.not.be.undefined;
      EXPECT(data[0].bytes).to.not.be.undefined;

      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: data[0].uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
      meta = response.json.meta;

      EXPECT(response.json.messages, 'delete messages').to.be.undefined;
      EXPECT(meta.count, 'delete count').to.equal(1);
    });

    it('Should return "200 OK" success response, upload one valid file, non-root-first folder', async () => {
      const FOLDERS = await _createFolderStructure();

      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');
      let response = await FRISBY.post(`${BASE_URL}/entities/upload?parent=${FOLDERS[0].uuid}&usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      const FILENAME = PATH.basename(TITLE).replace(/[^\w\d\.]/ig, '-');
      const FILESIZE = FS.statSync(SAMPLES.good.image)?.size;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);
      EXPECT(data[0].name).to.equal(FILENAME);
      EXPECT(data[0].parent).to.equal(FOLDERS[0].uuid);
      EXPECT(data[0].local_path).to.equal(FOLDERS[0].name);
      EXPECT(data[0].storage_path).to.equal(`${data[0].uuid}/o/${FILENAME}`);
      EXPECT(data[0].bytes).to.equal(FILESIZE);
      EXPECT(data[0].type).to.equal('stack:empty');
      EXPECT(data[0].priority).to.equal(1);
      EXPECT(data[0].status).to.equal('active');
      EXPECT(data[0].content_type).to.equal('image/jpeg');
      EXPECT(data[0].usage).to.equal('dam');
      EXPECT(data[0].stack_status).to.equal('empty');
      EXPECT(data[0].width).to.not.be.undefined;
      EXPECT(data[0].height).to.not.be.undefined;
      EXPECT(data[0].bytes).to.not.be.undefined;

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [FOLDERS[0].uuid, FOLDERS[1].uuid, FOLDERS[2].uuid]
        }
      }, [['created_at', 'ASC']])}&limit=3&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const foldersData = response.json.data;

      EXPECT(foldersData[0].bytes).to.equal(FILESIZE);
      EXPECT(foldersData[1].bytes).to.equal(0);
      EXPECT(foldersData[2].bytes).to.equal(0);

      await _deleteExtraSamples([
        data[0].uuid,
        FOLDERS[0].uuid,
        FOLDERS[1].uuid,
        FOLDERS[2].uuid
      ]);
    });

    it('Should return "200 OK" success response, upload two valid files, non-root-last folder', async () => {
      const FOLDERS = await _createFolderStructure();
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.document));
      const TITLE1 = `${TITLE}1`;
      const TITLE2 = `${TITLE}2`;
      FORM.append('renames[]', TITLE1);
      FORM.append('renames[]', TITLE2);
      FORM.append('tags[]', '');
      FORM.append('tags[]', '');
      let response = await FRISBY.post(`${BASE_URL}/entities/upload?parent=${FOLDERS[2].uuid}&usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      const FILENAME_1 = PATH.basename(TITLE1).replace(/[^\w\d\.]/ig, '-');
      const FILENAME_2 = PATH.basename(TITLE2).replace(/[^\w\d\.]/ig, '-');
      const FILESIZE_1 = FS.statSync(SAMPLES.good.image)?.size;
      const FILESIZE_2 = FS.statSync(SAMPLES.good.document)?.size;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(2);
      EXPECT(data[0].name).to.equal(FILENAME_1);
      EXPECT(data[0].parent).to.equal(FOLDERS[2].uuid);
      EXPECT(data[0].local_path).to.equal(`${FOLDERS[2].local_path}/${FOLDERS[2].name}`);
      EXPECT(data[0].storage_path).to.equal(`${data[0].uuid}/o/${FILENAME_1}`);
      EXPECT(data[0].bytes).to.equal(FILESIZE_1);
      EXPECT(data[0].type).to.equal('stack:empty');
      EXPECT(data[0].priority).to.equal(1);
      EXPECT(data[0].status).to.equal('active');
      EXPECT(data[0].content_type).to.equal('image/jpeg');
      EXPECT(data[0].usage).to.equal('dam');
      EXPECT(data[0].stack_status).to.equal('empty');
      EXPECT(data[0].width).to.not.be.undefined;
      EXPECT(data[0].height).to.not.be.undefined;
      EXPECT(data[0].bytes).to.not.be.undefined;

      EXPECT(data[1].name).to.equal(FILENAME_2);
      EXPECT(data[1].parent).to.equal(FOLDERS[2].uuid);
      EXPECT(data[1].local_path).to.equal(`${FOLDERS[2].local_path}/${FOLDERS[2].name}`);
      EXPECT(data[1].storage_path).to.equal(`${data[1].uuid}/o/${FILENAME_2}`);
      EXPECT(data[1].bytes).to.equal(FILESIZE_2);
      EXPECT(data[1].type).to.equal('file');
      EXPECT(data[1].priority).to.equal(1);
      EXPECT(data[1].status).to.equal('active');

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [FOLDERS[0].uuid, FOLDERS[1].uuid, FOLDERS[2].uuid]
        }
      }, [['created_at', 'ASC']])}&limit=3&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const foldersData = response.json.data;

      EXPECT(foldersData[0].bytes).to.equal(FILESIZE_1 + FILESIZE_2);
      EXPECT(foldersData[1].bytes).to.equal(FILESIZE_1 + FILESIZE_2);
      EXPECT(foldersData[2].bytes).to.equal(FILESIZE_1 + FILESIZE_2);

      await _deleteExtraSamples([
        data[0].uuid,
        data[1].uuid,
        FOLDERS[0].uuid,
        FOLDERS[1].uuid,
        FOLDERS[2].uuid
      ]);
    });

    it('Should return "200 OK" success response, upload two valid files, non-root-intermediary folder', async () => {
      const FOLDERS = await _createFolderStructure();

      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.document));
      const TITLE1 = `${TITLE}1`;
      const TITLE2 = `${TITLE}2`;
      FORM.append('renames[]', TITLE1);
      FORM.append('renames[]', TITLE2);
      FORM.append('tags[]', '');
      FORM.append('tags[]', '');
      let response = await FRISBY.post(`${BASE_URL}/entities/upload?parent=${FOLDERS[1].uuid}&usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;

      const FILENAME_1 = PATH.basename(TITLE1).replace(/[^\w\d\.]/ig, '-');
      const FILENAME_2 = PATH.basename(TITLE2).replace(/[^\w\d\.]/ig, '-');
      const FILESIZE_1 = FS.statSync(SAMPLES.good.image)?.size;
      const FILESIZE_2 = FS.statSync(SAMPLES.good.document)?.size;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(2);
      EXPECT(data[0].name).to.equal(FILENAME_1);
      EXPECT(data[0].parent).to.equal(FOLDERS[1].uuid);
      EXPECT(data[0].local_path).to.equal(`${FOLDERS[1].local_path}/${FOLDERS[1].name}`);
      EXPECT(data[0].storage_path).to.equal(`${data[0].uuid}/o/${FILENAME_1}`);
      EXPECT(data[0].bytes).to.equal(FILESIZE_1);
      EXPECT(data[0].type).to.equal('stack:empty');
      EXPECT(data[0].priority).to.equal(1);
      EXPECT(data[0].status).to.equal('active');
      EXPECT(data[0].content_type).to.equal('image/jpeg');
      EXPECT(data[0].usage).to.equal('dam');
      EXPECT(data[0].stack_status).to.equal('empty');
      EXPECT(data[0].width).to.not.be.undefined;
      EXPECT(data[0].height).to.not.be.undefined;
      EXPECT(data[0].bytes).to.not.be.undefined;

      EXPECT(data[1].name).to.equal(FILENAME_2);
      EXPECT(data[1].parent).to.equal(FOLDERS[1].uuid);
      EXPECT(data[1].local_path).to.equal(`${FOLDERS[1].local_path}/${FOLDERS[1].name}`);
      EXPECT(data[1].storage_path).to.equal(`${data[1].uuid}/o/${FILENAME_2}`);
      EXPECT(data[1].bytes).to.equal(FILESIZE_2);
      EXPECT(data[1].type).to.equal('file');
      EXPECT(data[1].priority).to.equal(1);
      EXPECT(data[1].status).to.equal('active');

      response = await FRISBY.get(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $in: [FOLDERS[0].uuid, FOLDERS[1].uuid, FOLDERS[2].uuid]
        }
      }, [['created_at', 'ASC']])}&limit=3&offset=0`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const foldersData = response.json.data;

      EXPECT(foldersData[0].bytes).to.equal(FILESIZE_1 + FILESIZE_2);
      EXPECT(foldersData[1].bytes).to.equal(FILESIZE_1 + FILESIZE_2);
      EXPECT(foldersData[2].bytes).to.equal(0);

      await _deleteExtraSamples([
        data[0].uuid,
        data[1].uuid,
        FOLDERS[0].uuid,
        FOLDERS[1].uuid,
        FOLDERS[2].uuid
      ]);
    });

    it('Should return "207 Multi-Status" success response, upload one valid file, one invalid mimetype file, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.mimetype.document));
      const TITLE1 = `${TITLE}1`;
      const TITLE2 = `${TITLE}2`;
      FORM.append('renames[]', TITLE1);
      FORM.append('renames[]', TITLE2);
      FORM.append('tags[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 207)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;
      const { messages } = response.json;

      const FILENAME = PATH.basename(TITLE1).replace(/[^\w\d\.]/ig, '-');
      const FILESIZE = FS.statSync(SAMPLES.good.image)?.size;

      EXPECT(messages).to.not.be.empty;
      EXPECT(meta.count).to.equal(1);
      EXPECT(data[0].name).to.equal(FILENAME);
      EXPECT(data[0].parent).to.equal(null);
      EXPECT(data[0].local_path).to.equal('');
      EXPECT(data[0].storage_path).to.equal(`${data[0].uuid}/o/${FILENAME}`);
      EXPECT(data[0].bytes).to.equal(FILESIZE);
      EXPECT(data[0].type).to.equal('stack:empty');
      EXPECT(data[0].priority).to.equal(1);
      EXPECT(data[0].status).to.equal('active');
      EXPECT(data[0].content_type).to.equal('image/jpeg');
      EXPECT(data[0].usage).to.equal('dam');
      EXPECT(data[0].stack_status).to.equal('empty');
      EXPECT(data[0].width).to.not.be.undefined;
      EXPECT(data[0].height).to.not.be.undefined;
      EXPECT(data[0].bytes).to.not.be.undefined;
      EXPECT(data[1]).to.be.undefined;

      _expectErrorWithCode(response, 456, 108, true);

      await _deleteExtraSamples([
        data[0].uuid
      ]);
    });

    it('Should return "207 Multi-Status" success response, upload one valid file, one invalid dimensions file, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.dimensions.image));
      FORM.append('renames[]', '');
      FORM.append('renames[]', '');
      FORM.append('tags[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 207)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data } = response.json;
      const { meta } = response.json;
      const { messages } = response.json;

      const FILENAME = PATH.basename(SAMPLES.good.image).replace(/[^\w\d\.]+/ig, '-');
      const FILESIZE = FS.statSync(SAMPLES.good.image)?.size;

      EXPECT(messages).to.not.be.empty;
      EXPECT(meta.count).to.equal(1);
      EXPECT(data[0].name).to.equal(FILENAME);
      EXPECT(data[0].parent).to.equal(null);
      EXPECT(data[0].local_path).to.equal('');
      EXPECT(data[0].storage_path).to.equal(`${data[0].uuid}/o/${FILENAME}`);
      EXPECT(data[0].bytes).to.equal(FILESIZE);
      EXPECT(data[0].type).to.equal('stack:empty');
      EXPECT(data[0].priority).to.equal(1);
      EXPECT(data[0].status).to.equal('active');
      EXPECT(data[0].content_type).to.equal('image/jpeg');
      EXPECT(data[0].usage).to.equal('dam');
      EXPECT(data[0].stack_status).to.equal('empty');
      EXPECT(data[0].width).to.not.be.undefined;
      EXPECT(data[0].height).to.not.be.undefined;
      EXPECT(data[0].bytes).to.not.be.undefined;
      EXPECT(data[1]).to.be.undefined;

      _expectErrorWithCode(response, 328, 105, true);

      await _deleteExtraSamples([
        data[0].uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, upload one invalid file, bad naming, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.naming.image));
      FORM.append('renames[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, upload one valid file, bad rename, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', 'abc  ');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "200 OK" success response, upload one valid file, bad name but good rename, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.naming.image));
      FORM.append('renames[]', 'Good-name');
      FORM.append('tags[]', '');

      // We can also specify the root folder as the null string for parent query param
      let response = await FRISBY.post(`${BASE_URL}/entities/upload?parent=null&usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data, meta } = response.json;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);
      EXPECT(data[0].name).to.equal('Good-name');

      await _deleteExtraSamples([
        data[0].uuid
      ]);
    });

    it('Should return "400 Bad Request" error response, pass plain form field instead of file', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', 'plan form field');
      FORM.append('renames[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, upload file instead of plain form field', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('tags[]', FS.createReadStream(SAMPLES.good.image));
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, upload one invalid file, wrong size, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.size.image));
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR_LIST);

      _expectErrorWithCode(response, 528, 108, true);
    });

    it('Should return "400 Bad Request" error response, upload one invalid file, wrong mimetype, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.mimetype.image));
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR_LIST);

      EXPECT(response.json.meta).to.be.undefined;
      EXPECT([null, undefined]).to.include(response.json.data);
      _expectErrorWithCode(response, 456, 108, true);
    });

    it('Should return "400 Bad Request" error response, upload two files with same name, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.mimetype.image));
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.mimetype.image));
      FORM.append('renames[]', TITLE);
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR_LIST);
      const { data } = response.json;
      const { meta } = response.json;
      const { messages } = response.json;

      EXPECT(messages).to.not.be.empty;
      EXPECT(meta).to.be.undefined;
      EXPECT([null, undefined]).to.include(data);
      EXPECT(messages).to.have.length(2);
      EXPECT(messages[0].code).to.equal('003.105.648');
      EXPECT(messages[1].code).to.equal('003.105.648');
    });

    it('Should return "400 Bad Request" error response, upload two invalid files, wrong mimetype, root folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.mimetype.image));
      FORM.append('files[]', FS.createReadStream(SAMPLES.bad.mimetype.document));
      FORM.append('renames[]', TITLE);
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR_LIST);
      const { data } = response.json;
      const { meta } = response.json;
      const { messages } = response.json;

      EXPECT(messages).to.not.be.empty;
      EXPECT(meta).to.be.undefined;
      EXPECT([null, undefined]).to.include(data);
      EXPECT(messages).to.have.length(2);
      EXPECT(messages[0].code).to.equal('003.108.456');
      EXPECT(messages[1].code).to.equal('003.108.456');
    });

    it('Should return "400 Bad Request" error response, upload one valid file, invalid parent [uuid]', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?parent=wrong&usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, upload one valid file, missing rename', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 520, 106);
    });

    it('Should return "400 Bad Request" error response, upload one valid file, parent is not a folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);

      const parentUuid = response.json.data[0].uuid;
      const FORM2 = FRISBY.formData();
      FORM2.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM2.append('renames[]', 'something');
      FORM2.append('tags[]', '');
      const response2 = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam&parent=${parentUuid}`, {
        headers: { 'Content-Type': FORM2.getHeaders()['content-type'] },
        body: FORM2
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response2, 304, 105);

      await _deleteExtraSamples([
        parentUuid
      ]);
    });

    it('Should return "400 Bad Request" error response, upload one valid file, missing tags', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 416, 106);
    });

    it('Should return "400 Bad Request" error response, upload one valid file, duplicate entry in the same folder', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');

      let response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
      const { data, meta } = response.json;

      const FILENAME = PATH.basename(TITLE).replace(/[^\w\d\.]/ig, '-');
      const FILESIZE = FS.statSync(SAMPLES.good.image)?.size;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);
      EXPECT(data[0].name).to.equal(FILENAME);
      EXPECT(data[0].bytes).to.equal(FILESIZE);

      const FORM2 = FRISBY.formData();
      FORM2.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM2.append('renames[]', TITLE);
      FORM2.append('tags[]', '');

      response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM2.getHeaders()['content-type'] },
        body: FORM2
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR_LIST);

      const response2 = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: data[0].uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);

      EXPECT(response2.json.messages, 'delete messages').to.be.undefined;
      EXPECT(response2.json.meta.count, 'delete count').to.equal(1);

      _expectErrorWithCode(response, 128, 105, true);
    });

    it('Should return "400 Bad Request" error response, upload one valid file, invalid form field values', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', ')*&">|?####');
      FORM.append('tags[]', '[]%%$#2');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 902, 4);
    });

    it('Should return "400 Bad Request" error response, upload one valid file but with extra invalid field name', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', '');
      FORM.append('tags[]', '');
      FORM.append('__proto__', 'test');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 472, 5);
    });

    it('Should return "200 OK" success response, upload one valid file but with extra invalid field name, and repeat it with valid fields', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', '');
      FORM.append('tags[]', '');
      FORM.append('__proto__', 'test');
      let response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 472, 5);

      const FORM2 = FRISBY.formData();
      FORM2.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM2.append('renames[]', TITLE);
      FORM2.append('tags[]', '');
      response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM2.getHeaders()['content-type'] },
        body: FORM2
      })
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_LIST);

      const { data, meta } = response.json;
      const FILESIZE = FS.statSync(SAMPLES.good.image)?.size;

      EXPECT(response.json.messages).to.be.undefined;
      EXPECT(meta.count).to.equal(1);
      EXPECT(data[0].bytes).to.equal(FILESIZE);

      response = await FRISBY.delete(`${BASE_URL}/entities?${serializeToQuerystring({
        uuid: {
          $eq: data[0].uuid
        }
      })}`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);

      EXPECT(response.json.messages, 'delete messages').to.be.undefined;
      EXPECT(response.json.meta.count, 'delete count').to.equal(1);
    });

    it('Should return "400 Bad Request" error response, upload too many files', async () => {
      const FORM = FRISBY.formData();
      for (let step = 1; step <= 21; step += 1) {
        FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      }
      FORM.append('renames[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 280, 5);
    });

    it('Should return "400 Bad Request" error response, upload no files', async () => {
      const FORM = FRISBY.formData();
      FORM.append('renames[]', '');
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 344, 106);
    });

    it('Should return "400 Bad Request" error response, upload one valid file, too many non-file fields', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      for (let step = 1; step <= 21; step += 1) {
        FORM.append('renames[]', '');
        FORM.append('tags[]', '');
      }
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 784, 5);
    });

    it('Should return "400 Bad Request" error response, upload one valid file, body payload is not multipart form data', async () => {
      const data = {
        'files[]': 'text',
        'renames[]': '',
        'tags[]': ''
      };

      const response = await FRISBY.post(`${BASE_URL}/entities/upload?usage=dam`, data, { json: true })
        .expect('status', 400)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 760, 106);
    });

    it('Should return "404 Not Found" error response, upload one valid file, valid parent [uuid], no record in database', async () => {
      const FORM = FRISBY.formData();
      FORM.append('files[]', FS.createReadStream(SAMPLES.good.image));
      FORM.append('renames[]', TITLE);
      FORM.append('tags[]', '');
      const response = await FRISBY.post(`${BASE_URL}/entities/upload?parent=${NON_EXISTENT_UUID}&usage=dam`, {
        headers: { 'Content-Type': FORM.getHeaders()['content-type'] },
        body: FORM
      })
        .expect('status', 404)
        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

      _expectErrorWithCode(response, 936, 105);
    });
  });
});
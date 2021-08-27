/* eslint-disable no-unused-expressions */
import CHAI from 'chai';
import frisby from 'frisby';
import path from 'path';
import fs from 'fs';
import { StorageBucket } from 'fastify-global-plugins/services/storage.js';
import { ssim } from 'ssim.js';
import { promisify } from 'util';
import sizeOfImage from 'image-size';
import serializeToQuerystring from 'fastify-global-plugins/test/helpers/query.js';
import formAutoContent from 'form-auto-content';

const ASSERT = CHAI.assert;
const EXPECT = CHAI.expect;
const BASE_URL = `http://localhost:${process.env.PORT}/api/v1`;
const ENABLE_ALL_TESTS = true;

const readFile = promisify(fs.readFile);

/**
 * Make range iterator
 *
 * @param {number} start - start of range
 * @param {number} end - end of range
 * @param {number} step - step size
 * @returns {iterator}
 */
function* makeRangeIterator(start = 0, end = 100, step = 1) {
  for (let iteration = start; iteration <= end; iteration += step) {
    yield iteration;
  }
}

/**
 * Promisify timeout
 *
 * @param {number} ms time in ms
 * @returns {Promise<null>}
 */
const waitAsync = ms => new Promise(resolve => {
  setTimeout(resolve, ms);
});

/**
 * Poll for a db change
 *
 * @param {Function} fn function returning a promise
 * @param {Function} condition function which will run a condition on the result of fn()
 * @param {number} pollIntervalMs poll interval in milliseconds
 * @param {Promise} stopHandler promise which resolves when we want to cancel the polling
 * @return {Promise}
 */
async function pollAsync(fn, condition, pollIntervalMs) {
  // eslint-disable-next-line no-async-promise-executor
  // start promise resulting from running fn()
  // since we don't await here, we will go straight to the next line
  const getEntityPromise = fn();

  // These next two lines do the following thing:
  // It will await {pollInterval} ms, and then, if getEntityPromise is not finished,
  // it will wait for the remaining time, until getEntityPromise is settled.
  // Thus, the total waiting time is bound between [1, (getEntityPromise settle time)] seconds
  await waitAsync(pollIntervalMs);
  const entity = await getEntityPromise;

  if (condition(entity)) {
    return entity;
  // eslint-disable-next-line no-else-return
  }

  return pollAsync(fn, condition, pollIntervalMs);
}

/**
 * Get appConfig from DB
 *
 * @param {object|null} makeInjector - fastify instance client to use to make injected requests
 * @return {object} resizeOptions objects in old format
 */
const getConfig = async makeInjector => {
  let response;
  const validUsage = 'cms';

  if (makeInjector) {
    response = (await makeInjector().get(`${BASE_URL}/config/${validUsage}`)).json().data;
  } else {
    response = (await frisby.get(`${BASE_URL}/config/${validUsage}`)).json.data;
  }

  const { resource_types: resourceTypes, variant_resolutions: variantResolutions } = response;

  return [variantResolutions, validUsage, resourceTypes[0]];
};

/**
 * Create id for a new config
 *
 * @param {number} length length of the id for the new config
 * @param {string} forbiddenValue restrictied id value
 * @returns {string} resulted id
 */
function makeConfigId(length, forbiddenValue = '') {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  const charactersLength = characters.length;
  do {
    result = '';
    for (let i = 0; i < length; i += 1) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
  } while (forbiddenValue === result);

  return result;
}

/**
 * Generate sample data for config
 *
 * @param {object} [extra = {}] - extra properties to add to sample data
 * @returns {object} object containing the full config
 *
 */
const generateConfigSampleData = (extra = {}) => ({
  id: makeConfigId(3, 'dam'),
  min_rez_vertical: Math.floor(Math.random() * 10 + 1),
  min_rez_horizontal: Math.floor(Math.random() * 10 + 1),
  max_rez_vertical: Math.floor(Math.random() * 2000 + 1),
  max_rez_horizontal: Math.floor(Math.random() * 2000 + 1),
  variant_resolutions: {
    desktop: {
      v1: {
        width: Math.floor(Math.random() * 2000 + 1),
        height: Math.floor(Math.random() * 2000 + 1)
      }
    }
  },
  global_background: {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
    alpha: Math.random()
  },
  resource_types: [`type${Math.floor(Math.random() * 10000)}`],
  ...extra
});

/**
 * Delete configs by id
 *
 * @param {string[]} ids array of IDs of configs we want to delete
 * @returns {object} response.data object from the request
 */
const deleteConfigs = async (ids = []) => {
  if (ids.length === 0) return false;

  const results = await frisby.delete(`${BASE_URL}/config/?${serializeToQuerystring({
    id: {
      $in: ids
    }
  })}`)
    .expect('status', 200);
  EXPECT(results.json.messages).to.be.undefined;
  return results.json.data;
};

/**
 * Create folder in which we can upload the photos
 *
 * @param {object|null} makeInjector - fastify instance client to use to make injected requests
 * @returns {Promise}
 */
const createFolder = async makeInjector => {
  const payload = {
    name: Math.random().toString(36).substring(7)
  };

  let response;
  if (makeInjector) {
    response = await makeInjector()
      .post(`${BASE_URL}/entities`)
      .payload(payload)
      .end();

    return response.json().data;
  }

  response = await frisby.post(`${BASE_URL}/entities`, payload);
  return response.json.data;
};

/**
 * create stack by uploading an image
 *
 * @param {string} folderEntityUuid parent folder uuid
 * @param {string} usage dam/pim/cms
 * @param {Object} resourceInfo resource type for selected usage
 * @param {object|null} makeInjector - fastify instance client to use to make injected requests
 * @return {Object}
 */
const createStackEntity = async (folderEntityUuid, usage, resourceInfo, makeInjector) => {
  let response;
  let resourceType;
  let resourceId;
  let resourceName;

  const name = Math.random().toString(36).substring(7);
  const imagePath = path.resolve('./test/samples/good-image-1.jpg');
  if (resourceInfo) {
    ({ resourceType, resourceId, resourceName } = resourceInfo);
  }
  const readStream = fs.createReadStream(imagePath);
  const url = `${BASE_URL}/entities/upload?parent=${folderEntityUuid}`
  + `&usage=${usage}${usage !== 'dam'
    ? `&resource_type=${resourceType}&resource_id=${resourceId}&resource_name=${resourceName}`
    : ''}`;

  if (makeInjector) {
    const { payload, headers } = formAutoContent({
      'renames[]': name,
      'tags[]': '',
      'files[]': readStream
    });

    const results = await makeInjector()
      .post(url)
      .headers(headers)
      .payload(payload)
      .end();

    response = results.json().data;
  } else {
    const form = frisby.formData();
    form.append('files[]', readStream);
    form.append('tags[]', '');
    form.append('renames[]', name);

    const results = await frisby.post(url, {
      headers: { 'Content-Type': form.getHeaders()['content-type'] },
      body: form
    });
    response = results.json.data;
  }

  return response;
};

/**
 * Check stop condition for polling stack generation ending
 *
 * @param {object} entity - instance to check
 * @returns {boolean} true if it needs to stop
 */
const stackGenerationFinishedCondition = entity => {
  if (!entity) return true;

  const generationIsSuccessfullyFinished = (entity.stack_status !== 'pending')
    && (entity.type === 'stack');

  const generationIsFinishedWithError = entity.stack_status.startsWith('error');

  return generationIsSuccessfullyFinished || generationIsFinishedWithError;
};

/**
 * Generate stack
 *
 * @param {string} rootStackUuid - UUID of the root stack to generate the asset variation for
 * @param {string} usage - usage
 * @param {string} resourceName - resource name
 * @param {string} resourceType - resource type
 * @param {string} resourceId - resource id
 * @param {object|null} makeInjector - fastify instance client to use to make injected requests
 * @returns {void}
 */
const createAssetVariation = async (
  rootStackUuid, usage, resourceName, resourceType, resourceId, makeInjector
) => {
  const body = {
    uuids: [rootStackUuid],
    usage,
    resource_type: resourceType,
    resource_id: resourceId || Math.random().toString(36).substring(7),
    resource_name: resourceName || Math.random().toString(36).substring(7)
  };

  let response;
  if (makeInjector) {
    response = await makeInjector()
      .post(`${BASE_URL}/entities/stack`)
      .payload(body)
      .end();

    try {
      const rootEntity = await pollAsync(async () => {
        const resp = await makeInjector().get(`${BASE_URL}/entities/${rootStackUuid}`);
        return resp.json().data;
      }, stackGenerationFinishedCondition, 500);
      return rootEntity;
    } catch (err) {
      console.error('Polling error:', err);
      return null;
    }
  }

  response = await frisby.post(`${BASE_URL}/entities/stack`, body, { json: true })
    .expect('status', 200);

  EXPECT(response.json.data[0].stack_status).to.equal('pending');

  const rootEntity = await pollAsync(async () => {
    const resp = await frisby.get(`${BASE_URL}/entities/${rootStackUuid}`);
    return resp.json.data;
  }, stackGenerationFinishedCondition, 1000);

  return rootEntity;
};

/**
 * Delete all entities created by the stack creation
 * @param {Array<string>} uuids array containing uuids we want to delete
 * @returns {Promise}
 */
const deleteTestEntities = async uuids => {
  if (!uuids.length) return;

  await frisby.delete(`${BASE_URL}/entities?${serializeToQuerystring({
    uuid: {
      $in: uuids
    }
  })}`);
};

/**
 *
 * @param {*} response -
 * @param {*} errorCode -
 * @param {*} classCode -
 * @param {*} partialResponse -
 * @returns {*}
 */
const expectErrorWithCode = (response, errorCode, classCode = '000', partialResponse = false) => {
  const data = response?.json?.data;
  const meta = response?.json?.meta;
  const messages = response?.json?.messages;

  EXPECT(messages).to.not.be.empty;
  if (!partialResponse) {
    EXPECT(meta).to.be.undefined;
    EXPECT([null, undefined]).to.include(data);
  }
  EXPECT(messages).to.have.length(1);
  EXPECT(messages[0].code).to.equal(`003.${classCode}.${errorCode}`);
};

/**
 * @param {Buffer} pathToImg1 - the path of the image used for replace
 * @param {Buffer} storagePathImg2 - the storage path of the image we want to compare
 * @returns {Number} - score on how similar the two images are
 * The closer SSIM is to 1 the higher the similarity.
 */
const compareImages = async (pathToImg1, storagePathImg2) => {
  const img1Buffer = await readFile(pathToImg1);

  const cloudStorage = new StorageBucket(process.env.BUCKET_NAME);
  const gcpFile = cloudStorage.bucket.file(storagePathImg2);
  const [img2Buffer] = await gcpFile.download();

  // Compute image dimensions needed for comparison
  const { width: width1, height: height1 } = sizeOfImage(img1Buffer);
  const { width: width2, height: height2 } = sizeOfImage(img2Buffer);
  try {
    const { mssim } = ssim(
      { data: img1Buffer, width: width1, height: height1 },
      { data: img2Buffer, width: width2, height: height2 }
    );
    return mssim;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Error trying to compare images', error);
  }
};

/**
 * @param {Array<string>} uuids - stacks to delete (given their root UUIDs)
 * @param {object|null} makeInjector - fastify instance client to use to make injected requests
 * @returns {void}
 */
const deleteStacks = async (uuids = [], makeInjector) => {
  if (uuids.length === 0) return false;

  const query = serializeToQuerystring({
    $or: [
      {
        uuid: {
          $in: uuids
        }
      },
      {
        root_uuid: {
          $in: uuids
        }
      }
    ]
  });

  let makeCheckFn;
  if (makeInjector) {
    makeCheckFn = uuid => async () => {
      const resp = await makeInjector().get(`${BASE_URL}/entities/${uuid}`);
      return resp.json().data;
    };
  } else {
    makeCheckFn = uuid => async () => {
      const response = await frisby.get(`${BASE_URL}/entities/${uuid}`);
      return response.json.data;
    };
  }

  // Build array for poll checking stack_status with Promise.all
  const uuidsArrForStackReadinessCheck = [];
  uuids.forEach(uuid => {
    uuidsArrForStackReadinessCheck.push(
      pollAsync(makeCheckFn(uuid), entity => entity.stack_status !== 'pending', 1000)
    );
  });

  // Await stack_status verification for all uuids
  await Promise.all(uuidsArrForStackReadinessCheck);

  if (makeInjector) {
    await makeInjector().delete(`${BASE_URL}/entities/?${query}`);
  } else {
    await frisby.delete(`${BASE_URL}/entities/?${query}`);
  }
};

/**
 * Get mean of list of numbers
 *
 * @param {number[]} numbers - list of numbers
 * @returns {number}
 */
const average = numbers => numbers.reduce((a, b) => a + b, 0) / numbers.length;

/**
 * Get standard deviation for a list of numbers
 *
 * @param {number[]} numbers - list of numbers
 * @returns {number}
 */
const stdDev = numbers => {
  const mean = average(numbers);
  return Math.sqrt(
    numbers.reduce((acc, num) => acc + (num - mean) ** 2, 0) / (numbers.length - 1)
  );
};

export default {
  assert: ASSERT,
  EXPECT,
  BASE_URL,
  ENABLE_ALL_TESTS,
  frisby,
  pollAsync,
  waitAsync,
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
  makeRangeIterator,
  stackGenerationFinishedCondition,
  average,
  stdDev
};
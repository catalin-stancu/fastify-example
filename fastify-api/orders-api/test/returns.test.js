/* eslint-disable no-await-in-loop */
/* eslint-disable camelcase */
/* eslint-disable no-param-reassign */
/* eslint-disable require-jsdoc */
// eslint-disable-next-line no-underscore-dangle
/* eslint-disable no-loop-func */
/* eslint-disable max-len */
/* eslint-disable no-underscore-dangle */
/* eslint-disable id-length */

import serializeToQuerystring from 'fastify-global-plugins/test/helpers/query.js';
import testHelper from './helpers/index.js';
import testSchemaHelper from './helpers/schemas.js';
import testOrderFunctions from './helpers/orders.js';
import testReturnFunctions from './helpers/returns.js';

const {
  EXPECT,
  frisby,
  BASE_URL,
  createFastifyTestInstance,
  closeFastifyTestInstance,
  expectErrorWithCode
} = testHelper;

const {
  INSTANCE_SCHEMA_ERROR_DATA,
  INSTANCE_SCHEMA_ERROR,
  INSTANCE_SCHEMA_LIST_METADATA
} = testSchemaHelper;

const {
  _createOrder,
  _deleteOrders,
  _getRandomIntBetween
} = testOrderFunctions;

const {
  _generateReturnData,
  makeCreateReturn,
  _deleteReturns
} = testReturnFunctions;

const { Joi } = frisby;

const RETURN_ITEM_SCHEMA = Joi.object({
  pid: Joi.string(),
  quantity: Joi.number(),
  reason: Joi.string()
}).options({ presence: 'required' });

const RETURN_ADDRESS_SCHEMA = Joi.object({
  recipient_name: Joi.string(),
  recipient_phone: Joi.string(),
  county: Joi.string(),
  city: Joi.string(),
  street: Joi.string(),
  street_no: Joi.string(),
  address_details: Joi.string(),
  postcode: Joi.string()
}).options({ presence: 'required' });

const INSTANCE_SCHEMA_CREATE_ONE = Joi.object({
  return_suffix: Joi.number().required(),
  increment_id: Joi.string().required(),
  status: Joi.string().required(),
  return_type: Joi.string().required(),
  pickup_method: Joi.string().required(),
  recipient_name: Joi.string().required(),
  customer_iban: Joi.string().required(),
  customer_bank: Joi.string().required(),
  bank_account_beneficiary: Joi.string().required(),
  recipient_phone: Joi.string().required(),
  county: Joi.string(),
  city: Joi.string(),
  street: Joi.string().required(),
  street_no: Joi.string().required(),
  address_details: Joi.string().required(),
  postcode: Joi.string().required(),
  products: Joi.array().items(RETURN_ITEM_SCHEMA),
  created_at: Joi.date()
});

const INSTANCE_SCHEMA_DATA = Joi.object({
  return_suffix: Joi.number(),
  status: Joi.string(),
  return_type: Joi.string(),
  increment_id: Joi.string(),
  pickup_method: Joi.string(),
  customer_name: Joi.string(),
  order_created_at: Joi.date(),
  return_created_at: Joi.date()
}).options({ presence: 'required' });

const INSTANCE_SCHEMA_LIST = Joi.object({
  meta: INSTANCE_SCHEMA_LIST_METADATA,
  messages: Joi.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: Joi.array().items(INSTANCE_SCHEMA_DATA).allow([])
});

function sortReturns({ return_suffix: a }, { return_suffix: b }) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  // a must be equal to b
  return 0;
}

describe('Returns tests', () => {
  const NR_ITEMS_SUBORDER = 5;
  const SUBORDER_ITEMS_NR_ARR = [NR_ITEMS_SUBORDER];

  let app;
  let db;
  let statusesObject;
  let _createReturn;

  before(async () => {
    app = await createFastifyTestInstance();
    db = app.giveMe('override', 'db');

    const { returnUtils } = app.giveMe('override', 'instantiatedServices');

    statusesObject = await returnUtils.getReturnStatusesAsync();
    _createReturn = makeCreateReturn(statusesObject);
  });

  after(closeFastifyTestInstance);

  describe('GET /returns', () => {
    let sampleOrder;
    let sampleOrderItems;
    let orderObject;

    before(async () => {
      ({ order: sampleOrder, items: sampleOrderItems } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR));

      orderObject = {
        order: sampleOrder,
        items: sampleOrderItems
      };
    });

    after(async () => {
      await _deleteOrders(db, [sampleOrder]);
    });

    it('Should return "200 OK" success response, valid [query filter, limit, offset], return all available returns', async () => {
      const { return: sample_1 } = await _createReturn(db, orderObject);
      const { return: sample_2 } = await _createReturn(db, orderObject);

      let response = await app.inject().get(`${BASE_URL}/returns?${serializeToQuerystring({
        increment_id: {
          $eq: sampleOrder.increment_id
        }
      }, [['return_suffix', 'ASC']])}&limit=2&offset=0&total_count=true`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      const samples = [sample_1, sample_2];
      samples.sort(sortReturns);

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(2);
      EXPECT(data[0].return_suffix, 'first element return_suffix').to.equal(samples[0].return_suffix);
      EXPECT(data[1].return_suffix, 'second element return_suffix').to.equal(samples[1].return_suffix);

      await _deleteReturns(db, sampleOrder.increment_id);
    });

    it('Should return "200 OK" success response, total_count not requested, return all available returns', async () => {
      const { return: sample_1 } = await _createReturn(db, orderObject);
      const { return: sample_2 } = await _createReturn(db, orderObject);

      let response = await app.inject().get(`${BASE_URL}/returns?${serializeToQuerystring({
        increment_id: {
          $eq: sampleOrder.increment_id
        }
      }, [['return_suffix', 'ASC']])}&limit=2&offset=0&total_count=false`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      const samples = [sample_1, sample_2];
      samples.sort(sortReturns);

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.be.undefined;
      EXPECT(data[0].return_suffix, 'first element return_suffix').to.equal(samples[0].return_suffix);
      EXPECT(data[1].return_suffix, 'second element return_suffix').to.equal(samples[1].return_suffix);

      await _deleteReturns(db, sampleOrder.increment_id);
    });

    it('Should return "200 OK" success response, valid [query filter, limit, offset], return some available instances, first page', async () => {
      const { return: sample_1 } = await _createReturn(db, orderObject);
      const { return: sample_2 } = await _createReturn(db, orderObject);
      const { return: sample_3 } = await _createReturn(db, orderObject);

      let response = await app.inject().get(`${BASE_URL}/returns?${serializeToQuerystring({
        increment_id: {
          $eq: sampleOrder.increment_id
        }
      }, [['return_suffix', 'ASC']])}&limit=1&offset=0&total_count=true`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      const samples = [sample_1, sample_2, sample_3];
      samples.sort(sortReturns);

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(false);
      EXPECT(meta.total_items).to.be.equal(3);
      EXPECT(data[0].return_suffix, 'first element return_suffix').to.equal(samples[0].return_suffix);
      EXPECT(data[1], 'second element return_suffix').to.be.undefined;

      await _deleteReturns(db, sampleOrder.increment_id);
    });

    it('Should return "200 OK" success response, valid [query filter, limit, offset], return some available instances, last page', async () => {
      const { return: sample_1 } = await _createReturn(db, orderObject);
      const { return: sample_2 } = await _createReturn(db, orderObject);

      let response = await app.inject().get(`${BASE_URL}/returns?${serializeToQuerystring({
        increment_id: {
          $eq: sampleOrder.increment_id
        }
      }, [['return_suffix', 'ASC']])}&limit=1&offset=1&total_count=true`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;
      const samples = [sample_1, sample_2];
      samples.sort(sortReturns);

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.be.equal(2);
      EXPECT(data[0].return_suffix, 'first element return_suffix').to.equal(samples[1].return_suffix);
      EXPECT(data[1], 'second element').to.be.undefined;

      await _deleteReturns(db, sampleOrder.increment_id);
    });

    it('Should return "400 Bad Request" error response, invalid [query filter], valid [limit, offset]', async () => {
      await _createReturn(db, orderObject);

      let response = await app.inject().get(`${BASE_URL}/returns?${serializeToQuerystring({
        increment_id: {
          $eq: sampleOrder.increment_id
        }
      }).replace('eq', 'opBad')}&limit=1&offset=1&total_count=true`);

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 920, 2);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);

      EXPECT(responseValidationError).to.be.null;

      await _deleteReturns(db, sampleOrder.increment_id);
    });

    it('Should return "200 OK" error response, valid [query filter], missing [limit, offset]', async () => {
      const { return: sample_1 } = await _createReturn(db, orderObject);

      let response = await app.inject().get(`${BASE_URL}/returns?${serializeToQuerystring({
        increment_id: {
          $eq: sampleOrder.increment_id
        }
      })}&total_count=true`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.be.equal(1);
      EXPECT(data[0].return_suffix, 'first element return_suffix').to.equal(sample_1.return_suffix);

      await _deleteReturns(db, sampleOrder.increment_id);
    });

    it('Should return "400 Bad Request" error response, valid [query filter], invalid [limit, offset]', async () => {
      await _createReturn(db, orderObject);

      let response = await app.inject().get(`${BASE_URL}/returns?${serializeToQuerystring({
        increment_id: {
          $eq: sampleOrder.increment_id
        }
      })}&limit=wrong&offset=wrong&total_count=true`);

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 902, 4);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;

      await _deleteReturns(db, sampleOrder.increment_id);
    });
  });

  describe('POST /orders/:increment_id/returns', () => {
    let sampleOrder;
    let sampleOrderItems;

    before(async () => {
      ({ order: sampleOrder, items: sampleOrderItems } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR));
    });

    after(async () => {
      await _deleteOrders(db, [sampleOrder]);
    });

    it('Should return "200 OK" response on valid body', async () => {
      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };

      let response = await app.inject().post(`${BASE_URL}/orders/${increment_id}/returns`).payload(payload).end();

      response = response.json();

      const { data } = response;

      const { error: responseValidationError } = INSTANCE_SCHEMA_CREATE_ONE.validate(data);
      EXPECT(responseValidationError).to.be.null;

      EXPECT(response.messages, 'error list').to.be.undefined;

      await _deleteReturns(db, increment_id);
    });

    it('Should return "404 Not found" response on non-existent increment_id', async () => {
      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };

      let response = await app.inject().post(`${BASE_URL}/orders/wrong/returns`).payload(payload).end();

      EXPECT(response.statusCode).to.equal(404);
      expectErrorWithCode(response, 728, 104);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should return "400 Bad request" response if a product specified in the return isn\'t found in the order', async () => {
      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };

      payload.products.push({
        pid: '' + _getRandomIntBetween(1, 999),
        quantity: 1,
        reason: 'hackzz'
      });

      let response = await app.inject().post(`${BASE_URL}/orders/${increment_id}/returns`).payload(payload).end();

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 256, 104);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should return "400 Bad request" respose if the products array has an incorrect format', async () => {
      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };

      payload.products.push({
        pid: payload.products[0],
        quantity: 3,
        reason: 'this product again?? 😲'
      });

      let response = await app.inject().post(`${BASE_URL}/orders/${increment_id}/returns`).payload(payload).end();

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 902, 4);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should return "400 Bad request" response if the product array is empty', async () => {
      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };

      payload.products = [];

      let response = await app.inject().post(`${BASE_URL}/orders/${increment_id}/returns`).payload(payload).end();

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 902, 4);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should return "400 Bad request" response if at least one of the products has a negative quantity', async () => {
      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };

      payload.products[0].quantity = -1;

      let response = await app.inject().post(`${BASE_URL}/orders/${increment_id}/returns`).payload(payload).end();

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 902, 4);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should return "400 Bad request" response if at least one of the products has a null (zero) quantity', async () => {
      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };

      payload.products[0].quantity = 0;

      let response = await app.inject().post(`${BASE_URL}/orders/${increment_id}/returns`).payload(payload).end();

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 902, 4);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should return "400 Bad request" response if a product has a quantity higher than the one in order, on a first return', async () => {
      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };
      payload.products[0].quantity = 999;

      let response = await app.inject().post(`${BASE_URL}/orders/${increment_id}/returns`).payload(payload).end();

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 32, 104);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should return "400 Bad request" response if a product doesn\'t have any quantity left after other returns, on a second return', async () => {
      const { increment_id: increment_id_1, status: status_1, return_suffix: return_suffix_1, address: address_1, ...restOfReturn_1 } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const { increment_id: increment_id_2, status: status_2, return_suffix: return_suffix_2, address: address_2, ...restOfReturn_2 } = _generateReturnData(sampleOrder.increment_id, sampleOrderItems, statusesObject, true);

      const payload_1 = {
        ...restOfReturn_1,
        ...address_1
      };

      const payload_2 = {
        ...restOfReturn_2,
        ...address_2
      };

      let response = await app.inject().post(`${BASE_URL}/orders/${increment_id_1}/returns`).payload(payload_1).end();

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();

      const { data: data_1 } = response;

      const { error: responseValidationError_1 } = INSTANCE_SCHEMA_CREATE_ONE.validate(data_1);
      EXPECT(responseValidationError_1).to.be.null;

      EXPECT(response.messages, 'error list').to.be.undefined;

      payload_2.products[0].quantity = 999;

      response = await app.inject().post(`${BASE_URL}/orders/${increment_id_2}/returns`).payload(payload_2).end();

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 32, 104);

      response = response.json();

      const { error: responseValidationError_2 } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError_2).to.be.null;

      await _deleteReturns(db, increment_id_1);
    });
  });
});
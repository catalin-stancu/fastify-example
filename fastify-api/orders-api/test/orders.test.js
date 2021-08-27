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
import { OrderHelper } from '../helpers/orderHelper.js';
import testHelper from './helpers/index.js';
import testSchemaHelper from './helpers/schemas.js';
import testOrderFunctions from './helpers/orders.js';
import testReturnFunctions from './helpers/returns.js';
import checkoutOrderPlaced from './checkout-order-placed-oms-payload.js';

const THROW_ERROR_DUPLICATE_ORDER = 'Order with the same number already exists';

const { data: checkoutPayload } = checkoutOrderPlaced;

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
  _getRandomIntBetween,
  _createOrder,
  _deleteOrders,
  _getRandomLetters
} = testOrderFunctions;

const {
  _generateReturnData,
  _deleteReturns
} = testReturnFunctions;

const { Joi } = frisby;

const ORDER_ITEM_SCHEMA = Joi.object({
  pid: Joi.string(),
  quantity: Joi.number(),
  base_price: Joi.string(),
  price: Joi.string(),
  discount: Joi.string(),
  total: Joi.string(),
  product_parent_id: Joi.number().allow(null),
  vendor: Joi.number(),
  name: Joi.string(),
  image: Joi.string(),
  url_key: Joi.string()
}).options({ presence: 'required' });

const ORDER_ADDRESS_SCHEMA = Joi.object({
  recipient_name: Joi.string().required(),
  recipient_phone: Joi.string().required(),
  county: Joi.string().required(),
  city: Joi.string().required(),
  street: Joi.string().required(),
  street_no: Joi.string().required(),
  address_details: Joi.string().required(),
  postcode: Joi.string().required(),
  company_bank: Joi.string().allow(null, ''),
  company_name: Joi.string().allow(null, ''),
  company_fiscal_code: Joi.string().allow(null, ''),
  company_iban: Joi.string().allow(null, ''),
  company_reg_no: Joi.string().allow(null, '')
});

const ORDER_ADDRESS_OBJECT_SCHEMA = Joi.object({
  shipping: ORDER_ADDRESS_SCHEMA,
  billing: ORDER_ADDRESS_SCHEMA
});

const INSTANCE_SCHEMA_DATA_SINGLE = Joi.object({
  increment_id: Joi.string().regex(new RegExp('^EXP\\d{10}$')),
  total: Joi.string(),
  discount: Joi.string(),
  status: Joi.string().valid('New'),
  registered_at: Joi.date(),
  items: Joi.array().items(ORDER_ITEM_SCHEMA),
  address: ORDER_ADDRESS_OBJECT_SCHEMA,
  created_at: Joi.date(),
  modified_at: Joi.date()
}).options({ presence: 'required' });

const INSTANCE_SCHEMA_DATA = Joi.object({
  increment_id: Joi.string().regex(new RegExp('^EXP\\d{10}$')),
  total: Joi.string(),
  status: Joi.string().valid('New'),
  registered_at: Joi.date(),
  client_name: Joi.string(),
  created_at: Joi.date(),
  modified_at: Joi.date()
}).options({ presence: 'required' });

const INSTANCE_SCHEMA_SINGLE = Joi.object({
  data: INSTANCE_SCHEMA_DATA_SINGLE
});

const INSTANCE_SCHEMA_LIST = Joi.object({
  meta: INSTANCE_SCHEMA_LIST_METADATA,
  messages: Joi.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
  data: Joi.array().items(INSTANCE_SCHEMA_DATA).allow([])
});

const COM_ORDER_ITEM = Joi.object({
  id: Joi.number(),
  pid: Joi.string(),
  quantity: Joi.number(),
  base_price: Joi.string(),
  price: Joi.string(),
  discount: Joi.string(),
  total: Joi.string(),
  parent_id: Joi.number().allow(null),
  vendor: Joi.number(),
  name: Joi.string(),
  image: Joi.string(),
  url_key: Joi.string()
});

const COM_PAYLOAD_SCHEMA = Joi.object({
  increment_id: Joi.string().regex(new RegExp('^EXP\\d{10}$')),
  total: Joi.string(),
  discount: Joi.string(),
  registered_at: Joi.date(),
  email: Joi.string(),
  items: Joi.array().items(COM_ORDER_ITEM),
  address: ORDER_ADDRESS_OBJECT_SCHEMA
});

/**
 * Function which emulates the orderCreated message handler from OMS module
 *
 * @param {object} db db
 * @param {object} payload Payload `received` from checkout
 * @param {object} helpers functions to help
 * @returns {Promise<object>}
 */
async function mockedCreateOrderHandler(db, payload, helpers) {
  // validate payload
  const {
    orderService,
    orderHelper
  } = helpers;

  const validOrder = orderHelper.formatFieldsForOMS(payload);

  const { increment_id: createdOrderNumber } = await orderService.createOneAsync(validOrder);

  if (!createdOrderNumber) {
    throw new Error(THROW_ERROR_DUPLICATE_ORDER);
  }

  const createdOrderWithDetails = await orderService.findOneAsync(createdOrderNumber);
  const formattedOrder = OrderHelper.formatFieldsForCOM(createdOrderWithDetails);

  return formattedOrder;
}

function sortOrderItems({ pid: a }, { pid: b }) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  // a must be equal to b
  return 0;
}

function sortOrders({ increment_id: a }, { increment_id: b }) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  // a must be equal to b
  return 0;
}

function _checkOrderResponse(messages, actual, { order, items, billing, shipping }, identifier = '') {
  actual.items.sort(sortOrderItems);
  items.sort(sortOrderItems);

  EXPECT(messages, `${identifier} error list`).to.be.undefined;

  EXPECT(actual.increment_id, `${identifier} increment_id`).to.equal(order.increment_id);
  EXPECT(actual.total, `${identifier} total`).to.equal(order.total);
  EXPECT(actual.status, `${identifier} status`).to.equal(order.status);
  EXPECT(actual.discount, `${identifier} discount`).to.equal(order.discount);
  EXPECT(actual.registered_at, `${identifier} registered_at`).to.equal(order.registered_at.toISOString());

  EXPECT(actual.items[0].pid, `${identifier} items[0].pid`).to.equal(items[0].pid);
  EXPECT(actual.items[0].quantity, `${identifier} items[0].quantity`).to.equal(items[0].quantity);
  EXPECT(actual.items[0].base_price, `${identifier} items[0].base_price`).to.equal(items[0].base_price);
  EXPECT(actual.items[0].price, `${identifier} items[0].price`).to.equal(items[0].price);
  EXPECT(actual.items[0].discount, `${identifier} items[0].discount`).to.equal(items[0].discount);
  EXPECT(actual.items[0].total, `${identifier} items[0].total`).to.equal(items[0].total);
  EXPECT(actual.items[0].product_parent_id, `${identifier} items[0].product_parent_id`).to.equal(items[0].product_parent_id);
  EXPECT(actual.items[0].vendor, `${identifier} items[0].vendor`).to.equal(items[0].vendor);
  EXPECT(actual.items[0].name, `${identifier} items[0].name`).to.equal(items[0].name);
  EXPECT(actual.items[0].image, `${identifier} items[0].image`).to.equal(items[0].image);
  EXPECT(actual.items[0].url_key, `${identifier} items[0].url_key`).to.equal(items[0].url_key);

  EXPECT(actual.address.shipping.recipient_name, `${identifier} address.shipping.recipient_name`).to.equal(shipping.recipient_name);
  EXPECT(actual.address.shipping.recipient_phone, `${identifier} address.shipping.recipient_phone`).to.equal(shipping.recipient_phone);
  EXPECT(actual.address.shipping.county, `${identifier} address.shipping.county`).to.equal(shipping.county);
  EXPECT(actual.address.shipping.city, `${identifier} address.shipping.city`).to.equal(shipping.city);
  EXPECT(actual.address.shipping.street, `${identifier} address.shipping.street`).to.equal(shipping.street);
  EXPECT(actual.address.shipping.street_no, `${identifier} address.shipping.street_no`).to.equal(shipping.street_no);
  EXPECT(actual.address.shipping.address_details, `${identifier} address.shipping.address_details`).to.equal(shipping.address_details);
  EXPECT(actual.address.shipping.postcode, `${identifier} address.shipping.postcode`).to.equal(shipping.postcode);

  EXPECT(actual.address.billing.recipient_name, `${identifier} address.billing.recipient_name`).to.equal(billing.recipient_name);
  EXPECT(actual.address.billing.recipient_phone, `${identifier} address.billing.recipient_phone`).to.equal(billing.recipient_phone);
  EXPECT(actual.address.billing.county, `${identifier} address.billing.county`).to.equal(billing.county);
  EXPECT(actual.address.billing.city, `${identifier} address.billing.city`).to.equal(billing.city);
  EXPECT(actual.address.billing.street, `${identifier} address.billing.street`).to.equal(billing.street);
  EXPECT(actual.address.billing.street_no, `${identifier} address.billing.street_no`).to.equal(billing.street_no);
  EXPECT(actual.address.billing.address_details, `${identifier} address.billing.address_details`).to.equal(billing.address_details);
  EXPECT(actual.address.billing.postcode, `${identifier} address.billing.postcode`).to.equal(billing.postcode);
}

describe('Orders tests', () => {
  const NR_ITEMS_SUBORDER = 5;
  const SUBORDER_ITEMS_NR_ARR = [NR_ITEMS_SUBORDER];
  let app;
  let db;
  let statusesObject;

  before(async () => {
    app = await createFastifyTestInstance();
    db = app.giveMe('override', 'db');

    const { returnUtils } = app.giveMe('override', 'instantiatedServices');

    statusesObject = await returnUtils.getReturnStatusesAsync();
  });

  after(closeFastifyTestInstance);

  describe('GET /orders', () => {
    it('Should return "200 OK" success response, valid [query filter, limit, offset], return all available orders', async () => {
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);
      const { order: sample_2 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders?${serializeToQuerystring({
        increment_id: {
          $in: [sample_1.increment_id, sample_2.increment_id]
        }
      }, [['increment_id', 'ASC']])}&limit=2&offset=0&total_count=true`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      const samples = [sample_1, sample_2];
      samples.sort(sortOrders);

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(2);
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(samples[0].increment_id);
      EXPECT(data[1].increment_id, 'second element increment_id').to.equal(samples[1].increment_id);

      await _deleteOrders(db, [sample_1, sample_2]);
    });

    it('Should return "200 OK" success response, total_count not requested, return all available orders', async () => {
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);
      const { order: sample_2 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders?${serializeToQuerystring({
        increment_id: {
          $in: [sample_1.increment_id, sample_2.increment_id]
        }
      }, [['increment_id', 'ASC']])}&limit=2&offset=0&total_count=false`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      const samples = [sample_1, sample_2];
      samples.sort(sortOrders);

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.be.undefined;
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(samples[0].increment_id);
      EXPECT(data[1].increment_id, 'second element increment_id').to.equal(samples[1].increment_id);

      await _deleteOrders(db, [sample_1, sample_2]);
    });

    it('Should return "200 OK" success response, valid [query filter, limit, offset], return some available instances, first page', async () => {
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);
      const { order: sample_2 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);
      const { order: sample_3 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders?${serializeToQuerystring({
        increment_id: {
          $in: [sample_1.increment_id, sample_2.increment_id, sample_3.increment_id]
        }
      }, [['increment_id', 'ASC']])}&limit=1&offset=0&total_count=true`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      const samples = [sample_1, sample_2, sample_3];
      samples.sort(sortOrders);

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(false);
      EXPECT(meta.total_items).to.be.equal(3);
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(samples[0].increment_id);
      EXPECT(data[1], 'second element increment_id').to.be.undefined;

      await _deleteOrders(db, [sample_1, sample_2, sample_3]);
    });

    it('Should return "200 OK" success response, valid [query filter, limit, offset], return some available instances, last page', async () => {
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);
      const { order: sample_2 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders?${serializeToQuerystring({
        increment_id: {
          $in: [sample_1.increment_id, sample_2.increment_id]
        }
      }, [['increment_id', 'ASC']])}&limit=1&offset=1&total_count=true`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;
      const samples = [sample_1, sample_2];
      samples.sort(sortOrders);

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.be.equal(2);
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(samples[1].increment_id);
      EXPECT(data[1], 'second element').to.be.undefined;

      await _deleteOrders(db, [sample_1, sample_2]);
    });

    it('Should return "200 OK" success response, valid [search_for], returns correct case-insensitive matches, default ordering', async () => {
      const searchForTerm = _getRandomLetters(10).toLowerCase();
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: searchForTerm.toUpperCase() });
      const { order: sample_2 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: `${searchForTerm} Gigelus` });

      let response = await app.inject().get(`${BASE_URL}/orders?&limit=2&offset=0&total_count=true&search_for=${searchForTerm}`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(2);
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(sample_1.increment_id);
      EXPECT(data[1].increment_id, 'second element increment_id').to.equal(sample_2.increment_id);

      await _deleteOrders(db, [sample_1, sample_2]);
    });

    it('Should return "200 OK" success response, valid [search_for], returns correct case-insensitive matches, explicit ordering', async () => {
      const searchForTerm = _getRandomLetters(10).toLowerCase();
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: searchForTerm.toUpperCase() });
      const { order: sample_2 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: `${searchForTerm} Gigelus` });

      let response = await app
        .inject()
        .get(`${BASE_URL}/orders?&limit=2&offset=0&total_count=true&ord[registered_at]=DESC&search_for=${searchForTerm}`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(2);
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(sample_2.increment_id);
      EXPECT(data[1].increment_id, 'second element increment_id').to.equal(sample_1.increment_id);

      await _deleteOrders(db, [sample_1, sample_2]);
    });

    it('Should return "200 OK" success response, valid [search_for], two results on two pages, correct pagination', async () => {
      const searchForTerm = _getRandomLetters(10);
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: searchForTerm.toUpperCase() });
      const { order: sample_2 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: `${searchForTerm.toUpperCase()}A` });

      let response = await app.inject().get(`${BASE_URL}/orders?&limit=1&offset=0&total_count=true&search_for=${searchForTerm}`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      let { data } = response;
      const { meta } = response;

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.total_items).to.equal(2);
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(sample_1.increment_id);

      // Check second page
      response = await app.inject().get(`${BASE_URL}/orders?&limit=1&offset=1&total_count=true&search_for=${searchForTerm}`);
      response = response.json();
      data = response.data;
      EXPECT(data[0].increment_id, 'second element increment_id').to.equal(sample_2.increment_id);

      await _deleteOrders(db, [sample_1, sample_2]);
    });

    it('Should return "200 OK" success response, valid [search_for], treats wildcard % and _ chars as normal chars', async () => {
      const searchForTerm = _getRandomLetters(10);
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: `%${searchForTerm}_` });

      let response = await app.inject().get(`${BASE_URL}/orders?&limit=2&offset=0&total_count=true&search_for=${searchForTerm}`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(1);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(1);
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(sample_1.increment_id);

      await _deleteOrders(db, [sample_1]);
    });

    it('Should return "200 OK" success response, valid [search_for], correct ordering for partial matches only', async () => {
      const searchForTerm = _getRandomLetters(10).toLowerCase();
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: `${searchForTerm}A` });
      const { order: sample_2 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR, { client_name: `${searchForTerm}B` });

      const incrementIdArr = [sample_1.increment_id, sample_2.increment_id].sort();
      let response = await app.inject().get(`${BASE_URL}/orders?&limit=2&offset=0&total_count=true&search_for=${searchForTerm}`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_LIST.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { meta, data } = response;

      EXPECT(response.messages, 'error list').to.be.undefined;
      EXPECT(meta.count, 'find count').to.equal(2);
      EXPECT(meta.end, 'pagination end').to.equal(true);
      EXPECT(meta.total_items).to.equal(2);
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(incrementIdArr[0]);
      EXPECT(data[1].increment_id, 'second element increment_id').to.equal(incrementIdArr[1]);

      await _deleteOrders(db, [sample_1, sample_2]);
    });

    it('Should return "400 Bad Request" error response, invalid [query filter], valid [limit, offset]', async () => {
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders?${serializeToQuerystring({
        increment_id: {
          $eq: sample_1.increment_id
        }
      }).replace('eq', 'opBad')}&limit=1&offset=1&total_count=true`);

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 920, 2);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);

      EXPECT(responseValidationError).to.be.null;

      await _deleteOrders(db, [sample_1]);
    });

    it('Should return "200 OK" error response, valid [query filter], missing [limit, offset]', async () => {
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders?${serializeToQuerystring({
        increment_id: {
          $eq: sample_1.increment_id
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
      EXPECT(data[0].increment_id, 'first element increment_id').to.equal(sample_1.increment_id);

      await _deleteOrders(db, [sample_1]);
    });

    it('Should return "400 Bad Request" error response, valid [query filter], invalid [limit, offset]', async () => {
      const { order: sample_1 } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders?${serializeToQuerystring({
        increment_id: {
          $eq: sample_1.increment_id
        }
      })}&limit=wrong&offset=wrong&total_count=true`);

      EXPECT(response.statusCode).to.equal(400);
      expectErrorWithCode(response, 902, 4);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;

      await _deleteOrders(db, [sample_1]);
    });
  });

  describe('GET /orders/:increment_id', () => {
    it('Should return "200 OK" success response, valid [increment_id]', async () => {
      const { order: sample_1, billing, shipping, items } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders/${sample_1.increment_id}`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_SINGLE.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { messages, data } = response;

      _checkOrderResponse(messages, data, { order: sample_1, shipping, billing, items }, 'order');

      await _deleteOrders(db, [sample_1]);
    });

    it('Should return "200 OK" success response and recompute available quantities', async () => {
      const { order: sample_1, billing, shipping, items } = await _createOrder(db, SUBORDER_ITEMS_NR_ARR);

      let response = await app.inject().get(`${BASE_URL}/orders/${sample_1.increment_id}`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_SINGLE.validate(response);
      EXPECT(responseValidationError).to.be.null;

      const { messages, data } = response;

      _checkOrderResponse(messages, data, { order: sample_1, shipping, billing, items }, 'order');

      const { increment_id, status, return_suffix, address, ...restOfReturn } = _generateReturnData(sample_1.increment_id, items, statusesObject, true);

      const payload = {
        ...restOfReturn,
        ...address
      };

      const initialInventory = {};
      const returnsInventory = {};
      const availableInventory = {};

      items.forEach(({ pid, quantity }) => {
        initialInventory[pid] = quantity;
      });

      payload.products.forEach(({ pid }, index) => {
        payload.products[index].quantity = 1;
        returnsInventory[pid] = payload.products[index].quantity;
      });

      Object.keys(returnsInventory).forEach(pid => {
        availableInventory[pid] = initialInventory[pid] - returnsInventory[pid];
      });

      response = await app.inject().post(`${BASE_URL}/orders/${increment_id}/returns`).payload(payload).end();

      EXPECT(response.statusCode).to.equal(200);

      response = await app.inject().get(`${BASE_URL}/orders/${sample_1.increment_id}?available_quantities=true`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError_2 } = INSTANCE_SCHEMA_SINGLE.validate(response);
      EXPECT(responseValidationError_2).to.be.null;

      const secondQueryInventory = {};

      response.data.items.forEach(({ pid, quantity }) => {
        secondQueryInventory[pid] = quantity;
        EXPECT(availableInventory[pid]).to.equal(secondQueryInventory[pid]);
      });

      await _deleteReturns(db, sample_1.increment_id);
      await _deleteOrders(db, [sample_1]);
    });

    it('Should return "404 Not Found" error response, valid [increment_id], no record in database', async () => {
      const sample_increment_id = 'EXP0123456789';

      // make sure it doesn't exist
      await _deleteOrders(db, [{ increment_id: sample_increment_id }]);

      let response = await app.inject().get(`${BASE_URL}/orders/${sample_increment_id}`);

      EXPECT(response.statusCode).to.equal(404);
      expectErrorWithCode(response, 728, 101);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should return "400 Bad Request" error response, invalid [increment_id]', async () => {
      let response = await app.inject().get(`${BASE_URL}/orders/wrong`);

      EXPECT(response.statusCode).to.equal(404);
      expectErrorWithCode(response, 728, 101);

      response = response.json();

      const { error: responseValidationError } = INSTANCE_SCHEMA_ERROR.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });
  });

  describe('Create order', () => {
    let instantiatedServices;

    before(async () => {
      instantiatedServices = app.giveMe('override', 'instantiatedServices');
      checkoutPayload.increment_id = 'EXP' + _getRandomIntBetween(1, 999999).toString().padStart(10, '0');
    });

    it('Should create an order on valid payload', async () => {
      const expectedOrder = await mockedCreateOrderHandler(db, checkoutPayload, instantiatedServices);

      const { error: expectedOrderValidationError } = COM_PAYLOAD_SCHEMA.validate(expectedOrder);
      EXPECT(expectedOrderValidationError).to.be.null;

      let response = await app.inject().get(`${BASE_URL}/orders/${expectedOrder.increment_id}`);

      EXPECT(response.statusCode).to.equal(200);

      response = response.json();
      const { error: responseValidationError } = INSTANCE_SCHEMA_SINGLE.validate(response);
      EXPECT(responseValidationError).to.be.null;
    });

    it('Should not create an order if order already exists', async () => {
      try {
        await mockedCreateOrderHandler(db, checkoutPayload, instantiatedServices);
      } catch (error) {
        EXPECT(error.name).to.be.equal('Error');
        EXPECT(error.message).to.contain(THROW_ERROR_DUPLICATE_ORDER);
      }
    });
  });
});
/* eslint-disable no-await-in-loop */
/* eslint-disable camelcase */
/* eslint-disable no-param-reassign */
/* eslint-disable require-jsdoc */
// eslint-disable-next-line no-underscore-dangle
/* eslint-disable no-loop-func */
/* eslint-disable max-len */
/* eslint-disable no-underscore-dangle */
/* eslint-disable id-length */

import VALID_IBANS from './valid_ibans.js';

function _getRandomIntBetween(low = 0, high = 10) {
  return Math.floor(Math.random() * (1 + high - low) + low);
}

function _makeGetRandomElementFromList(list) {
  if (!list?.length) {
    throw new Error('list can be only an array or string, and cannot be falsy or undefined');
  }

  return () => {
    const randomIndex = _getRandomIntBetween(0, list.length - 1);
    return list[randomIndex];
  };
}

const VALID_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzĂÎÂȘȚăîâșț';
const _getRandomLetter = _makeGetRandomElementFromList(VALID_LETTERS);

const VALID_BASIC_LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const _getRandomBasicLetter = _makeGetRandomElementFromList(VALID_BASIC_LETTERS);

const _getRandomLetters = (count = 5, basic = false) => {
  const letters = [];
  for (let i = 1; i <= count; i += 1) {
    const newLetter = basic ? _getRandomBasicLetter() : _getRandomLetter();
    letters.push(newLetter);
  }
  return letters.join('');
};

const _getRandomIBAN = _makeGetRandomElementFromList(VALID_IBANS);

const _getCuiCheckDigit = cui => {
  let verificationNumber = 753217532;

  let sum = 0;
  while (cui > 0) {
    sum += (cui % 10) * (verificationNumber % 10);
    cui = Math.floor(cui / 10);
    verificationNumber = Math.floor(verificationNumber / 10);
  }

  let checkDigit = parseInt((sum * 10) % 11, 10);
  if (checkDigit === 10) {
    checkDigit = 0;
  }

  return checkDigit;
};

const _generateAddressData = (extra = {}) => {
  const cuiBase = _getRandomIntBetween(1, 999999999);

  const companyInfo = {
    company_name: `company-name-sample-${new Date().toISOString()}-${Math.random()}`.replace(/[\:]/g, '-'),
    company_fiscal_code: `RO${cuiBase}${_getCuiCheckDigit(cuiBase)}`,
    company_reg_no: `J40/${_getRandomIntBetween(1000, 999999)}/20${_getRandomIntBetween(10, 21)}`,
    company_bank: `bank-name-sample-${new Date().toISOString()}-${Math.random()}`.replace(/[\:]/g, '-'),
    company_iban: _getRandomIBAN()
  };

  const result = {
    address_name: `address-name-sample-${new Date().toISOString()}-${Math.random()}`.replace(/[\:]/g, '-'),
    recipient_name: `recipient-name-sample-${_getRandomLetters(8)}`,
    recipient_phone: `07${_getRandomIntBetween(0, 99999999).toString().padStart(8, '0')}`,
    county: _getRandomLetters(20),
    city: _getRandomLetters(20),
    street: `Str. ${_getRandomLetters(8)}`,
    street_no: _getRandomIntBetween(1, 100000).toString(),
    address_details: `Bl. F, Sc. A, Ap. ${_getRandomIntBetween(1, 99999)}, Et. 1`,
    postcode: _getRandomIntBetween(1, 999999).toString().padStart(6, '0'),
    ...companyInfo,
    ...extra
  };

  return result;
};

const _generateOrderData = (opts, extra = {}) => {
  const {
    shipping_address_id,
    billing_address_id
  } = opts;

  return {
    increment_id: 'EXP' + _getRandomIntBetween(1, 999999).toString().padStart(10, '0'),
    total: _getRandomLetters(8),
    discount: _getRandomLetters(8),
    client_name: _getRandomLetters(50),
    registered_at: new Date().toISOString(),
    shipping_address_id,
    billing_address_id,
    ...extra
  };
};

const _addSuborderToOrder = async (db, items_nr, order_id) => {
  const orderItems = [];

  // create suborders entry
  const suborder = await db.models.suborders.create({
    parent_order_id: order_id
  });

  // create items array
  for (let i = 0; i < items_nr; i += 1) {
    const orderItem = {
      pid: '' + _getRandomIntBetween(1, 10000),
      quantity: _getRandomIntBetween(5, 10),
      vendor: _getRandomIntBetween(1, 10),
      price: _getRandomLetters(5),
      base_price: _getRandomLetters(5),
      total: _getRandomLetters(5),
      product_id: _getRandomIntBetween(1, 10000),
      product_parent_id: _getRandomIntBetween(1, 10000),
      discount: _getRandomLetters(5),
      url_key: _getRandomLetters(20),
      name: _getRandomLetters(20),
      image: _getRandomLetters(20),
      parent_suborder_id: suborder.id
    };

    orderItems.push(orderItem);
  }

  await db.models.order_items.bulkCreate(orderItems);

  return { id: suborder.id, items: orderItems };
};

const _createOrders = async (db, nr_orders, nr_items_arr, extra) => {
  if (nr_orders !== nr_items_arr.length) throw new Error('nr_orders should be equal to nr_items_arr.length!');
  if (nr_orders !== extra.length) throw new Error('nr_orders should be equal to extra.length!');

  const orders = [];
  let addresses = [];

  for (let i = 0; i < nr_orders; i += 1) {
    addresses = [];

    const shipping_address = _generateAddressData();
    const billing_address = _generateAddressData();

    addresses.push(shipping_address);
    addresses.push(billing_address);

    const [
      { id: shipping_address_id },
      { id: billing_address_id }
    ] = await db.models.addresses.bulkCreate(addresses);

    const order = _generateOrderData({ shipping_address_id, billing_address_id }, extra[i]);
    orders.push(order);
  }

  const createdOrders = await db.models.orders.bulkCreate(orders);

  const subordersItems = [];

  // add items in a single suborder as defined by nr_items_arr
  for (let i = 0; i < nr_items_arr.length; i += 1) {
    const { items } = await _addSuborderToOrder(db, nr_items_arr[i], createdOrders[i].id);

    subordersItems.push(items);
  }

  const [shipping, billing] = addresses;
  if (nr_orders === 1) {
    return {
      shipping,
      billing,
      order: createdOrders[0],
      items: subordersItems[0]
    };
  }

  // TODO: implement this when the time comes to create multiple orders
  return createdOrders;
};

const _createOrder = async (db, nr_items, extra = {}) => {
  const { shipping, billing, order, items } = await _createOrders(db, 1, [nr_items], [extra]);

  return { order, shipping, billing, items };
};

const _deleteOrders = async (db, arr) => db.models.orders.destroy({
  where: {
    increment_id: arr.map(order => order.increment_id)
  }
});

const _getAddressesIdFromOrder = async (db, orderNumber) => {
  const addressesIds = [];

  const orders = await db.models.orders.findOne({
    where: { increment_id: orderNumber },
    attributes: ['shipping_address_id', 'billing_address_id']
  });

  orders.forEach(({ shipping_address_id, billing_address_id }) => {
    addressesIds.push(shipping_address_id, billing_address_id);
  });

  return addressesIds;
};

export default {
  _generateAddressData,
  _getRandomIntBetween,
  _createOrder,
  _deleteOrders,
  _getRandomLetters
};
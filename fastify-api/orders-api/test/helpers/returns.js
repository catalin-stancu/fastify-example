/* eslint-disable no-await-in-loop */
/* eslint-disable camelcase */
/* eslint-disable no-param-reassign */
/* eslint-disable require-jsdoc */
// eslint-disable-next-line no-underscore-dangle
/* eslint-disable no-loop-func */
/* eslint-disable max-len */
/* eslint-disable no-underscore-dangle */
/* eslint-disable id-length */

import testOrderFunctions from './orders.js';

const {
  _generateAddressData
} = testOrderFunctions;

function _getRandomIntBetween(low = 0, high = 10) {
  return Math.floor(Math.random() * (1 + high - low) + low);
}

/**
 * Function which generates return data for the internal Sequelize instance, but also for a correct payload request
 *
 * @param {string} increment_id the order number
 * @param {object[]} items array of objects representing valid items
 * @param {object} statusesObject   object containing statuses for RMAs
 * @param {boolean} [curated=false] if true, it will generate data for a request,
 * if false, for a Sequelize INSERT command
 * @return {object}
 */
function _generateReturnData(increment_id, items, statusesObject, curated = false) {
  const {
    return_reasons: { statusToId: returnReasons },
    return_statuses: { statusToId: returnStatuses },
    return_types: { statusToId: returnTypes },
    pickup_methods: { statusToId: pickupMethods }
  } = statusesObject;

  const {
    recipient_name,
    recipient_phone,
    county,
    city,
    street,
    street_no,
    address_details,
    postcode,
    company_iban: customer_iban,
    company_bank: customer_bank
  } = _generateAddressData();

  let formattedItems;
  let result;

  if (curated) {
    formattedItems = items.map(({ pid }) => ({ pid, quantity: 1, reason: 'Wrong product' }));

    result = {
      return_type: 'Replacement',
      increment_id,
      pickup_method: 'Courier',
      status: 'New',
      return_suffix: _getRandomIntBetween(1, 9),
      address: {
        recipient_name,
        recipient_phone,
        county,
        city,
        street,
        street_no,
        address_details,
        postcode
      },
      customer_iban,
      customer_bank,
      bank_account_beneficiary: recipient_name,
      products: formattedItems
    };
  } else {
    formattedItems = items.map(({ pid }) => ({ pid, quantity: 1, return_reason_id: returnReasons['Wrong product'] }));

    result = {
      return_type_id: returnTypes.Replacement,
      increment_id,
      pickup_method_id: pickupMethods.Courier,
      status_id: returnStatuses.New,
      return_suffix: _getRandomIntBetween(1, 9),
      address: {
        recipient_name,
        recipient_phone,
        county,
        city,
        street,
        street_no,
        address_details,
        postcode
      },
      customer_iban,
      customer_bank,
      bank_account_beneficiary: recipient_name,
      products: formattedItems
    };
  }

  return result;
}

const makeCreateReturn = statusesObject => async function _createReturn(db, orderObject) {
  const { order: { increment_id }, items: orderItems } = orderObject;

  const { products, address, ...restOfReturn } = _generateReturnData(increment_id, orderItems, statusesObject);

  const { id: pickup_address_id } = await db.models.addresses.create(address);

  const createdReturn = await db.models.returns.create({
    ...restOfReturn,
    increment_id,
    pickup_address_id
  });

  const { id: return_id } = createdReturn;

  const createdReturnItems = await db.models.return_order_items.bulkCreate(products.map(product => ({ return_id, ...product })));

  return {
    return_items: createdReturnItems,
    return: createdReturn,
    return_id
  };
};

async function _deleteReturns(db, increment_id) {
  await db.models.returns.destroy({
    where: {
      increment_id: {
        $eq: increment_id
      }
    }
  });
}

export default {
  _generateReturnData,
  makeCreateReturn,
  _deleteReturns
};
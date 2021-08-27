const RETURN_STATUS = {
  NEW: 1,
  ACCEPTED: 2,
  REFUSED: 3,
  CANCELED: 4,
  RECEIVED: 5,
  FINALIZED: 6
};

const RETURN_TYPE = {
  REPLACEMENT: 1,
  REFUND: 2
};

const RETURN_REASON = {
  WRONG_PRODUCT: 1,
  WRONG_SIZE: 2,
  WRONG_COLOR: 3,
  DAMAGED_PRODUCT: 4,
  OTHERS: 5
};

const PICKUP_METHOD = {
  COURIER: 1
};

const returnStatuses = [
  {
    id: RETURN_STATUS.NEW,
    value: 'New'
  },
  {
    id: RETURN_STATUS.ACCEPTED,
    value: 'Accepted'
  },
  {
    id: RETURN_STATUS.REFUSED,
    value: 'Refused'
  },
  {
    id: RETURN_STATUS.CANCELED,
    value: 'Canceled'
  },
  {
    id: RETURN_STATUS.RECEIVED,
    value: 'Received'
  },
  {
    id: RETURN_STATUS.FINALIZED,
    value: 'Finalized'
  }
];

const returnTypes = [
  {
    id: RETURN_TYPE.REPLACEMENT,
    value: 'Replacement'
  },
  {
    id: RETURN_TYPE.REFUND,
    value: 'Refund'
  }
];

const returnReasons = [
  {
    id: RETURN_REASON.WRONG_PRODUCT,
    value: 'Wrong product'
  },
  {
    id: RETURN_REASON.WRONG_SIZE,
    value: 'Wrong size'
  },
  {
    id: RETURN_REASON.WRONG_COLOR,
    value: 'Wrong color'
  },
  {
    id: RETURN_REASON.DAMAGED_PRODUCT,
    value: 'Damaged product'
  },
  {
    id: RETURN_REASON.OTHERS,
    value: 'Others'
  }
];

const pickupMethods = [
  {
    id: PICKUP_METHOD.COURIER,
    value: 'Courier'
  }
];

module.exports = {
  up: queryInterface => queryInterface.sequelize.transaction(async t => {
    await queryInterface.bulkInsert('return_statuses', returnStatuses, { transaction: t });
    await queryInterface.bulkInsert('return_types', returnTypes, { transaction: t });
    await queryInterface.bulkInsert('pickup_methods', pickupMethods, { transaction: t });
    await queryInterface.bulkInsert('return_reasons', returnReasons, { transaction: t });
  }),

  down: (queryInterface, Sequelize) => queryInterface.sequelize.transaction(async t => {
    const { Op } = Sequelize;

    const toDeleteReturnStatuses = returnStatuses.map(({ id }) => id);
    const toDeleteReturnTypes = returnTypes.map(({ id }) => id);
    const toDeleteReturnReasons = returnReasons.map(({ id }) => id);
    const toDeletePickupMethods = pickupMethods.map(({ id }) => id);

    await queryInterface.bulkDelete('return_statuses',
      { id: { [Op.in]: toDeleteReturnStatuses } }, { transaction: t });
    await queryInterface.bulkDelete('return_types',
      { id: { [Op.in]: toDeleteReturnTypes } }, { transaction: t });
    await queryInterface.bulkDelete('pickup_methods',
      { id: { [Op.in]: toDeleteReturnReasons } }, { transaction: t });
    await queryInterface.bulkDelete('return_reasons',
      { id: { [Op.in]: toDeletePickupMethods } }, { transaction: t });
  })
};
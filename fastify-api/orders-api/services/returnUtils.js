/**
 * Utils class used to manage sub-operations with orders
 */
export class ReturnUtils {
  /**
   * @param {object} db - Sequelize instance
   * @param {object} logger - Fastify logger instance
   * @param {object} utils - utils dictionary
   * @returns {object} class instance
   */
  constructor(db, logger, utils) {
    this.db = db;
    this.log = logger;
    this.utils = utils;

    this.table = this.db.models.returns;
    this.models = this.db.models;
    this.errClass = 104;

    this.createdReturnColumns = [
      'return_suffix',
      'return_type_id',
      'status_id',
      'increment_id',
      'pickup_method_id',
      'bank_account_beneficiary',
      'customer_iban',
      'customer_bank',
      'created_at'
    ];

    this.createdAddressColumns = [
      'recipient_name',
      'recipient_phone',
      'city',
      'county',
      'street',
      'street_no',
      'address_details',
      'postcode'
    ];
  }

  /**
   * Get user's full name from the provided UUID
   * TODO: Replace random mocked value with external service call when available
   *
   * @param {string} userUuid - uuid of admin user
   * @returns {string}
   * @private
   */
  static getUserFullName(userUuid) {
    const MOCK_NAMES = [
      'George Popescu',
      'Ion Despescu',
      'Florian Grigore'
    ];

    const deterministicRandomIndex = (userUuid.charCodeAt(0) - 48)
      % MOCK_NAMES.length;

    return MOCK_NAMES[deterministicRandomIndex];
  }

  /**
   * Add extra fields to order
   *
   * @param {object} instance - order instance
   * @returns {object} augmented instance
   */
  static async addExtraOrderDataAsync(instance) {
    // The original instance object may not be editable so we have to copy it
    // because we have to modify a property after post-processing
    const processedInstance = { ...instance.get({ plain: true }) };

    Object.assign(processedInstance, {
      modified_by: {
        name: ReturnUtils.getUserFullName(instance.modified_by),
        uuid: instance.modified_by
      },
      created_by: {
        name: ReturnUtils.getUserFullName(instance.created_by),
        uuid: instance.created_by
      }
    });

    return processedInstance;
  }

  /**
   * Check if the return is valid.
   * First, check if the order items' quantities are respected in the RMA
   * Second, check if items' quantities from existing RMAs are also respected
   *
   * @param {object} data - the received data object
   * @param {string} orderNumber increment_id of the order
   * @returns {undefined}
   */
  async checkIfValidReturn(data, orderNumber) {
    const stockInventory = {};
    const receivedReturnInventory = {};
    const { products } = data;

    products.forEach(
      ({ pid, quantity }) => {
        if (quantity <= 0) {
          this.utils.httpErrors.throwBadRequest(
            'Returns cannot contain products that have negative or null quantities',
            { errClass: this.errClass }
          );
        }

        if (!receivedReturnInventory[pid]) receivedReturnInventory[pid] = quantity;
        else {
          // check the format of the products array

          this.utils.httpErrors.throwBadRequest(
            'The products array cannot contain multiple instances of the same product',
            { errClass: this.errClass }
          );
        }
      }
    );

    const foundOrder = await this.models.orders.findOne({
      where: {
        increment_id: orderNumber
      },
      include: [
        {
          model: this.models.suborders,
          include: [
            {
              model: this.models.order_items,
              as: 'orderItems',
              attributes: [
                'pid',
                'quantity'
              ]
            }
          ]
        }
      ]
    });

    if (!foundOrder) {
      this.utils.httpErrors.throwNotFound('Order not found', {
        errClass: this.errClass
      });
    }

    const { orderItems } = foundOrder.suborders[0];

    const existingReturns = await this.table.findAll({
      where: { increment_id: orderNumber },
      include: [
        {
          model: this.models.return_order_items,
          as: 'returnItems'
        }
      ]
    });

    const existingReturnsNr = existingReturns.length;
    orderItems.forEach(({ pid, quantity }) => {
      // no need for check here since we don't store duplicate instances of the same product
      stockInventory[pid] = quantity;
    });

    Object.keys(receivedReturnInventory).forEach(pid => {
      if (!stockInventory[pid]) {
        this.utils.httpErrors.throwBadRequest('Returns must not contain '
          + 'items that are not included in the order', {
          errClass: this.errClass
        });
      }
    });

    // decrement current quantity for each product from existing returns
    if (existingReturns.length) {
      existingReturns.forEach(existingReturn => {
        existingReturn.returnItems.forEach(({ pid, quantity }) => {
          stockInventory[pid] -= quantity;
        });
      });
    }

    // check if current return has too much quantity on an item
    Object.keys(stockInventory).forEach(pid => {
      if (stockInventory[pid] - receivedReturnInventory[pid] < 0) {
        this.utils.httpErrors.throwBadRequest('Quantities for returned items must not be '
        + 'greater than the sum between the quantities of registered products in the order '
        + 'and the quantities of products from other existing returns', {
          errClass: this.errClass
        });
      }
    });

    return existingReturnsNr;
  }

  /**
  * Check if an order exists before proceeding with return logic
  *
  * @param {string} orderNumber unique identifier of the order
  * @returns {undefined}
  */
  async checkIfOrderExists(orderNumber) {
    const foundOrder = await this.models.orders.findOne({
      where: {
        increment_id: orderNumber
      }
    });

    if (!foundOrder) this.utils.httpErrors.throwNotFound('Order not found');
  }

  /**
   * Returns the statuses for returns
   *
   * @returns {Promise<object>} - the object containing the statuses for returns
   */
  async getReturnStatusesAsync() {
    this.log.info('Retrieving return statuses from DB');

    const returnReasons = await this.models.return_reasons.findAll({
      attributes: ['id', 'value'],
      raw: true
    });

    const returnStatuses = await this.models.return_statuses.findAll({
      attributes: ['id', 'value'],
      raw: true
    });

    const returnTypes = await this.models.return_types.findAll({
      attributes: ['id', 'value'],
      raw: true
    });

    const pickupMethods = await this.models.pickup_methods.findAll({
      attributes: ['id', 'value'],
      raw: true
    });

    const statusesObject = {
      return_reasons: returnReasons, // per product
      return_statuses: returnStatuses,
      return_types: returnTypes,
      pickup_methods: pickupMethods
    };

    const returnsStatusesObj = {};

    Object.keys(statusesObject).forEach(statusModel => {
      if (!statusesObject[statusModel].length) {
        this.utils
          .httpErrors.throwInternalServerError(`Status table ${statusModel} is not defined`);
      }

      statusesObject[statusModel].forEach(statusEntry => {
        const { value, id } = statusEntry;

        if (!returnsStatusesObj[statusModel]) returnsStatusesObj[statusModel] = {};
        if (!returnsStatusesObj[statusModel]
          .statusToId) returnsStatusesObj[statusModel].statusToId = {};
        if (!returnsStatusesObj[statusModel]
          .idToStatus) returnsStatusesObj[statusModel].idToStatus = {};

        returnsStatusesObj[statusModel].statusToId[value] = id;
        returnsStatusesObj[statusModel].idToStatus[id] = value;
      });
    });

    return returnsStatusesObj;
  }
}
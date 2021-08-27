import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];
/**
 * Class used to manage orders handler business logic
 */
export class ReturnService {
  /**
   * @param {object} db - Sequelize instance
   * @param {object} logger - Fastify logger instance
   * @param {object} utils - utils dictionary
   * @param {object} returnUtils - Return Utils instance
   * @returns {object} class instance
   */
  constructor(db, logger, utils, returnUtils) {
    this.db = db;
    this.log = logger;
    this.utils = utils;
    this.returnUtils = returnUtils;
    this.errClass = 103;

    this.table = db.models.returns;
    this.models = db.models;
  }

  /**
   * Get a list of returns
   *
   * @param {object} opts arguments object
   * @param {boolean} opts.showTotalItems - if true includes the count of all instances
   *   (without pagination)
   * @param {object} opts.where - ORM formatted query filter
   * @param {Array<Array<string>>} opts.order - ORM formatted ordering of results
   * @param {number} opts.limit - page size
   * @param {number} opts.offset - page offset
   * @returns {object} object with two properties:
   *   - output - list with results
   *   - metadata - metadata with instance count and page info to put in response
   * @async
   */
  async findManyAsync(opts) {
    const {
      showTotalItems, where, order, limit, offset
    } = opts;

    const queryFunc = showTotalItems ? 'findAndCountAll' : 'findAll';
    const results = await this.table[queryFunc].call(this.table, {
      order,
      where,
      // Increment limit to see if there are any items on the next page
      limit: limit + 1,
      offset,
      attributes: [
        'return_suffix',
        'status_id',
        'return_type_id',
        'increment_id',
        'pickup_method_id',
        'created_at'
      ],
      raw: true,
      nest: true,
      include: [
        {
          model: this.models.orders,
          attributes: ['registered_at', 'client_name'],
          as: 'orderReturns' // FIXME: should be returnOrders
        },
        {
          model: this.models.return_statuses,
          attributes: ['value']
        },
        {
          model: this.models.pickup_methods,
          attributes: ['value']
        },
        {
          model: this.models.return_types,
          attributes: ['value']
        }
      ]
    });

    const output = showTotalItems ? results?.rows : results;

    const augmentedOutput = output.map(({
      created_at: returnCreatedAt,
      // FIXME: should be returnOrders
      orderReturns: { client_name: clientName, registered_at: orderRegisteredAt },
      return_status: { value: status },
      pickup_method: { value: pickupMethod },
      return_type: { value: returnType },
      ...returnRow
    }) => ({
      ...returnRow,
      status,
      pickup_method: pickupMethod,
      return_type: returnType,
      customer_name: clientName,
      return_created_at: returnCreatedAt,
      order_created_at: orderRegisteredAt
    }));

    // Set 'end' flag to false if there are any items on the next page
    let end = true;
    if (augmentedOutput.length > limit) {
      end = false;

      // Remove last item, was used only for checking next page availability
      augmentedOutput.pop();
    }

    const pageCount = augmentedOutput.length;
    this.log.info(`[${moduleName}]: Found ${pageCount} returns`);

    const metadata = {
      count: pageCount,
      end,
      total_items: showTotalItems ? results?.count : undefined
    };

    return { output: augmentedOutput, metadata };
  }

  /**
   * Create an return
   *
   * @param {object} data object containing the return details
   * @param {string} orderNumber increment_id of the order
   * @returns {object} created return
   * @async
   */
  async createOneAsync(data, orderNumber) {
    const { _: { pick } } = this.utils;
    const {
      return_statuses: returnStatuses,
      return_types: returnTypes,
      pickup_methods: pickupMethods,
      return_reasons: returnReasons
    } = await this.returnUtils.getReturnStatusesAsync();

    const {
      products,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      county,
      city,
      street,
      street_no: streetNo,
      address_details: addressDetails,
      postcode,
      return_type: returnType,
      pickup_method: pickupMethod,
      ...restOfData
    } = data;

    const addressData = {
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      county,
      city,
      street,
      street_no: streetNo,
      address_details: addressDetails,
      postcode
    };

    this.log.trace(`[${moduleName}]: Checking if the received return is valid`);

    const existingReturnsNr = await this.returnUtils.checkIfValidReturn(data, orderNumber);

    this.log.trace(`[${moduleName}]: Trying to create a new return`);

    const createdAddress = await this.models.addresses.create(addressData);

    const createdAddressFormatted = pick(createdAddress, this.returnUtils.createdAddressColumns);

    const createdReturn = await this.table.create({
      increment_id: orderNumber,
      return_suffix: existingReturnsNr + 1,
      status_id: returnStatuses.statusToId.New,
      pickup_address_id: createdAddress.id,
      return_type_id: returnTypes.statusToId[returnType],
      pickup_method_id: pickupMethods.statusToId[pickupMethod],
      ...restOfData
    });

    const createdReturnFormatted = pick(createdReturn, this.returnUtils.createdReturnColumns);

    const {
      created_at: returnCreatedAt,
      return_type_id: returnTypeId,
      status_id: statusId,
      pickup_method_id: pickupMethodId,
      ...restOfReturn
    } = createdReturnFormatted;

    // FIXME: this will fuckup FE because FE doesn't get the statuses yet
    const augmentedProducts = products.map(({
      reason: returnReason,
      ...restOfProduct
    }) => ({
      ...restOfProduct,
      return_reason_id: returnReasons.statusToId[returnReason],
      return_id: createdReturn.id
    }));

    const createdProducts = await this.models.return_order_items.bulkCreate(augmentedProducts);

    const responseProductArr = createdProducts.map(({
      pid,
      return_reason_id: returnReasonId,
      quantity
    }) => ({
      pid,
      reason: returnReasons.idToStatus[returnReasonId],
      quantity
    }));

    const responseObject = {
      ...restOfReturn,
      ...createdAddressFormatted,
      status: returnStatuses.idToStatus[statusId],
      return_type: returnTypes.idToStatus[returnTypeId],
      pickup_method: pickupMethods.idToStatus[pickupMethodId],
      products: responseProductArr,
      created_at: returnCreatedAt
    };

    return responseObject;
  }
}
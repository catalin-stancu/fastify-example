import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];
/**
 * Class used to manage orders handler business logic
 */
export class OrderService {
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
    this.errClass = 101;
    this.table = db.models.orders;
    this.models = db.models;
  }

  /**
   * Get a list of orders
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
    // TODO: replace "explicitOrder" destructuring from opts with
    // extracting from "where" object decorated by FGP
    const {
      showTotalItems, where, order, limit, offset, searchForTrimmed, explicitOrder
    } = opts;
    const { Op } = this.db;
    const queryFunc = showTotalItems ? 'findAndCountAll' : 'findAll';
    const columnsSearchFor = ['increment_id', 'client_name'];
    const globalSearchMode = searchForTrimmed?.length > 0;

    let results;
    if (globalSearchMode) {
      this.log.trace(`[${moduleName}]: Listing orders with searchFor filtering`);
      const {
        include: searchForInclude,
        where: searchForWhere,
        order: searchForOrder
      } = this.utils.buildSearchForQuery(
        searchForTrimmed,
        columnsSearchFor,
        'orders'
      );

      results = await this.table[queryFunc].call(this.table, {
        attributes: {
          include: searchForInclude
        },
        where: {
          [Op.and]: [
            searchForWhere,
            where
          ]
        },
        // Prioritize ordering requested by client
        order: (explicitOrder ? order : searchForOrder),
        // Increment limit to see if there are any items on the next page
        limit: limit + 1,
        offset,
        raw: true
      });
    } else {
      this.log.trace(`[${moduleName}]: Listing orders with standard filtering`);
      results = await this.table[queryFunc].call(this.table, {
        order,
        where,
        // Increment limit to see if there are any items on the next page
        limit: limit + 1,
        offset,
        raw: true
      });
    }

    const output = showTotalItems ? results?.rows : results;

    // Set 'end' flag to false if there are any items on the next page
    let end = true;
    if (output.length > limit) {
      end = false;

      // Remove last item, was used only for checking next page availability
      output.pop();
    }

    const pageCount = output.length;
    this.log.info(`[${moduleName}]: Found ${pageCount} orders`);

    const metadata = {
      count: pageCount,
      end,
      total_items: showTotalItems ? results?.count : undefined
    };

    return { output, metadata };
  }

  /**
   * Get an order
   *
   * @param {string} orderNumber - order number
   * @param {boolean} availableQuantities - flag which signals if the available quantities
   * should be returns instead of the quantities registered in the order
   * @returns {object} requested order
   * @async
   */
  async findOneAsync(orderNumber, availableQuantities) {
    const instance = await this.table.findOne({
      where: { increment_id: orderNumber },
      attributes: [
        'increment_id',
        'total',
        'discount',
        'status',
        'registered_at',
        'created_at',
        'modified_at'
      ],
      include: [
        {
          model: this.models.addresses,
          as: 'shippingAddress',
          attributes: [
            'recipient_name',
            'recipient_phone',
            'county',
            'city',
            'street',
            'street_no',
            'address_details',
            'postcode',
            'company_bank',
            'company_name',
            'company_fiscal_code',
            'company_iban',
            'company_reg_no'
          ]
        }, {
          model: this.models.addresses,
          as: 'billingAddress',
          attributes: [
            'recipient_name',
            'recipient_phone',
            'county',
            'city',
            'street',
            'street_no',
            'address_details',
            'postcode',
            'company_bank',
            'company_name',
            'company_fiscal_code',
            'company_iban',
            'company_reg_no'
          ]
        }, {
          model: this.models.suborders,
          include: [
            {
              model: this.models.order_items,
              as: 'orderItems',
              attributes: [
                'pid',
                'product_id',
                'quantity',
                'base_price',
                'price',
                'discount',
                'total',
                'product_parent_id',
                'vendor',
                'name',
                'image',
                'url_key'
              ] }
          ]
        }
      ]
    });

    if (!instance?.increment_id) {
      this.utils.httpErrors.throwNotFound('Order not found', { errClass: this.errClass });
    }

    const instanceJSON = instance.toJSON();

    if (availableQuantities) {
      const registeredReturns = await this.models.returns.findAll({
        where: { increment_id: orderNumber },
        attributes: [],
        include: [
          {
            model: this.models.return_order_items,
            as: 'returnItems',
            attributes: [
              'pid',
              'quantity'
            ]
          }
        ]
      });

      const registeredReturnsToJson = registeredReturns
        .map(registeredReturn => registeredReturn.toJSON());

      if (registeredReturnsToJson.length) {
        const returnsInventory = registeredReturnsToJson
          .reduce((returnsInventoryAcc, { returnItems }) => {
            returnItems.forEach(({ pid, quantity }) => {
              if (!returnsInventoryAcc[pid]) returnsInventoryAcc[pid] = quantity;
              else returnsInventoryAcc[pid] += quantity;
            });

            return returnsInventoryAcc;
          }, {});

        // TODO: remove `[0]` when suborder's status is implemented or when we
        // have multiple suborders that we want to keep separated
        instanceJSON.suborders[0].orderItems.forEach(({ pid }, index) => {
          // we shouldn't do any checking here since when the returns were succesfully added
          // checks were already done there
          if (!returnsInventory[pid]) return;
          instanceJSON.suborders[0].orderItems[index].quantity -= returnsInventory[pid];
        });

        // remove orderItems that have a null quantity
        // theoretically, we cannot have negative quantities here
        instanceJSON.suborders[0].orderItems = instanceJSON
          .suborders[0].orderItems.filter(item => item.quantity !== 0);
      }
    }

    const outcome = instance?.increment_id ? 'found' : 'not found';
    this.log.trace(`[${moduleName}]: Order with number ${orderNumber} ${outcome}`);

    const {
      suborders,
      shippingAddress: shipping,
      billingAddress: billing,
      ...restOfOrder
    } = instanceJSON;

    const formattedResponse = {
      address: {
        shipping,
        billing
      },
      // TODO: remove `[0]` when suborder's status is implemented or when we
      // have multiple suborders that we want to keep separated
      items: suborders[0].orderItems,
      ...restOfOrder
    };

    return formattedResponse;
  }

  /**
   * Create an order
   * @param {object} data object containing the order details
   * @returns {object} created order
   * @async
   */
  async createOneAsync(data) {
    const duplicate = await this.table.count(OrderService.getFilterForUniqueness(data));

    if (duplicate) {
      this.log.info(`Order with the number ${data.increment_id} already exists`);

      return { increment_id: null };
    }

    this.log.trace(`[${moduleName}]: Trying to create a new order`);

    const {
      items,
      address: {
        shipping,
        billing
      },
      ...orderData
    } = data;

    // create addresses
    const [
      { id: billingAddressId },
      { id: shippingAddressId }
    ] = await this.models.addresses.bulkCreate([shipping, billing]);

    const createdOrder = await this.table.create({
      ...orderData,
      billing_address_id: billingAddressId,
      shipping_address_id: shippingAddressId
    });

    // TODO: change below logic when we will have multiple suborders
    const createdSuborder = await this.models.suborders.create({
      parent_order_id: createdOrder.id
    });

    await this.models.order_items.bulkCreate(items
      .map(item => ({ ...item, parent_suborder_id: createdSuborder.id })));

    return createdOrder;
  }

  /**
   * Default filter used when creating a new instance, to avoid duplicates
   *
   * @param {object} data - payload data
   * @returns {object} ORM formatted query for duplication
   * @async
   */
  static getFilterForUniqueness(data) {
    return {
      where: {
        increment_id: data.increment_id
      }
    };
  }
}
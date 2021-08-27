import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * Class used to manage entities business logic
 */
export class TagService {
  /**
   * @param {object} db - Sequelize instance
   * @param {object} log - Fastify logger instance
   * @param {object} utils - utils dictionary
   * @returns {object} class instance
   */
  constructor(db, log, utils) {
    this.db = db;
    this.log = log;
    this.utils = utils;
    this.errClass = 102;
    this.table = db.models.tags;
  }

  /**
   * Get a list of tags
   *
   * @param {boolean} showTotalItems - if true includes the count of all items without pagination
   * @param {object} where - ORM formatted query filter
   * @param {Array<Array<string>>} order - ORM formatted ordering of results
   * @param {number} limit - page size
   * @param {number} offset - page offset
   * @returns {object} object with two properties:
   *   - output - list with results
   *   - metadata - metadata with item count and page info to put in response
   * @async
   */
  async getManyAsync(showTotalItems, where, order, limit, offset) {
    const queryFunc = showTotalItems ? 'findAndCountAll' : 'findAll';
    const results = await this.table[queryFunc].call(this.table, {
      order,
      where,
      // Increment limit to see if there are any items on the next page
      limit: limit + 1,
      offset,
      raw: true
    });

    const output = showTotalItems ? results?.rows : results;

    // Set 'end' flag to false if there are any items on the next page
    let end = true;
    if (output.length > limit) {
      end = false;

      // Remove last item, was used only for checking next page availability
      output.pop();
    }

    const pageCount = output.length;
    this.log.info(`[${moduleName}]: Found ${pageCount} tags`);

    const metadata = {
      count: pageCount,
      end,
      total_items: showTotalItems ? results?.count : undefined
    };

    return { output, metadata };
  }

  /**
   * Get a tag
   *
   * @param {string} uuid - tag UUID
   * @returns {object} requested tag
   * @async
   */
  async getOneAsync(uuid) {
    const instance = await this.table.findOne({
      where: { uuid }
    });

    const outcome = instance?.id ? 'found' : 'not found';
    this.log.trace(`[${moduleName}]: Tag with uuid ${uuid} ${outcome}`);

    if (!instance?.id) {
      this.utils.httpErrors.throwNotFound('Tag not found', { errClass: this.errClass });
    }

    return instance;
  }

  /**
   * Create a tag
   *
   * @param {object} data - tag data
   * @returns {object} created tag
   * @async
   */
  async createOneAsync(data) {
    const dataWithNameLowerCased = {
      ...data,
      name: data.name.toLowerCase()
    };
    const duplicate = await this.table.count(
      TagService.getFilterForUniqueness(dataWithNameLowerCased)
    );

    if (duplicate) {
      this.utils.httpErrors.throwConflict(
        'Tag with the same name already exists',
        { errClass: this.errClass }
      );
    }

    const createdOrder = await this.table.create({
      ...dataWithNameLowerCased,
      uuid: this.utils.UUID.v4()
    }, { returning: true });

    const outcome = createdOrder.id ? 'created successfully' : 'not created';
    this.log.info(`[${moduleName}]: Tag ${outcome}`);

    return createdOrder;
  }

  /**
   * Delete a list of tags
   *
   * @param {object} where - ORM formatted query filter
   * @returns { object } - object with properties:
   *   - metadata - information about deletion results
   * @async
   */
  async deleteManyAsync(where) {
    // Note: The tag associations are deleted when deleting entities via FK CASCADE on DELETE
    const count = await this.table.destroy({ where }) || 0;
    this.log.info(`[${moduleName}]: Deleted ${count} tags`);
    return { metadata: { count } };
  }

  /**
   * Delete a tag
   *
   * @param {string} uuid - UUID of entity to be deleted
   * @returns { object } - object with properties:
   *   - metadata - information about deletion results
   * @async
   */
  async deleteOneAsync(uuid) {
    // Note: The tag associations are deleted when deleting entities via FK CASCADE on DELETE
    const count = await this.table.destroy({
      where: { uuid },
      limit: 1
    }) || 0;

    const outcome = count ? 'deleted successfully' : 'not deleted';
    this.log.info(`[${moduleName}]: Instance with uuid ${uuid} ${outcome}`);
    return { metadata: { count } };
  }

  /**
   * Default filter used when creating a new tag, to avoid duplicates
   *
   * @param {object} data - payload data
   * @returns {object}
   */
  static getFilterForUniqueness(data) {
    return {
      where: {
        name: data.name
      }
    };
  }
}
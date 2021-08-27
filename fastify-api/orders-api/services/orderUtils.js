/**
 * Utils class used to manage sub-operations with orders
 */
export class OrderUtils {
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
    this.errClass = 102;
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
        name: OrderUtils.getUserFullName(instance.modified_by),
        uuid: instance.modified_by
      },
      created_by: {
        name: OrderUtils.getUserFullName(instance.created_by),
        uuid: instance.created_by
      }
    });

    return processedInstance;
  }
}
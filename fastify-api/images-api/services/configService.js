import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * Class used to manage stack configuration business logic
 */
export class ConfigService {
  /**
   * @param {object} opts - parameters object
   * @param {object} opts.fileRules - object with file configurations
   * @param {object} opts.configUtils - ConfigUtils instance
   * @param {object} opts.entityUtils - EntityUtils instance
   * @param {object} opts.db - Sequelize instance
   * @param {object} opts.log - Fastify logger instance
   * @param {object} opts.utils - utils dictionary
   * @returns {object} class instance
   */
  constructor({ fileRules, configUtils, entityUtils, db, log, utils }) {
    this.fileRules = fileRules;
    this.configUtils = configUtils;
    this.entityUtils = entityUtils;
    this.db = db;
    this.log = log;
    this.utils = utils;

    this.errClass = 103;
    this.table = db.models.config;
    this.models = this.db.models;
  }

  /**
   * Get a list of configurations
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

    const list = showTotalItems ? results?.rows : results;
    const output = await Promise.all(list.map(
      config => this.addExtraConfigDataAsync(config, this.fileRules)
    ));

    // Set 'end' flag to false if there are any items on the next page
    let end = true;
    if (output.length > limit) {
      end = false;

      // Remove last item, was used only for checking next page availability
      output.pop();
    }

    const pageCount = output.length;
    this.log.info(`[${moduleName}]: Found ${pageCount} configurations`);

    const metadata = {
      count: pageCount,
      end,
      total_items: showTotalItems ? results?.count : undefined
    };

    return { output, metadata };
  }

  /**
   * Get a configuration
   *
   * @param {string} id - configuration UUID
   * @returns {object} requested configuration
   * @async
   */
  async getOneAsync(id) {
    const instance = await this.table.findOne({
      where: { id }
    });

    const outcome = instance?.id ? 'found' : 'not found';
    this.log.trace(`[${moduleName}]: Configuration with id ${id} ${outcome}`);

    if (!instance?.id) {
      this.utils.httpErrors.throwNotFound('Config row not found', { errClass: this.errClass });
    }
    const augmentedInstance = await this.addExtraConfigDataAsync(instance, this.fileRules);

    return augmentedInstance;
  }

  /**
   * Create a configuration
   *
   * @param {object} data - configuration data
   * @returns {object} created configuration
   * @async
   */
  async createOneAsync(data) {
    const { variant_resolutions: variantResolutions } = data;
    if (variantResolutions) {
      this.configUtils.validateConfigViewportsAspectRatio(variantResolutions);
    }

    const duplicate = await this.table.count(ConfigService.getFilterForUniqueness(data));

    if (duplicate) {
      this.utils.httpErrors.throwConflict(
        'Config row with the same id already exists',
        { errClass: this.errClass }
      );
    }

    if (data.id === 'dam') {
      data.variant_resolutions = null;
      data.global_background = null;
    }

    const instance = await this.table.create({
      ...data,
      // TODO: replace created_by and modified_by with values from logged in user auth token
      created_by: this.utils.UUID.v4(),
      modified_by: this.utils.UUID.v4()
    });

    const outcome = instance ? 'created successfully' : 'not created';
    this.log.info(`[${moduleName}]: Configuration row ${outcome}`);

    // Update schemas related to stack generation
    await this.configUtils.updateStackSchemas();
    const augmentedInstance = await this.addExtraConfigDataAsync(instance, this.fileRules);
    return augmentedInstance;
  }

  /**
   * Update a configuration
   *
   * @param {string} id - configuration id
   * @param {object} data - configuration data
   * @returns {object} updated configuration
   * @async
   */
  async updateOneAsync(id, data) {
    if (id === 'dam') {
      data.variant_resolutions = null;
      data.global_background = null;
    }

    const { variant_resolutions: variantResolutions } = data;
    if (variantResolutions) {
      this.configUtils.validateConfigViewportsAspectRatio(variantResolutions);
    }

    const instanceToUpdate = await this.table.findOne({
      where: { id }
    });

    // if instance is not found, throw generic 404 error
    if (!instanceToUpdate) {
      this.utils.httpErrors.throwNotFound('Instance not found', { errClass: this.errClass });
    }

    const [count = 0, [updatedInstance]] = await this.table.update(data, {
      where: { id },
      limit: 1,
      returning: true
    });

    const outcome = count ? 'updated successfully' : 'not updated';
    this.log.info(`[${moduleName}]: Configuration with uuid ${id} ${outcome}`);

    // Update schemas related to stack generation
    await this.configUtils.updateStackSchemas();

    const augmentedInstance = await this.addExtraConfigDataAsync(updatedInstance, this.fileRules);
    return augmentedInstance;
  }

  /**
   * Delete a configuration
   *
   * @param {string} id - ID of configuration to be deleted
   * @returns { object } - object with properties:
   *   - metadata - information about deletion results
   * @async
   */
  async deleteOneAsync(id) {
    if (id === 'dam' || id === 'cms' || id === 'pim') {
      this.utils.httpErrors.throwBadRequest(
        'Config row for DAM, CMS and PIM cannot be deleted',
        { errClass: this.errClass }
      );
    }

    const countUsedConfig = await this.models.entities.findOne({
      where: {
        usage: id
      }
    }) || 0;

    if (countUsedConfig) {
      this.utils.httpErrors.throwBadRequest(
        'This config is already used by a stack',
        { errClass: this.errClass }
      );
    }

    const count = await this.table.destroy({
      where: { id },
      limit: 1
    }) || 0;

    const outcome = count ? 'deleted successfully' : 'not deleted';
    this.log.info(`[${moduleName}]: Configuration with id ${id} ${outcome}`);

    // Update schemas related to stack generation
    await this.configUtils.updateStackSchemas();

    return { metadata: { count } };
  }

  /**
   * Delete a list of configurations
   *
   * @param {object} where - ORM formatted query filter
   * @returns { object } - object with properties:
   *   - metadata - information about deletion results
   * @async
   */
  async deleteManyAsync(where) {
    const { _: { difference } } = this.utils;
    const reservedIds = ['dam', 'cms', 'pim'];

    const configsList = (await this.table.findAll({ where })).map(instance => instance.id);
    if (!configsList.length) {
      return {
        metadata: { count: 0 }
      };
    }

    const configsListWithoutReserved = difference(configsList, reservedIds);

    if (configsList.length !== configsListWithoutReserved.length) {
      this.utils.httpErrors.throwBadRequest(
        'Config row for DAM, CMS and PIM cannot be deleted',
        { errClass: this.errClass }
      );
    }

    const usedConfigsList = (await this.models.entities.findAll({
      where: {
        usage: {
          [this.db.Op.in]: configsList
        }
      },
      raw: true,
      attributes: ['usage']
    })).map(config => config.usage);

    const unusedConfigsList = difference(
      configsList,
      usedConfigsList
    );

    if (!unusedConfigsList.length) {
      this.utils.httpErrors.throwBadRequest(
        'All specified configs are already used',
        { errClass: this.errClass }
      );
    }

    // delete unused configs
    const count = await this.table.destroy({
      where: {
        id: unusedConfigsList
      }
    }) || 0;

    this.log.info(`[${moduleName}]: Deleted ${count} configurations`);

    // Update schemas related to stack generation
    await this.configUtils.updateStackSchemas();

    return {
      metadata: { count },
      ...(usedConfigsList.length && { usedConfigsList })
    };
  }

  /**
   * Add extra fields to config data
   *
   * @param {object} instance - config instance
   * @param {object} fileRules - file rules defined in appConfig
   * @returns {object} augmented instance
   */
  async addExtraConfigDataAsync(instance, fileRules) {
    const parsedInstance = instance.toJSON?.() || instance;
    const { modified_by: modifiedBy, created_by: createdBy } = parsedInstance;

    return Object.assign(parsedInstance, {
      modified_by: {
        name: this.utils.userUtils.getFullName(modifiedBy),
        uuid: modifiedBy
      },
      created_by: {
        name: this.utils.userUtils.getFullName(createdBy),
        uuid: createdBy
      },
      max_file_bytes: fileRules.maxFileBytes,
      max_files: fileRules.maxFiles,
      supported_image_types: fileRules.supportedImageTypes
    });
  }

  /**
   * Default filter used when creating a new instance, to avoid duplicates
   *
   * @param {object} data - payload data
   * @returns {object}
   */
  static getFilterForUniqueness(data) {
    return {
      where: {
        id: data.id
      }
    };
  }
}
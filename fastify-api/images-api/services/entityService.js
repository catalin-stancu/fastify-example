import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * Class used to manage entities business logic
 */
export class EntityService {
  /**
   * @param {object} opts - parameters object
   * @param {object} opts.entityUtils - EntityUtils instance
   * @param {object} opts.db - Sequelize instance
   * @param {object} opts.log - Fastify logger instance
   * @param {object} opts.utils - utils dictionary
   * @returns {object} class instance
   */
  constructor({ entityUtils, db, log, utils }) {
    this.entityUtils = entityUtils;
    this.db = db;
    this.log = log;
    this.utils = utils;

    this.errClass = 101;
    this.table = db.models.entities;
    this.includeTags = {
      model: db.models.tags,
      as: 'tags',
      attributes: ['name', 'uuid'],
      through: {
        attributes: []
      }
    };
  }

  /**
   * Get a list of files or folders
   *
   * @param {boolean} showTotalItems - if true includes the count of all items without pagination
   * @param {object} where - ORM formatted query filter
   * @param {Array<Array<string>>} order - ORM formatted ordering of results
   * @param {number} limit - page size
   * @param {number} offset - page offset
   * @param {number} searchFor - global search term (partial search, case insensitive)
   * @param {number} searchTagsInstead - if true, the search term will be looked up only in tags
   *   but as exact search (case insensitive)
   * @returns {object} object with two properties:
   *   - output - list with results
   *   - metadata - metadata with item count and page info to put in response
   * @async
   */
  async getManyAsync(showTotalItems, where, order, limit, offset, searchFor, searchTagsInstead) {
    const globalSearchMode = searchFor?.length > 0;
    const queryFunc = showTotalItems ? 'findAndCountAll' : 'findAll';
    let results;
    const { Op, Sequelize, SqlString } = this.db;

    if (globalSearchMode && searchTagsInstead) {
      this.log.trace(`[${moduleName}]: Starting exact lower-case tag search in entities`);
      results = await this.table[queryFunc].call(this.table, {
        where: {
          [Op.and]: [
            {
              '$tags.name$': searchFor.toLowerCase()
            },
            {
              status: {
                [Op.ne]: 'disabled'
              }
            },
            where
          ]
        },
        offset,
        // increment limit to see if there are any items on the next page
        limit: limit + 1,
        include: {
          ...this.includeTags,
          duplicating: false
        }
      });
    } else if (globalSearchMode) {
      this.log.trace(`[${moduleName}]: Starting partial global search in entities`);

      // We use SqlString.escape() to prevent SQL injection
      // when passing user "searchFor" input to Sequelize.literal() function

      // Simple SQL Injection escaping
      const searchForEscapedInjection = SqlString.escape(searchFor, '', 'postgres');

      // Escape _ and % characters to prevent wrong
      // results using like/ilike, then prepare format
      // for ilike (adding it between `%%`)
      const searchForPartial = searchFor.replace(/_/g, '\_').replace(/%/g, '\%');
      const searchForEscapedIlike = `%${searchForPartial}%`;

      // SQL Injection escaping that applies on top of the
      // iLike search expression
      const searchForEscapedIlikeAndInjection = SqlString
        .escape(searchForEscapedIlike, '', 'postgres');

      // Columns to search in are listed in order
      // of their priority in the following array
      const columnsSearchFor = ['name', 'resource_name', 'resource_id', 'resource_type'];

      results = await this.table[queryFunc].call(this.table, {
        attributes: {
          include: [Sequelize.literal(
            // Here we add a new column called ORDER_PRIORITY, whose values
            // depend on these cases. We then order ascending by this column
            // to get exact matches first, then partial matches next.
            // Check line somewhere below saying [Sequelize.literal('ORDER_PRIORITY')]
            `CASE
              WHEN "entities"."name" = ${searchForEscapedInjection} THEN 1
              WHEN "entities"."resource_name" = ${searchForEscapedInjection} THEN 2
              WHEN "entities"."resource_id" = ${searchForEscapedInjection} THEN 3
              WHEN "entities"."resource_type" = ${searchForEscapedInjection} THEN 4
              -- // This improves the search ordering but the cost is about 50% more execution time
              WHEN "entities"."name" ilike ${searchForEscapedIlikeAndInjection} THEN 5
              WHEN "entities"."resource_name" ilike ${searchForEscapedIlikeAndInjection} THEN 6
              WHEN "entities"."resource_id" ilike ${searchForEscapedIlikeAndInjection} THEN 7
              WHEN "entities"."resource_type" ilike ${searchForEscapedIlikeAndInjection} THEN 8
            END AS ORDER_PRIORITY`
          )]
        },
        where: {
          [Op.or]: columnsSearchFor.map(column => (
            { [column]:
              {
                [Op.iLike]: searchForEscapedIlike
              }
            }
          )),
          [Op.and]: [
            {
              status: {
                [Op.ne]: 'disabled'
              }
            },
            where
          ]
        },
        order: [
          // Assign higher sort order if the name is an
          // exact match for the search term
          // We use Sequelize.literal() because a simple order
          // results in a broken SQL query from Sequelize
          [Sequelize.literal('ORDER_PRIORITY')],
          // Otherwise we have a default alphabetic
          // case-insensitive sort by name
          ...columnsSearchFor.map(column => (
            [Sequelize.fn('LOWER', Sequelize.col(`entities.${column}`)), 'ASC']
          ))
        ],
        offset,
        // increment limit to see if there are any items on the next page
        limit: limit + 1,
        include: this.includeTags,
        // This will tell findAndCountAll() to count entities
        // instead of number of associations
        distinct: true
      });
    } else {
      this.log.trace(`[${moduleName}]: Listing entities with standard filtering`);
      results = await this.table[queryFunc].call(this.table, {
        order,
        where,
        offset,
        limit: limit + 1,
        include: this.includeTags,
        distinct: true
      });
    }

    let output = showTotalItems ? results?.rows : results;

    // Set 'end' flag to false if there are any items on the next page
    let end = true;
    if (output.length > limit) {
      end = false;

      // Remove last item, was used only for checking next page availability
      output.pop();
    }

    const pageCount = output.length;
    this.log.info(`[${moduleName}]: Found ${pageCount} entities`);

    output = await Promise.all(output.map(
      entity => this.entityUtils.addExtraEntityDataAsync(entity)
    ));

    const metadata = {
      count: pageCount,
      end,
      total_items: showTotalItems ? results?.count : undefined
    };

    return { output, metadata };
  }

  /**
   * Get a file or folder
   *
   * @param {string} uuid - entity UUID
   * @returns {object} requested entity
   * @async
   */
  async getOneAsync(uuid) {
    const instance = await this.table.findOne({
      where: { uuid },
      include: this.includeTags
    });

    const outcome = instance?.uuid ? 'found' : 'not found';
    this.log.trace(`[${moduleName}]: Instance with uuid ${uuid} ${outcome}`);

    if (!instance?.uuid) {
      this.utils.httpErrors.throwNotFound('Instance not found', { errClass: this.errClass });
    }

    const result = await this.entityUtils.addExtraEntityDataAsync(instance, true);
    return result;
  }

  /**
   * Create a folder
   *
   * @param {object} data - folder metadata
   * @returns {object} created folder entity
   * @async
   */
  async createOneAsync(data) {
    // Check if there is a folder or file with the same name in the target folder
    const duplicate = await this.table.count(EntityService.getFilterForUniqueness(data));

    if (duplicate) {
      this.utils.httpErrors.throwConflict(
        'A folder or file with the name [{{fileName}}] already exists '
        + 'in the target folder',
        { errClass: this.errClass, params: { fileName: data.name } }
      );
    }

    this.log.trace(`[${moduleName}]: Trying to create a new folder`);

    const parent = data?.parent && await this.table.findOne({
      attributes: ['uuid', 'name', 'modified_by', 'status', 'bytes', 'local_path'],
      where: {
        uuid: data.parent
      },
      raw: true
    });

    let localPath = '';
    if (parent) {
      localPath = parent?.local_path.length
        ? `${parent.local_path}/${parent.name}`
        : parent.name;
    } else if (data.parent) {
      // A parent was specified with a valid UUID but it was not found in the DB
      this.utils.httpErrors.throwNotFound(
        'The specified parent folder does not exist', { errClass: this.errClass }
      );
    }

    const uuid = this.utils.UUID.v4();
    const bytes = 0;

    // TODO: Replace created/modified_by value with value
    // from logged user token when available
    const createdBy = this.utils.UUID.v4();
    const modifiedBy = this.utils.UUID.v4();

    // Creation and modification dates, and uuid generation are handled
    // internally by Sequelize
    const createdFolder = await this.table.create({
      ...data,
      uuid,
      created_by: createdBy,
      modified_by: modifiedBy,
      type: 'folder',
      content_type: null,
      priority: 0,
      storage_path: null,
      local_path: localPath,
      bytes,
      status: 'active'
    });

    const folderWithTags = await this.entityUtils.attachTagsToEntityAsync(
      createdFolder, data.tags || []
    );
    const outcome = createdFolder ? 'created successfully' : 'not created';
    this.log.info(`[${moduleName}]: Entity ${outcome}`);

    const output = await this.entityUtils.addExtraEntityDataAsync(folderWithTags, true);
    return output;
  }

  /**
   * Delete a list of entities
   *
   * @todo: Implement proper deletion of all associated resources
   * @todo: Determine what must be done with the file in Cloud Storage and CDN after deletion
   * @todo: Don't allow a stack to be deleted while it is generating or during replace or cropping
   *
   * @param {object} where - ORM formatted query filter
   * @returns { object } - object with properties:
   *   - metadata - information about deletion results
   * @async
   */
  async deleteManyAsync(where) {
    // Note: The tag associations are deleted when deleting entities via FK CASCADE on DELETE
    const count = await this.table.destroy({ where }) || 0;
    this.log.info(`[${moduleName}]: Deleted ${count} entities`);
    return { metadata: { count } };
  }

  /**
   * Delete an entity
   *
   * @todo: Implement proper deletion of all associated resources
   * @todo: Determine what must be done with the file in Cloud Storage and CDN after deletion
   * @todo: Don't allow a stack to be deleted while it is generating or during replace or cropping
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
   * Default filter used when creating a new instance, to avoid duplicates
   *
   * @param {object} data - payload data
   * @returns {object} ORM formatted query for duplication
   * @async
   */
  static getFilterForUniqueness(data) {
    return {
      where: {
        name: data.name,
        parent: data.parent || null
      }
    };
  }
}
/**
 * Utils class used to manage sub-operations with entities
 */
export class EntityUtils {
  /**
   * @param {object} opts - parameters object
   * @param {object} opts.db - Sequelize instance
   * @param {object} opts.log - Fastify logger instance
   * @param {object} opts.utils - utils dictionary
   * @param {string} opts.cacheService - cache service class
   * @returns {object} class instance
   */
  constructor({ db, log, utils, cacheService }) {
    this.db = db;
    this.log = log;
    this.utils = utils;
    this.errClass = 107;
    this.cacheService = cacheService;
  }

  /**
   * Update size for a list of parents
   *
   * @param {array} folders - list of folders
   * @param {number} [bytes = 0] - bytes to increment folders size with
   * @returns {Promise<Array<object>>}
   * @private
   */
  async updateFoldersSizeAsync(folders, bytes = 0) {
    if (!folders?.length) return [];

    const folderUuids = folders.map(folder => folder.uuid);
    const [results] = await this.db.models.entities.increment(['bytes'], {
      by: bytes,
      where: {
        uuid: folderUuids
      },
      returning: false
    });

    // Invalidate cache for all lists and updated folders
    if (this.cacheService) {
      await Promise.all([
        this.cacheService.invalidateAllListsAsync(),
        ...folderUuids.map(folderUuid => (
          this.cacheService.invalidateItemOrPatternAsync({ uuid: folderUuid })
        ))
      ]);
    }

    return results;
  }

  /**
   * Connect multiple tags to their associated entity
   *
   * @param {object} entity - entity to attach tags to
   * @param {array} tags - list of tags to attach
   * @returns {Promise<array>}
   * @private
   */
  async attachTagsToEntityAsync(entity, tags) {
    this.log.trace('Attaching tags to entity');
    const plainEntity = entity.toJSON();

    if (!tags || !Array.isArray(tags) || !entity || !tags.length) {
      plainEntity.tags = [];
      return entity;
    }

    // Lower case tags before de-duplicating and attaching to entity
    const lowerCasedTags = tags.map(tag => tag.toLowerCase());

    // De-duplicate tags and eliminate falsy values
    const uniqueTags = [...new Set(lowerCasedTags.filter(Boolean))];

    await this.db.models.tags.bulkCreate(uniqueTags.map(tag => ({
      name: tag,
      uuid: this.utils.UUID.v4()
    })), {
      ignoreDuplicates: true
    });

    // The bulkCreate method only returns the newly created tags (some tags may already exist)
    // so we must call again a findAll to be able to retrieve all tags associated with the entity
    const tagsToAddList = await this.db.models.tags.findAll({
      where: {
        name: uniqueTags
      }
    });

    const newAssociations = await entity.addTags(tagsToAddList);
    this.log.trace(`A total of ${newAssociations.length} associations `
      + `where made for '${entity.name}'`);

    plainEntity.tags = tagsToAddList;
    return plainEntity;
  }

  /**
   * Get all parents for the specified entity instance, recursively
   *
   * @param {object} instance - target instance
   * @param {array} attributes - attributes to return for entity
   * @param {array} [includeSelf = true] - if true include specified instance too
   * @returns {Promise<Array<object>>} - list of parent entity instances
   */
  async getParentsOfInstanceAsync(
    instance,
    attributes = ['uuid', 'name', 'parent'],
    includeSelf = true
  ) {
    const ancestors = includeSelf ? [instance] : [];

    let handlerInstance = instance;
    while (handlerInstance.parent) {
      // eslint-disable-next-line no-await-in-loop
      handlerInstance = await this.db.models.entities.findOne({
        attributes,
        where: {
          uuid: handlerInstance.parent
        }
      });
      if (!handlerInstance) break;
      ancestors.unshift(handlerInstance);
    }
    return ancestors;
  }

  /**
   * Add extra fields to entity
   *
   * @param {object} instance - entity instance
   * @param {boolean} addBreadcrumbs - if true, breadcrumbs list is added
   * @returns {object} augmented instance
   */
  async addExtraEntityDataAsync(instance, addBreadcrumbs = false) {
    // The original instance object may not be editable so we have to copy it
    // because we have to modify a property after post-processing
    const processedInstance = instance.get ? { ...instance.get({ plain: true }) } : instance;

    if (addBreadcrumbs) {
      this.log.trace(`Retrieving breadcrumbs for entity with uuid [${instance.uuid}]`);
    }

    Object.assign(processedInstance, {
      modified_by: {
        name: this.utils.userUtils.getFullName(instance.modified_by),
        uuid: instance.modified_by
      },
      created_by: {
        name: this.utils.userUtils.getFullName(instance.created_by),
        uuid: instance.created_by
      },
      tags: processedInstance?.tags?.map(({ name }) => name) || [],
      breadcrumbs: addBreadcrumbs
        ? await this.getParentsOfInstanceAsync(instance, ['uuid', 'name', 'parent'], false)
        : undefined
    });

    return processedInstance;
  }

  /**
   * @param {string} viewport the parent of the entity
   * @param {Object} rootFile the uploaded file
   * @param {Object} entityData entity information
   * @returns {Object} the newly created entity
   */
  async createViewportFolder(viewport, rootFile, entityData) {
    this.log.info(`Creating viewport folder for ${viewport}`);
    const { local_path: rootLocalPath, name: rootName, bytes } = rootFile;
    const { storage_path: storagePath, width, height } = rootFile;
    const localPath = rootLocalPath ? `${rootLocalPath}/${rootName}` : rootName;
    const status = 'active';
    const type = `folder:${viewport}`;
    const { UUID } = this.utils;
    const uuid = UUID.v4();
    const [modifiedBy, createdBy] = [UUID.v4(), UUID.v4()];

    return this.db.models.entities.create({
      // Initially every viewport source starts as being the root image with no crop
      // Thus we save the same image metadata in every viewport file
      // as in the root stack entity
      storage_path: storagePath,
      local_path: localPath,
      preview_path: `${rootFile.uuid}/${viewport}/preview/1/${rootName}`,
      width,
      height,
      bytes,
      crop_width: 0,
      crop_height: 0,
      crop_offset_x: 0,
      crop_offset_y: 0,
      image_version: 1,
      ...entityData,
      name: viewport,
      uuid,
      modified_by: modifiedBy,
      created_by: createdBy,
      type,
      priority: 0,
      status
    });
  }

  /**
   *
   * @param {string} usage - usage for the file
   * @param {string} resourceType - resource type where the file is used
   * @param {string[]} allowedResources - array of allowed resource types defined in config
   * @returns {void}
   */
  checkResourceType(usage, resourceType, allowedResources) {
    if (!allowedResources.some(resource => resource === resourceType)) {
      this.utils.httpErrors.throwBadRequest(
        'Resource type [{{resourceType}}] is not allowed for [{{usage}}] usage',
        { errClass: this.errClass, params: { resourceType, usage } }
      );
    }
  }

  /**
   * Returns resource and resize info based on usage/service used
   *
   * @param {Object} resizeConfig - resize config for each module and viewport
   * @param {string} fileUsage - module where the file is used in
   * @param {string} resourceId - id of the resource where the file is used
   * @param {string} resourceType - type of resource
   * @param {string} resName - name of the resource
   * @returns {Object}
   */
  getFileUsage(resizeConfig, fileUsage, resourceId, resourceType, resName) {
    this.log.info('Checking file usage');
    const resizeOptions = resizeConfig[fileUsage];
    const usages = Object.keys(resizeConfig);
    if (!resizeOptions) {
      this.utils.httpErrors.throwBadRequest(
        'File usage must be one of [{{usages}}]!',
        { errClass: this.errClass, params: { usages } }
      );
    }
    const generateStack = Boolean(resizeOptions.variant_resolutions);

    if (fileUsage === 'dam') {
      resizeOptions.variant_resolutions = {};
      return {
        entityData: {
          usage: fileUsage,
          stack_status: 'empty',
          type: 'stack:empty'
        },
        generateStack,
        resizeOptions
      };
    }

    if (!resourceType) {
      this.utils.httpErrors.throwBadRequest(
        'Resource type must be specified for usage [{{usage}}]!',
        { errClass: this.errClass, params: { usage: fileUsage } }
      );
    }

    this.checkResourceType(fileUsage, resourceType, resizeOptions.resource_types);

    return {
      entityData: {
        usage: fileUsage,
        stack_status: 'pending',
        type: 'stack:empty',
        resource_id: resourceId,
        resource_type: resourceType,
        resource_name: resName
      },
      generateStack,
      resizeOptions
    };
  }
}
/**
 * Utils class used to manage configurations for stack generation
 */
export class ConfigUtils {
  /**
   * @param {object} opts - object containing parameters
   * @param {object} opts.db - Sequelize instance
   * @param {object} opts.httpErrors - helper class for constructing error messages
   * @param {object} opts.log - fastify logger instance
   * @param {object} opts.stackRouteSchemas - reference to the stack route schemas object
   * @returns {object} class instance
   */
  constructor({ db, httpErrors, log, stackRouteSchemas }) {
    this.db = db;
    this.httpErrors = httpErrors;
    this.log = log;
    this.errClass = 104;
    this.stackRouteSchemas = stackRouteSchemas;
  }

  /**
   * Returns the configuration for each module
   *
   * @returns {Promise<object>} - the object containing the resize options for each module
   */
  async getConfig() {
    this.log.info('Retrieving config from DB');
    const configurations = await this.db.models.config.findAll({
      raw: true,
      attributes: { exclude: ['created_by', 'modified_by'] }
    });

    if (!configurations.length) {
      this.httpErrors.throwInternalServerError('Configuration is not defined');
    }

    const resizeOptions = {};
    configurations.forEach(config => {
      const { id, ...restOfConfig } = config;
      resizeOptions[id] = restOfConfig;
    });

    return resizeOptions;
  }

  /**
   *
   * @returns {object} - contains usageModules, resourceTypes and enabledUsageModules
   */
  async getUsageAndResourceTypes() {
    this.log.info('Getting usage and resource types');

    const newConfig = await this.getConfig();

    const usageModules = Object.keys(newConfig);
    const enabledUsageModules = [];
    let resourceTypes = [];

    usageModules.forEach(usage => {
      const moduleUsage = newConfig[usage];
      if (moduleUsage.resource_types) {
        resourceTypes = resourceTypes.concat(moduleUsage.resource_types);
      }
      if (moduleUsage.variant_resolutions && Object.keys(moduleUsage.variant_resolutions).length) {
        enabledUsageModules.push(usage);
      }
    });

    return {
      usageModules,
      enabledUsageModules: [...new Set(enabledUsageModules.filter(Boolean))],
      resourceTypes: [...new Set(resourceTypes.filter(Boolean))]
    };
  }

  /**
   * Function to update usage and resourceTypes for stack related schemas
   *
   * @param {object} stackSchemas - decorated object containing stack related schemas
   * @returns {void}
   */
  async updateStackSchemas() {
    this.log.info('Updating stack related schemas');
    const { createStack, upload } = this.stackRouteSchemas;
    const {
      usageModules,
      enabledUsageModules,
      resourceTypes
    } = await this.getUsageAndResourceTypes();

    upload.querystring.properties.usage.enum = usageModules;
    upload.querystring.properties.resource_type.enum = resourceTypes;
    createStack.body.properties.resource_type.enum = resourceTypes;
    createStack.body.properties.usage.enum = enabledUsageModules;
  }

  /**
   * Check that the aspect ratio of a new image is the same
   *
   * @param {number} widthOne - width of the current image
   * @param {number} heightOne - height of the current image
   * @param {number} widthTwo - width of the new image
   * @param {number} heightTwo - height of the new image
   * @returns {boolean} true if aspect ratio is the same, false if not
   *
   * @example
   * // Example scenario
   * // Current resolution: 1080x700
   * // New resolution: 960x600
   * // 1080 (current width) --> 960 (new width)
   * // 700 (current height) --> 600 (new height)
   * // If the aspect ratio is the same, the cross products should be the same.
   * // We can derive one of these values as the expected ideal value (960) and then
   * // compare it with the actual value and see if they are the same within 1 pixel.
   * // 1080*600/700 = x and we want that Math.abs(x - 960) < 1
   * //
   * // Function call:
   * checkAspectRatioIsSame(1080, 700, 960, 600)
   */
  static checkAspectRatioIsSame(widthOne, heightOne, widthTwo, heightTwo) {
    if (!widthOne || !heightOne || !widthTwo || !heightTwo) {
      return 'Input is invalid or incomplete';
    }

    // Assume by default that the first resolution is bigger
    let [biggerWidth, biggerHeight, smallerWidth, smallerHeight]
      = [widthOne, heightOne, widthTwo, heightTwo];

    if (widthOne * heightOne < widthTwo * heightTwo) {
      [biggerWidth, biggerHeight, smallerWidth, smallerHeight]
      = [widthTwo, heightTwo, widthOne, heightOne];
    }

    const baseCalcWidth = (biggerWidth * smallerHeight) / biggerHeight;
    const deviationAcceptedWidth = Math.abs(baseCalcWidth - smallerWidth) < 1;

    const baseCalcHeight = (biggerHeight * smallerWidth) / biggerWidth;
    const deviationAcceptedHeight = Math.abs(baseCalcHeight - smallerHeight) < 1;

    return deviationAcceptedWidth || deviationAcceptedHeight;
  }

  /**
   * Function to validate aspect ratio of viewports
   *
   * @param {object} variantResolutions - variantResolutions object from post/patch request
   * @returns {void}
   * @example
   * // Check if aspect ratios are similar in viewports
   * // Example variantResolutions:
   *  let variant_resolutions: {
   *     desktop: {
   *       v1: { width: 1024, height: 768 },
   *       v2: { width: 1920, height: 1080 }
   *     },
   *     tablet: {
   *       v1: { width: 601, height: 962 },
   *       v2: { width:640, height: 980 }
   *     }
   *  }
   * // Function call:
   * validateConfigViewportsAspectRatio(variant_resolutions)
   */
  validateConfigViewportsAspectRatio(variantResolutions) {
    // Loop through variants
    Object.entries(variantResolutions).forEach(([viewport, viewportVersions]) => {
      // Skip to next viewport if it has one ore less than 1 versions
      // because we don't have 2 versions to compare ratios
      if (Object.keys(viewportVersions).length <= 1) {
        return;
      }

      const versionsList = Object.entries(viewportVersions);
      let mostPreciseResolution;
      let referencePixelCount = 0;

      // Code block to update mostPreciseResolution if the case
      versionsList.forEach(([viewportVersion, resolution]) => {
        const pixelCount = resolution.width * resolution.height;
        if (pixelCount > referencePixelCount) {
          mostPreciseResolution = resolution;
          referencePixelCount = pixelCount;
        }
      });

      // Compare resolutions to see if they are similar
      versionsList.forEach(([viewportVersion, resolution]) => {
        const aspectRatioIsSame = ConfigUtils.checkAspectRatioIsSame(
          mostPreciseResolution.width,
          mostPreciseResolution.height,
          resolution.width,
          resolution.height
        );
        if (!aspectRatioIsSame) {
          // Throw error if aspect ratio is different for on of
          // viewport version resolutions
          this.httpErrors.throwBadRequest(
            'Aspect ratio for viewport [{{viewport}}], version'
              + ' [{{viewportVersion}}] is inconsistent.'
              + ' All aspect ratios should be the same',
            { errClass: this.errClass, params: { viewport, viewportVersion } }
          );
        }
      });
    });
  }
}
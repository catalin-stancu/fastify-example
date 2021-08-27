/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Entities table
   */
  class Entity extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      // Connect entities -> tags
      db.models.entities.belongsToMany(db.models.tags, {
        through: db.models.entities_tags,
        foreignKey: 'entity_uuid',
        targetKey: 'uuid',
        sourceKey: 'uuid'
      });
      // Add the necessary associations for the Sequelize super many-to-many config
      db.models.entities.hasMany(db.models.entities_tags, {
        sourceKey: 'uuid',
        as: 'associatedTags',
        foreignKey: {
          name: 'entity_uuid'
        }
      });
    }
  }

  Entity.init({
    uuid: {
      type: DataTypes.UUID,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false
    },
    modified_by: {
      type: DataTypes.UUID,
      allowNull: false
    },
    parent: {
      type: DataTypes.UUID,
      allowNull: true
    },
    local_path: {
      type: DataTypes.STRING(1000),
      allowNull: false,
      defaultValue: ''
    },
    storage_path: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    // Emulated Enum to avoid the difficulties with updating ENUM columns
    type: {
      type: DataTypes.STRING(50),
      defaultValue: 'file',
      allowNull: false
    },
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
    // Maximum size is 255: https://datatracker.ietf.org/doc/html/rfc4288#section-4.2
    content_type: {
      type: DataTypes.STRING(255),
      defaultValue: null,
      allowNull: true
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false
    },
    // Emulated Enum to avoid the difficulties with updating ENUM columns
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'active',
      allowNull: false
    },
    bytes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    usage: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    preview_path: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    crop_width: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    crop_height: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    crop_offset_x: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    crop_offset_y: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    image_version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false
    },
    resource_id: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    resource_name: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    resource_type: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    stack_status: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    root_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null
    },
    stack_time_ms: {
      type: DataTypes.SMALLINT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'entities'
  });

  return Entity;
}
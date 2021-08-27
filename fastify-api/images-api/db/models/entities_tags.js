/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Entities - Tags junction table
   */
  class EntityTags extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      // Add the necessary associations for the Sequelize super many-to-many config
      db.models.entities_tags.belongsTo(db.models.entities, {
        targetKey: 'uuid',
        foreignKey: {
          name: 'entity_uuid'
        }
      });

      db.models.entities_tags.belongsTo(db.models.tags, {
        targetKey: 'uuid',
        foreignKey: {
          name: 'tag_uuid'
        }
      });
    }
  }

  EntityTags.init({
    entity_uuid: {
      type: DataTypes.UUID,
      allowNull: false
    },
    tag_uuid: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'entities_tags',
    timestamps: false
  });

  return EntityTags;
}
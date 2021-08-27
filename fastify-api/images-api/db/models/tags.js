/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Tags table
   */
  class Tag extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      // Connect tags -> entities
      db.models.tags.belongsToMany(db.models.entities, {
        through: db.models.entities_tags,
        foreignKey: 'tag_uuid',
        targetKey: 'uuid',
        sourceKey: 'uuid'
      });
      // Add the necessary associations for the Sequelize super many-to-many config
      db.models.tags.hasMany(db.models.entities_tags, {
        sourceKey: 'uuid',
        as: 'associatedEntities',
        foreignKey: {
          name: 'tag_uuid'
        }
      });
    }
  }

  Tag.init({
    uuid: {
      type: DataTypes.UUID,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'tags',
    timestamps: false
  });

  return Tag;
}
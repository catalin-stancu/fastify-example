/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Config table
   */
  class Config extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      // No assocations needed here. Keeping method for future needs.
    }
  }

  Config.init({
    id: {
      primaryKey: true,
      type: DataTypes.STRING,
      allowNull: false
    },
    min_rez_vertical: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    min_rez_horizontal: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    max_rez_vertical: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    max_rez_horizontal: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    variant_resolutions: {
      type: DataTypes.JSON,
      allowNull: true
    },
    global_background: {
      type: DataTypes.JSON,
      allowNull: true
    },
    resource_types: {
      type: DataTypes.JSON,
      allowNull: true
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false
    },
    modified_by: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'config',
    timestamps: false
  });

  return Config;
}
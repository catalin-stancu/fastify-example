/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Return Order Items table
   */
  class ReturnStatus extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
    }
  }

  ReturnStatus.init({
    id: {
      primaryKey: true,
      type: DataTypes.INTEGER,
      allowNull: false
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'return_statuses'
  });

  return ReturnStatus;
}
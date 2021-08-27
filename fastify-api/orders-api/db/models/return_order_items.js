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
  class ReturnOrderItem extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      const {
        return_order_items: returnOrderItems,
        returns,
        return_reasons: returnReasons
      } = db.models;

      returnOrderItems.belongsTo(returns, {
        foreignKey: 'return_id',
        targetKey: 'id'
      });

      returnOrderItems.hasOne(returnReasons, {
        foreignKey: 'id',
        sourceKey: 'return_reason_id'
      });
    }
  }

  ReturnOrderItem.init({
    return_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    pid: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    quantity: {
      type: DataTypes.SMALLINT,
      allowNull: false
    },
    // fk with predefined reasons
    return_reason_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'return_order_items'
  });

  return ReturnOrderItem;
}
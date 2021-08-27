/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Suborders table
   */
  class Suborder extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      const { suborders, orders, order_items: orderItems } = db.models;

      suborders.belongsTo(orders, {
        foreignKey: 'parent_order_id',
        targetKey: 'id'
      });

      suborders.hasMany(orderItems, {
        foreignKey: 'parent_suborder_id',
        sourceKey: 'id',
        as: 'orderItems'
      });
    }
  }

  Suborder.init({
    parent_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'suborders',
    timestamps: false
  });

  return Suborder;
}
/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Orders table
   */
  class Order extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      const { orders, addresses, suborders, returns } = db.models;

      orders.belongsTo(addresses, {
        foreignKey: 'shipping_address_id',
        targetKey: 'id',
        as: 'shippingAddress'
      });

      orders.belongsTo(addresses, {
        foreignKey: 'billing_address_id',
        targetKey: 'id',
        as: 'billingAddress'
      });

      orders.hasMany(suborders, {
        foreignKey: 'parent_order_id',
        sourceKey: 'id'
      });

      orders.hasMany(returns, {
        foreignKey: 'increment_id',
        sourceKey: 'increment_id',
        as: 'orderReturns'
      });
    }
  }

  Order.init({
    // This is the order number
    increment_id: {
      type: DataTypes.STRING(13),
      allowNull: false
    },
    total: {
      type: DataTypes.STRING(15),
      allowNull: false
    },
    discount: {
      type: DataTypes.STRING(15),
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: 'New'
    },
    client_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    registered_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    shipping_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    billing_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'orders'
  });

  return Order;
}
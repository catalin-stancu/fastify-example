/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Order Items table
   */
  class OrderItem extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      const { order_items: orderItems, suborders } = db.models;

      orderItems.belongsTo(suborders, {
        foreignKey: 'parent_suborder_id',
        targetKey: 'id'
      });
    }
  }

  OrderItem.init({
    parent_suborder_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    pid: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    product_parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    quantity: {
      type: DataTypes.SMALLINT,
      allowNull: false
    },
    vendor: {
      type: DataTypes.SMALLINT,
      allowNull: false
    },
    price: {
      type: DataTypes.STRING(15),
      allowNull: false
    },
    base_price: {
      type: DataTypes.STRING(15),
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
    url_key: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    image: {
      type: DataTypes.STRING(1000),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'order_items',
    timestamps: false
  });

  return OrderItem;
}
/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Returns table
   */
  class Return extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      const {
        orders,
        addresses,
        returns,
        return_order_items: returnOrderItems,
        return_statuses: returnStatuses,
        return_types: returnTypes,
        pickup_methods: pickupMethods
      } = db.models;

      returns.belongsTo(addresses, {
        foreignKey: 'pickup_address_id',
        targetKey: 'id',
        as: 'pickupAddress'
      });

      returns.hasMany(returnOrderItems, {
        foreignKey: 'return_id',
        sourceKey: 'id',
        as: 'returnItems'
      });

      returns.belongsTo(orders, {
        foreignKey: 'increment_id',
        targetKey: 'increment_id',
        as: 'orderReturns'
      });

      returns.hasOne(returnStatuses, {
        foreignKey: 'id',
        sourceKey: 'status_id'
      });

      returns.hasOne(returnTypes, {
        foreignKey: 'id',
        sourceKey: 'return_type_id'
      });

      returns.hasOne(pickupMethods, {
        foreignKey: 'id',
        sourceKey: 'pickup_method_id'
      });
    }
  }

  Return.init({
    return_suffix: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    return_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    increment_id: {
      type: DataTypes.STRING(13),
      allowNull: false
    },
    pickup_method_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    pickup_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    bank_account_beneficiary: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    customer_iban: {
      // Example: RO49AAAA1B31007593840000
      type: DataTypes.STRING(34),
      allowNull: true
    },
    customer_bank: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'returns'
  });

  return Return;
}
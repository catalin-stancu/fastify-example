/**
 * Load database model
 *
 * @param {Sequelize} sequelize - sequelize instance
 * @param {Sequelize.DataTypes} DataTypes - Valid sequelize column data types
 * @returns {void}
 */
export function load(sequelize, DataTypes) {
  /**
   * Class that defines the Addresses table
   */
  class Address extends sequelize.Model {
    /**
     * Helper method for defining associations, called during table instantiation
     * @param {Sequelize} db - sequelize database instance with all models
     *   as properties
     * @returns {void}
     */
    static associate(db) {
      const { addresses, orders } = db.models;

      addresses.hasOne(orders, {
        foreignKey: 'shipping_address_id',
        sourceKey: 'id'
      });
      addresses.hasOne(orders, {
        foreignKey: 'billing_address_id',
        sourceKey: 'id'
      });
    }
  }

  Address.init({
    recipient_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    recipient_phone: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    county: {
      type: DataTypes.STRING(32),
      allowNull: false
    },
    city: {
      type: DataTypes.STRING(32),
      allowNull: false
    },
    street: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    street_no: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    address_details: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    postcode: {
      type: DataTypes.STRING(6),
      allowNull: true
    },
    company_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    company_fiscal_code: {
      // Example: RO1234567890 or 1234567890
      type: DataTypes.STRING(12),
      allowNull: true
    },
    company_reg_no: {
      // Example: J40/1234567/2021
      type: DataTypes.STRING(16),
      allowNull: true
    },
    company_bank: {
      // Example: Second Bank
      type: DataTypes.STRING(100),
      allowNull: true
    },
    company_iban: {
      // Example: RO49AAAA1B31007593840000
      type: DataTypes.STRING(34),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'addresses',
    timestamps: false
  });

  return Address;
}
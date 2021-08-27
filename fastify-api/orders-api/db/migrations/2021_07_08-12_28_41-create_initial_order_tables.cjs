module.exports = {
  up: (queryInterface, DataTypes) => queryInterface.sequelize.transaction(async t => {
    await queryInterface.createTable('addresses', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
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
      transaction: t
    });

    // The orders table must be created after addresses
    // because it has FKs to it
    await queryInterface.createTable('orders', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
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
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      registered_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      modified_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      shipping_address_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'addresses',
          key: 'id'
        },
        onUpdate: 'RESTRICT',
        // In case the data is anonymized and the addresses
        // are deleted we may still want to keep the order
        onDelete: 'SET NULL'
      },
      billing_address_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'addresses',
          key: 'id'
        },
        onUpdate: 'RESTRICT',
        // Same as above
        onDelete: 'SET NULL'
      }
    }, {
      transaction: t
    });

    // Speed up queries after order number and ensure uniqueness
    await queryInterface.addIndex('orders', {
      unique: true,
      using: 'BTREE',
      fields: ['increment_id'],
      name: 'orders_increment_id_index_unique',
      transaction: t
    });

    // Speed up queries since orders can be sorted by this column
    await queryInterface.addIndex('orders', {
      unique: false,
      using: 'BTREE',
      fields: ['registered_at'],
      name: 'orders_registered_at_index',
      transaction: t
    });

    // Speed up queries since orders can be sorted by this column
    await queryInterface.addIndex('orders', {
      unique: false,
      using: 'BTREE',
      fields: ['created_at'],
      name: 'orders_created_at_index',
      transaction: t
    });

    // Index this because it's a foreign key. It is unique because
    // the relationship is 1:1. HASH indexes cannot be unique in PG so we use B-TREE
    await queryInterface.addIndex('orders', {
      unique: true,
      using: 'BTREE',
      fields: ['shipping_address_id'],
      name: 'orders_shipping_address_id_index_unique',
      transaction: t
    });

    // Index this because it's a foreign key. It is unique because
    // the relationship is 1:1. HASH indexes cannot be unique in PG so we use B-TREE
    await queryInterface.addIndex('orders', {
      unique: true,
      using: 'BTREE',
      fields: ['billing_address_id'],
      name: 'orders_billing_address_id_index_unique',
      transaction: t
    });

    // The suborders table must be created after orders
    // because it has FKs to it
    await queryInterface.createTable('suborders', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      parent_order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'RESTRICT',
        // If the parent order row is deleted, then the suborder
        // will be an orphan which cannot stand alone
        onDelete: 'CASCADE'
      }
    }, {
      transaction: t
    });

    // Index this because it's a foreign key
    await queryInterface.addIndex('suborders', {
      unique: false,
      using: 'HASH',
      fields: ['parent_order_id'],
      name: 'suborders_parent_order_id_index',
      transaction: t
    });

    // The order_items table must be created after suborders
    // because it has FK to it
    await queryInterface.createTable('order_items', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      parent_suborder_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'suborders',
          key: 'id'
        },
        onUpdate: 'RESTRICT',
        // If the parent suborder row is deleted, then the order item
        // will be an orphan which cannot stand alone
        onDelete: 'CASCADE'
      },
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      pid: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      parent_id: {
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
      transaction: t
    });

    // Index this because it's a foreign key
    await queryInterface.addIndex('order_items', {
      unique: false,
      using: 'HASH',
      fields: ['parent_suborder_id'],
      name: 'order_items_parent_suborder_id_index',
      transaction: t
    });
  }),

  down: queryInterface => queryInterface.sequelize.transaction(async t => {
    // We don't need to delete indexes manually like below because
    // DROP TABLE always removes any indexes, rules, triggers,
    // and constraints that exist for the target table
    //
    // await queryInterface.removeIndex(
    //     'orders',
    //     'orders_order_number_index_unique',
    //     {transaction: t}
    // );

    // Delete tables in their bottom-up dependency order
    await queryInterface.dropTable('order_items', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('suborders', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('orders', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('addresses', {
      transaction: t,
      cascade: true
    });
  })
};
module.exports = {
  up: (queryInterface, DataTypes) => queryInterface.sequelize.transaction(async t => {
    await queryInterface.createTable('returns', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      return_suffix: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      status_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      return_type_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      increment_id: {
        type: DataTypes.STRING(13),
        allowNull: false,
        references: {
          model: 'orders',
          key: 'increment_id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'CASCADE'
      },
      pickup_method_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      pickup_address_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'addresses',
          key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'SET NULL'
      },
      customer_iban: {
        // Example: RO49AAAA1B31007593840000
        type: DataTypes.STRING(34),
        allowNull: true
      },
      customer_bank: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      bank_account_beneficiary: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      modified_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    }, {
      transaction: t
    });

    await queryInterface.addIndex('returns', {
      unique: false,
      using: 'HASH',
      fields: ['increment_id'],
      name: 'returns_increment_id_index',
      transaction: t
    });

    await queryInterface.addIndex('returns', {
      unique: false,
      using: 'HASH',
      fields: ['return_suffix'],
      name: 'returns_return_suffix_index',
      transaction: t
    });

    await queryInterface.addIndex('returns', {
      unique: false,
      using: 'HASH',
      fields: ['pickup_address_id'],
      name: 'returns_pickup_address_id_index',
      transaction: t
    });

    await queryInterface.createTable('return_order_items', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      return_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'returns',
          key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'CASCADE'
      },
      pid: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      quantity: {
        type: DataTypes.SMALLINT,
        allowNull: false
      },
      return_reason_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      modified_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    }, {
      transaction: t
    });

    await queryInterface.createTable('return_statuses', {
      id: {
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      value: {
        type: DataTypes.STRING,
        allowNull: false
      }
    });

    await queryInterface.createTable('return_types', {
      id: {
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      value: {
        type: DataTypes.STRING,
        allowNull: false
      }
    });

    await queryInterface.createTable('pickup_methods', {
      id: {
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      value: {
        type: DataTypes.STRING,
        allowNull: false
      }
    });

    await queryInterface.createTable('return_reasons', {
      id: {
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      value: {
        type: DataTypes.STRING,
        allowNull: false
      }
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
    await queryInterface.dropTable('returns', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('return_order_items', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('return_statuses', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('return_types', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('pickup_methods', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('return_reasons', {
      transaction: t,
      cascade: true
    });
  })
};
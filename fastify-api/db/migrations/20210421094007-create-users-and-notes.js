'use strict';

module.exports = {
  up: async (queryInterface, DataTypes) => {
    return queryInterface.sequelize.transaction(async t => {
      await queryInterface.createTable('users', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER
        },
        uuid: {
          type: DataTypes.UUID,
          allowNull: false
        },
        firstname: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        lastname: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        created: {
          allowNull: false,
          type: DataTypes.DATE
        },
        modified: {
            allowNull: false,
            type: DataTypes.DATE
        }
      });

      // Speed up queries after UUID and EMAIL
      await queryInterface.addIndex('users', {
        unique: true,
        using: 'BTREE',
        fields: ['uuid'],
        name: 'users_uuid_index_unique',
        transaction: t
      });

      await queryInterface.addIndex('users', {
        unique: true,
        using: 'BTREE',
        fields: ['email'],
        name: 'users_email_index_unique',
        transaction: t
      });

      await queryInterface.createTable('notes', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER
        },
        uuid: {
          type: DataTypes.UUID,
          allowNull: false
        },
        title: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        description: {
            type: DataTypes.STRING(1000),
            allowNull: false
        },
        created: {
          allowNull: false,
          type: DataTypes.DATE
        },
        modified: {
            allowNull: false,
            type: DataTypes.DATE
        }
      });

      // Speed up queries after UUID
      await queryInterface.addIndex('notes', {
        unique: true,
        using: 'BTREE',
        fields: ['uuid'],
        name: 'notes_uuid_index_unique',
        transaction: t
      });
    })
  },
  down: (queryInterface) => {
    return queryInterface.sequelize.transaction(async t => {
        // Delete tables in their bottom-up dependency order
        await queryInterface.dropTable('users', {
            transaction: t,
            cascade: true
        });

        await queryInterface.dropTable('notes', {
            transaction: t,
            cascade: true
        });
    });
  }
};
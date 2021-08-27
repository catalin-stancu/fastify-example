module.exports = {
  up: (queryInterface, DataTypes) => queryInterface.sequelize.transaction(async t => {
    // First create table with directory entities (folders or files)
    await queryInterface.createTable('entities', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      description: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false
      },
      modified_by: {
        type: DataTypes.UUID,
        allowNull: false
      },
      parent: {
        type: DataTypes.UUID,
        allowNull: true
      },
      local_path: {
        type: DataTypes.STRING(1000),
        allowNull: false,
        defaultValue: ''
      },
      storage_path: {
        type: DataTypes.STRING(1000),
        allowNull: true
      },
      // Emulated Enum to avoid the difficulties with updating ENUM columns
      type: {
        type: DataTypes.STRING(50),
        defaultValue: 'file',
        allowNull: false
      },
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
      // Maximum size is 255: https://datatracker.ietf.org/doc/html/rfc4288#section-4.2
      content_type: {
        type: DataTypes.STRING(255),
        defaultValue: null,
        allowNull: true
      },
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false
      },
      // Emulated Enum to avoid the difficulties with updating ENUM columns
      status: {
        type: DataTypes.STRING(50),
        defaultValue: 'active',
        allowNull: false
      },
      bytes: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      usage: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      resource_id: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      resource_name: {
        type: DataTypes.STRING(1000),
        allowNull: true
      },
      resource_type: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      stack_status: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      root_uuid: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null
      },
      created: {
        type: DataTypes.DATE,
        allowNull: false
      },
      modified: {
        type: DataTypes.DATE,
        allowNull: false
      }
    }, {
      transaction: t
    });

    // Speed up queries after UUID. Referenced by the entities - tags junction table
    await queryInterface.addIndex('entities', {
      unique: true,
      using: 'BTREE',
      fields: ['uuid'],
      name: 'entities_uuid_index_unique',
      transaction: t
    });

    // Create table that stores tags associated to directory entities
    await queryInterface.createTable('tags', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      }
    }, {
      transaction: t
    });

    // Referenced by the entities - tags junction table
    await queryInterface.addIndex('tags', {
      unique: true,
      using: 'BTREE',
      fields: ['uuid'],
      name: 'tags_uuid_index_unique',
      transaction: t
    });

    // Constrain tag names to be unique to prevent duplicates
    await queryInterface.addIndex('tags', {
      unique: true,
      using: 'BTREE',
      fields: ['name'],
      name: 'tags_name_index_unique',
      transaction: t
    });

    // The entities - tags junction table must be created last because
    // it has FK to the entities and tags tables
    await queryInterface.createTable('entities_tags', {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        allowNull: false
      },
      entity_uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'entities',
          key: 'uuid'
        },
        onUpdate: 'RESTRICT',
        // If a tag or entity is deleted we definitely want to delete the association
        onDelete: 'CASCADE'
      },
      tag_uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tags',
          key: 'uuid'
        },
        onUpdate: 'RESTRICT',
        // If a tag or entity is deleted we definitely want to delete the association
        onDelete: 'CASCADE'
      }
    }, {
      transaction: t
    });

    // Index this because it's a foreign keys pair. It is unique to avoid duplicate
    // associations. HASH indexes cannot be unique in PG so we use B-TREE
    await queryInterface.addIndex('entities_tags', {
      unique: true,
      using: 'BTREE',
      fields: ['entity_uuid', 'tag_uuid'],
      name: 'entities_tags_composed_index_unique',
      transaction: t
    });

    // Create table that stores config
    await queryInterface.createTable('config', {
      id: {
        primaryKey: true,
        type: DataTypes.STRING,
        allowNull: false
      },
      min_rez_vertical: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      min_rez_horizontal: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      max_rez_vertical: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      max_rez_horizontal: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      variant_resolutions: {
        type: DataTypes.JSON,
        allowNull: true
      },
      global_background: {
        type: DataTypes.JSON,
        allowNull: true
      },
      resource_types: {
        type: DataTypes.JSON,
        allowNull: true
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false
      },
      modified_by: {
        type: DataTypes.UUID,
        allowNull: false
      }
    }, {
      transaction: t
    });
  }),

  down: queryInterface => queryInterface.sequelize.transaction(async t => {
    // Delete tables in their bottom-up dependency order
    await queryInterface.dropTable('entities', {
      transaction: t,
      cascade: true
    });

    // We don't need to delete indexes manually like below because
    // DROP TABLE always removes any indexes, rules, triggers,
    // and constraints that exist for the target table
    //
    // await queryInterface.removeIndex(
    //     'entities',
    //     'entities_uuid_index_unique',
    //     {transaction: t}
    // );

    await queryInterface.dropTable('tags', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('entities_tags', {
      transaction: t,
      cascade: true
    });

    await queryInterface.dropTable('config', {
      transaction: t,
      cascade: true
    });
  })
};
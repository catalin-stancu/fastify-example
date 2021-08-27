module.exports = {
  up: (queryInterface, DataTypes) => queryInterface.sequelize.transaction(async t => {
    await Promise.all([
      queryInterface.addColumn('entities', 'preview_path', {
        type: DataTypes.STRING(1000),
        allowNull: true
      }, { transaction: t }),

      queryInterface.addColumn('entities', 'crop_width', {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
      }, { transaction: t }),

      queryInterface.addColumn('entities', 'crop_height', {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
      }, { transaction: t }),

      queryInterface.addColumn('entities', 'crop_offset_x', {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
      }, { transaction: t }),

      queryInterface.addColumn('entities', 'crop_offset_y', {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
      }, { transaction: t }),

      queryInterface.addColumn('entities', 'image_version', {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false
      }, { transaction: t }),

      queryInterface.removeColumn('entities', 'description', { transaction: t })
    ]);
  }),

  down: (queryInterface, DataTypes) => queryInterface.sequelize.transaction(async t => {
    await Promise.all([
      queryInterface.removeColumn('entities', 'preview_path', { transaction: t }),
      queryInterface.removeColumn('entities', 'crop_width', { transaction: t }),
      queryInterface.removeColumn('entities', 'crop_height', { transaction: t }),
      queryInterface.removeColumn('entities', 'crop_offset_x', { transaction: t }),
      queryInterface.removeColumn('entities', 'crop_offset_y', { transaction: t }),
      queryInterface.removeColumn('entities', 'image_version', { transaction: t }),
      queryInterface.addColumn('entities', 'description', {
        type: DataTypes.STRING(100),
        allowNull: true
      }, { transaction: t })
    ]);
  })
};
module.exports = {
  up: (queryInterface, DataTypes) => queryInterface.sequelize.transaction(async t => {
    await Promise.all([
      queryInterface.addColumn('entities', 'stack_time_ms', {
        type: DataTypes.SMALLINT,
        allowNull: true
      }, { transaction: t })
    ]);
  }),

  down: (queryInterface, DataTypes) => queryInterface.sequelize.transaction(async t => {
    await Promise.all([
      queryInterface.removeColumn('entities', 'stack_time_ms', { transaction: t })
    ]);
  })
};
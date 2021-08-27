module.exports = {
  up: queryInterface => queryInterface.sequelize.transaction(async t => {
    await Promise.all([
      queryInterface.renameColumn('entities', 'created', 'created_at', { transaction: t }),
      queryInterface.renameColumn('entities', 'modified', 'modified_at', { transaction: t })
    ]);
  }),

  down: queryInterface => queryInterface.sequelize.transaction(async t => {
    await Promise.all([
      queryInterface.renameColumn('entities', 'created_at', 'created', { transaction: t }),
      queryInterface.renameColumn('entities', 'modified_at', 'modified', { transaction: t })
    ]);
  })
};
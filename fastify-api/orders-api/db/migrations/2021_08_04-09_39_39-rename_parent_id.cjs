module.exports = {
  up: queryInterface => queryInterface.sequelize.transaction(async t => {
    await queryInterface.renameColumn('order_items', 'parent_id', 'product_parent_id', {
      transaction: t
    });
  }),

  down: queryInterface => queryInterface.sequelize.transaction(async t => {
    await queryInterface.renameColumn('order_items', 'product_parent_id', 'parent_id', {
      transaction: t
    });
  })
};
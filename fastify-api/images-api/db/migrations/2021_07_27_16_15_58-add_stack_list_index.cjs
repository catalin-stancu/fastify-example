module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.sequelize.transaction(async t => {
    await Promise.all([
      // A simple root_uuid BTREE index speeds up stack url queries by 30% compared with no index
      // A cover index on root_uuid that includes "storage_path", "width",
      // "height", "type" takes an extra 30% of the table size (14 times more than a basic index)
      // for a few percentages of speed-up of stack url queries.

      // Use psql to examine the index and table sizes:
      // Intro: https://www.postgresqltutorial.com/psql-commands/
      // Official docs: https://www.postgresql.org/docs/13/app-psql.html
      queryInterface.addIndex('entities', {
        unique: false,
        // In measurements a BTREE index takes much less space than using a HASH index
        using: 'BTREE',
        fields: ['root_uuid'],
        name: 'entities_root_uuid_partial_index',
        // Use a partial index to avoid indexing NULL values
        // (minor improvement in index size and speed)
        where: {
          root_uuid: {
            [Sequelize.Op.not]: null
          }
        },
        transaction: t
      })
    ]);
  }),

  down: queryInterface => queryInterface.sequelize.transaction(async t => {
    await Promise.all([
      queryInterface.removeIndex('entities', 'entities_root_uuid_partial_index', { transaction: t })
    ]);
  })
};
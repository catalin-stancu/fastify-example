import fp from 'fastify-plugin';
import Sequelize from 'sequelize';
import SqlString from 'sequelize/lib/sql-string.js';
import SequelizeDeprecations from 'sequelize/lib/utils/deprecations.js';
import importModulesPlugin from './importModules.js';

const { Op, Transaction, DataTypes, QueryTypes, Model } = Sequelize;

/*
  Usage of operator aliases triggers a Sequelize warning in the logs
  `[SEQUELIZE0003] DeprecationWarning: String based operators are deprecated.
  Please use Symbol based operators for better security`. In our case we
  are secure because we don't deserialize using JSON.parse() any client input
  strings to objects so the client cannot inject anything using them.
  It only becomes a problem with this: "Most web frameworks in Node.js allow
  parsing a object like string to actual JS object".
  See https://github.com/sequelize/sequelize/issues/8417
*/
SequelizeDeprecations.noStringOperators = () => {};
const operatorsAliases = {
  $eq: Op.eq,
  $ne: Op.ne,
  $gte: Op.gte,
  $gt: Op.gt,
  $lte: Op.lte,
  $lt: Op.lt,
  $in: Op.in,
  $like: Op.like,
  $ilike: Op.iLike,
  $and: Op.and,
  $or: Op.or
};

/**
 * This plugin performs query filter parsing
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.tableDefsFullPath - directory with table definitions
 * @param {object} opts.sequelizeOptions - sequelize instance options overrides
 * @param {string} [opts.ignoreFilesOrFolders = ''] - ignore files or folders
 *   that are equal to this value (for files the .js extension is appended
 *   automatically)
 * @param {function} [opts.importModules = importModulesPlugin] - plugin used
 *   to import files / modules, if you want to override the default one
 * @param {string} opts.POSTGRES_HOST - PostgreSQL server hostname
 * @param {string} opts.POSTGRES_PORT - PostgreSQL server port
 * @param {string} opts.POSTGRES_USER - PostgreSQL user
 * @param {string} opts.POSTGRES_PASSWORD - PostgreSQL password
 * @param {string} opts.POSTGRES_DB - PostgreSQL database name to use
 * @returns {Promise<void>}
 * @async
 */
async function sequelizeAsync(fastify, opts) {
  const {
    tableDefsFullPath,
    sequelizeOptions,
    ignoreFilesOrFolders = '',
    importModules = importModulesPlugin
  } = opts;

  if (!tableDefsFullPath) {
    throw new TypeError('You should specify a directory with table definitions');
  }

  const {
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_DB
  } = fastify.env || opts;

  if (!POSTGRES_DB || !POSTGRES_USER || !POSTGRES_PASSWORD
    || !POSTGRES_HOST || !POSTGRES_PORT
  ) {
    throw new Error('You should configure POSTGRES_DB, POSTGRES_USER, '
      + 'POSTGRES_PASSWORD, POSTGRES_HOST and POSTGRES_PORT');
  }

  // Retrieve using dynamic imports an array of functions that
  // define table models: (sequelize instance, Sequelize.DataTypes) => model
  fastify.register(importModules, {
    ignoreFilesOrFolders,
    dir: tableDefsFullPath,
    decoratorName: 'tableModelModules'
  });

  await fastify.after();
  const { tableModelModules } = fastify;

  const db = new Sequelize(
    POSTGRES_DB,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    {
      host: POSTGRES_HOST,
      port: POSTGRES_PORT,
      dialect: 'postgres',
      operatorsAliases,
      // Default options used for every module definition
      define: {
        charset: 'utf8',
        dialectOptions: {
          collate: 'utf8_general_ci'
        },
        freezeTableName: true,
        underscored: true,
        // Enable and rename automatic timestamp columns
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'modified_at'
      },
      typeValidation: true,
      // Sequelize default pool configuration used to pool database connections
      pool: {
        max: 20,
        min: 5
      },
      ...sequelizeOptions
    }
  );

  // Add public classes to instance so that
  // we can access them from the decorator below
  db.Op = Op;
  db.QueryTypes = QueryTypes;
  db.Transaction = Transaction;
  db.Model = Model;
  db.Sequelize = Sequelize;
  db.SqlString = SqlString;

  await db.authenticate();
  fastify.log.info('Connection to database established successfully');

  // Iterate through each table and initialize it
  Object.values(tableModelModules).forEach(({ load }) => load(db, DataTypes));

  // Associate models
  Object.keys(db.models).forEach(modelName => {
    if (db.models[modelName].associate) {
      db.models[modelName].associate(db);
    }
  });

  fastify.log.info('The following database tables are registered in the app: '
    + `${Object.keys(db.models).join(', ')}`);

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => db.close().catch(() => {}));
}

export default fp(sequelizeAsync, {
  name: 'sequelize'
});
const fp = require('fastify-plugin');
const sequelize = require('sequelize');
const tablesDefinitions = require('../db/tables');

const op = sequelize.Op;
const operatorsAliases = {
    $eq: op.eq,
    $ne: op.ne,
    $gte: op.gte,
    $gt: op.gt,
    $lte: op.lte,
    $lt: op.lt,
    $in: op.in,
    $like: op.like,
    $ilike: op.iLike,
    $and: op.and,
    $or: op.or
};

// https://sequelize.org/master/class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor
const db = new sequelize.Sequelize(
    process.env.DB_REMOTE_DB_DEV,
    process.env.DB_REMOTE_SINGLE_USER,
    process.env.DB_REMOTE_SINGLE_PASS,
    {
        host: process.env.DB_LOCAL_HOST_DEV,
        port: process.env.DB_LOCAL_PORT_DEV,
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
            createdAt: 'created',
            updatedAt: 'modified'
        },
        typeValidation: true,
        // Sequelize default pool configuration used to pool database connections
        pool: {
            max: 5,
            min: 0
        }
    }
);

module.exports = fp(async (fastify, opts) => {
    try {
        await db.authenticate();
        fastify.log.info('Connection to database established successfully');

        // Iterate through each table and initialize it
        tablesDefinitions.forEach(load => {
            let model = load(db, sequelize.DataTypes);
            db[model.name] = model;
        });

        // Associate models
        Object.keys(db).forEach(modelName => {
            if (db[modelName].associate) {
                db[modelName].associate(db);
            }
        });
        fastify.log.info(`The following database tables are used by the app: ${db.modelManager.models.map(e => e.name)}`);
        fastify.decorate('db', db);
    } catch (error) {
        fastify.log.error('Unable to connect to database', error);
    }
}, {
    name: 'db'
});

'use strict'

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    /**
     * Class that defines the Users table
     */
    class User extends Model {
/**
         * Helper method for defining associations, called during table instantiation
         * @param {Sequelize} db - sequelize database instance with all models as properties
         * @returns {void}
         */
        static associate(db) {
            // Connect notes -> users
            db.users.hasMany(db.notes)
        }
    }

    User.init({
        uuid: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true
        },
        firstname: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                isAlphanumeric: true,
                len: [2, 50]
            }
        },
        lastname: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                isAlphanumeric: true,
                len: [2, 100]
            }
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
                len: [5, 100]
            }
        }
    }, {
        sequelize,
        modelName: 'users'
    });

    return User;
}
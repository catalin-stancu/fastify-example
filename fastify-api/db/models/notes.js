'use strict'

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    /**
     * Class that defines the Notes table
     */
    class Note extends Model {
        /**
         * Helper method for defining associations, called during table instantiation
         * @param {Sequelize} db - sequelize database instance with all models as properties
         * @returns {void}
         */
        static associate(db) {
            // Connect notes -> users
            db.notes.belongsTo(db.users, {
                foreignKey: 'user_uuid'
            })
        }
    }

    Note.init({
        uuid: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true
        },
        title: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        description: {
            type: DataTypes.STRING(1000),
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'notes'
    });

    return Note;
}
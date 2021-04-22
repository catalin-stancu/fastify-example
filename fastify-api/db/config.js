"use strict";

const {
    DB_LOCAL_HOST_DEV,
    DB_LOCAL_PORT_DEV,
    DB_REMOTE_SINGLE_USER,
    DB_REMOTE_SINGLE_PASS,
    DB_REMOTE_DB_DEV
} = process.env;

module.exports = {
    default: {
        username: 'admin',
        password: 'asd123',
        database: 'fastify',
        host: 'localhost',
        port: '5434',
        dialect: 'postgres'
    }
};
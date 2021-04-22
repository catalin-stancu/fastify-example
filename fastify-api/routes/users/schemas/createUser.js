const ErrorSchema = require('../../../utils/common-schemas/errorSchema')

const UserProperties = {
    firstname: {
        type: 'string',
        minLength: 2,
        maxLength: 50
    },
    lastname: {
        type: 'string',
        minLength: 2,
        maxLength: 100
    },
    email: {
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 50
    }
};

const UserBody = {
    type: 'object',
    required: ['firstname', 'lastname', 'email'],
    properties: UserProperties
};

const UserResponse = {
    type: 'object',
    properties: {
        ...UserProperties,
        uuid: {
            type: 'string'
        }
    }
};

const schema = {
    body: UserBody,
    response: {
        200: UserResponse,
        400: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
        500: ErrorSchema
    }
};

module.exports = {
    UserResponse,
    UserProperties,
    schema
};
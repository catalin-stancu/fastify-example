const ErrorSchema = require('../../../utils/common-schemas/errorSchema');
const idParamsSchema = require('../../../utils/common-schemas/idParamsSchema');
const { UserProperties, UserResponse } = require('./createUser');

const UserBody = {
    type: 'object',
    anyOf: [
        { required: ['firstname'] },
        { required: ['lastname'] },
        { required: ['email'] }
    ],
    properties: UserProperties
};

const schema = {
    params: idParamsSchema,
    body: UserBody,
    response: {
        200: UserResponse,
        400: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
        500: ErrorSchema
    }
};

module.exports = schema
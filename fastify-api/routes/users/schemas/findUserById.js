const { UserResponse } = require('./createUser')
const ErrorSchema = require('../../../utils/common-schemas/errorSchema')
const idParamsSchema = require('../../../utils/common-schemas/idParamsSchema');

const schema = {
    params: idParamsSchema,
    response: {
        200: UserResponse,
        404: ErrorSchema
    }
}

module.exports = schema;
const { UserResponse } = require('./createUser')

const schema = {
    response: {
        200: {
            type: 'array',
            items: UserResponse
        }
    }
}

module.exports = schema;
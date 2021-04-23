const { ValidationError } = require("sequelize");

const PostgresErrorCode = {
    UniqueViolation: '23505'
}

module.exports = (error, request, reply) => {
    reply.log.error(error);
    if (error?.parent?.code === PostgresErrorCode.UniqueViolation) {
        return reply.conflict(`User with this email already exists. ${error.parent.detail}`);
    }
    if (error instanceof ValidationError) {
        return reply.badRequest(error.errors?.map(err => err.message));
    }
    return reply.send(error);
}
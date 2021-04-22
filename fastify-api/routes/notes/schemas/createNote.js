const ErrorSchema = require('../../../utils/common-schemas/errorSchema')

const NoteProperties = {
    title: {
        type: 'string',
        minLength: 2,
        maxLength: 50
    },
    description: {
        type: 'string',
        minLength: 2,
        maxLength: 1000
    }
};

const NoteBody = {
    type: 'object',
    required: ['title', 'description'],
    properties: NoteProperties,
    additionalProperties: false
};

const NoteResponse = {
    type: 'object',
    properties: {
        ...NoteProperties,
        uuid: {
            type: 'string'
        }
    }
};

const schema = {
    body: NoteBody,
    response: {
        200: NoteResponse,
        400: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
        500: ErrorSchema
    }
};

module.exports = {
    NoteResponse,
    NoteProperties,
    schema
};
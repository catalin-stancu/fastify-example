const ErrorSchema = require('../../../utils/common-schemas/errorSchema');
const idParamsSchema = require('../../../utils/common-schemas/idParamsSchema');
const { NoteProperties, NoteResponse } = require('./createNote');

const NoteBody = {
    type: 'object',
    anyOf: [
        { required: ['title'] },
        { required: ['description'] }
    ],
    properties: NoteProperties,
    additionalProperties: false
};

const schema = {
    params: idParamsSchema,
    body: NoteBody,
    response: {
        200: NoteResponse,
        400: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
        500: ErrorSchema
    }
};

module.exports = schema
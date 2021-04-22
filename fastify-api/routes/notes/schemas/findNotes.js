const { NoteResponse } = require('./createNote')

const schema = {
    response: {
        200: {
            type: 'array',
            items: NoteResponse
        }
    }
}

module.exports = schema;
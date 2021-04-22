const {v4: uuidv4} = require('uuid');
const { NotFound } = require('http-errors');

class NotesService {

    constructor(model ,logger) {
        this.noteModel = model;
        this.logger = logger;
        if (!this.noteModel) throw new Error('Missing database table definition');
    }

    async findNotes(where = {}) {
        this.logger.info('Getting all notes');
        return this.noteModel.findAll(where);
    }

    async findById(noteId) {
        this.logger.info(`Get note with ID ${noteId}`);
        const note = await this.noteModel.findOne({ where: { uuid: noteId }});
        if (!note) {
            throw new NotFound(`Note with ID ${noteId} not found!`)
        }
        return note;
    }

    async createNote(noteData) {
        this.logger.info(`Creating note with payload: ${JSON.stringify(noteData)}`);
        const uuid = uuidv4();
        return this.noteModel.create({...noteData, uuid});
    }

    async updateNote(userId, noteId, updateNoteData) {
        this.logger.info(`Updating note with ID ${noteId}. Payload: ${JSON.stringify(updateNoteData)}`)
        const [rowsAffected, updatedNote] = await this.noteModel.update(updateNoteData, {
            where: { uuid: noteId, user_uuid: userId },
            returning: true
        });
        if (!rowsAffected) {
            throw new NotFound(`Note with ID ${noteId} not found!`)
        }
        return updatedNote[0];
    }
}

module.exports = NotesService;

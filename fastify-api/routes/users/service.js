const {v4: uuidv4} = require('uuid');
const { NotFound } = require('http-errors');

class UsersService {

    constructor(model, logger, notesService) {
        this.userModel = model;
        this.logger = logger;
        this.notesService = notesService;
        if (!this.userModel) throw new Error('Missing database table definition');
    }

    async findUsers() {
        this.logger.info('Getting all users');
        return this.userModel.findAll({ include: this.notesService.noteModel });
    }

    async findById(userId) {
        this.logger.info(`Get user with ID ${userId}`);
        const user = await this.userModel.findOne({ where: { uuid: userId }});
        if (!user) {
            throw new NotFound(`User with ID ${userId} not found!`)
        }
        return user;
    }

    async createUser(userData) {
        this.logger.info(`Creating user with payload: ${JSON.stringify(userData)}`);
        const uuid = uuidv4();
        return this.userModel.create({...userData, uuid});
    }

    async updateUser(userId, updateUserData) {
        this.logger.info(`Updating user with ID ${userId}. Payload: ${JSON.stringify(updateUserData)}`)
        const [rowsAffected, updatedUser] = await this.userModel.update(updateUserData, {
            where: { uuid: userId },
            returning: true
        });
        if (!rowsAffected) {
            throw new NotFound(`User with ID ${userId} not found!`)
        }
        return updatedUser[0];
    }

    async deleteUser(userId) {
        this.logger.info(`Deleting user with ID ${userId}`)
        const rowsAffected = await this.userModel.destroy({
            where: { uuid: userId }
        });
        if (!rowsAffected) {
            throw new NotFound(`User with ID ${userId} not found!`)
        }
    }

    async createNote(userId, notePayload) {
        this.logger.info(`User with ID ${userId} is creating a note. Payload ${JSON.stringify(notePayload)}`);
        const user = await this.findById(userId);
        return this.notesService.createNote({...notePayload, user_uuid: user.uuid});
    }

    async getNotesForUser(userId) {
        this.logger.info(`Get notes for user with ID ${userId}`);
        return this.notesService.findNotes({ where: { user_uuid: userId }});
    }

    async updateNote(userId, noteId, noteUpdatePayload) {
        this.logger.info(`User with ID ${userId} is updating note with ID ${noteId}`);
        return this.notesService.updateNote(userId, noteId, noteUpdatePayload);
    }
}

module.exports = UsersService;

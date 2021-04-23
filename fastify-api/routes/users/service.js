const {v4: uuidv4} = require('uuid');
const { NotFound } = require('http-errors');

class UsersService {

    constructor(model, logger, notesService, cacheService) {
        this.userModel = model;
        this.logger = logger;
        this.notesService = notesService;
        this.cacheService = cacheService;
        if (!this.userModel) throw new Error('Missing database table definition');
    }

    async findUsers() {
        this.logger.info('Getting all users');
        const cacheKey = `${this.userModel}:find`;
        const cacheResult = await this._checkCache(cacheKey);
        if (cacheResult) {
            return cacheResult;
        }
        const results = await this.userModel.findAll();
        this.logger.info('Caching the result');
        this.cacheService.set(cacheKey, results);
        return results;
    }

    async findById(userId) {
        this.logger.info(`Get user with ID ${userId}`);
        const cacheKey = `${this.userModel}:findById:${userId}`;
        const cacheResult = await this._checkCache(cacheKey);
        if (cacheResult) {
            return cacheResult;
        }
        const user = await this.userModel.findOne({ 
            where: { uuid: userId }, 
            include: this.notesService.noteModel 
        });
        if (!user) {
            throw new NotFound(`User with ID ${userId} not found!`)
        }
        this.logger.info('Caching the result');
        this.cacheService.set(cacheKey, user);
        return user;
    }

    async createUser(userData) {
        this.logger.info(`Creating user with payload: ${JSON.stringify(userData)}`);
        const uuid = uuidv4();
        const user = await this.userModel.create({...userData, uuid});
        this.logger.info('Invalidating cache for lists');
        this.cacheService.delete(`${this.userModel}:find`);
        return user;
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
        this.logger.info('Invalidating cache');
        this.cacheService.delete(`${this.userModel}:find`);
        this.cacheService.delete(`${this.userModel}:findById:${userId}`);
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
        this.logger.info('Invalidating cache');
        this.cacheService.delete(`${this.userModel}:find`);
        this.cacheService.delete(`${this.userModel}:findById:${userId}`);
    }

    async createNote(userId, notePayload) {
        this.logger.info(`User with ID ${userId} is creating a note. Payload ${JSON.stringify(notePayload)}`);
        const user = await this.findById(userId);
        const note = await this.notesService.createNote({...notePayload, user_uuid: user.uuid});
        this.logger.info('Invalidating cache');
        this.cacheService.delete(`${this.userModel}:findById:${userId}`);
        return note;
    }

    async getNotesForUser(userId) {
        this.logger.info(`Get notes for user with ID ${userId}`);
        return this.notesService.findNotes({ where: { user_uuid: userId }});
    }

    async updateNote(userId, noteId, noteUpdatePayload) {
        this.logger.info(`User with ID ${userId} is updating note with ID ${noteId}`);
        const note = await this.notesService.updateNote(userId, noteId, noteUpdatePayload);
        this.logger.info('Invalidating cache');
        this.cacheService.delete(`${this.userModel}:findById:${userId}`);
        return note;
    }

    async _checkCache(cacheKey) {
        this.logger.info('Checking cache for results');
        const foundInCache = await this.cacheService.get(cacheKey);
        if (foundInCache) {
            const ttl = await this.cacheService.ttl(cacheKey);
            this.logger.info(`Cache hit! Serving results from cache. TTL: ${ttl} seconds`);
            return foundInCache;
        }
        this.logger.info('Cache not hit. Query the DB');
    }
}

module.exports = UsersService;

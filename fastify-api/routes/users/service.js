const {v4: uuidv4} = require('uuid');
const { NotFound } = require('http-errors');

class UsersService {

    constructor(model ,logger) {
        this.userModel = model;
        this.logger = logger;
        if (!this.userModel) throw new Error('Missing database table definition');
    }

    async findUsers() {
        this.logger.info('Getting all users');
        return this.userModel.findAll();
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
}

module.exports = UsersService;

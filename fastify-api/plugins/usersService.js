const fp = require('fastify-plugin');
const UsersService = require('../routes/users/service');

module.exports = fp(async (fastify, opts) => {
    const usersService = new UsersService(
        fastify.db.users || null,
        fastify.log,
        fastify.notesService,
        fastify.cacheService
      );
    fastify.decorate('usersService', usersService);
}, {
    name: 'usersService',
    dependencies: ['notesService', 'db', 'cacheService']
});

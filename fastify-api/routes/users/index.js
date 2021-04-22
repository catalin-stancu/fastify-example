const createUserSchema = require('./schemas/createUser');
const updateUserSchema = require('./schemas/updateUser');
const findUsersSchema = require('./schemas/findUsers');
const findUserByIdSchema = require('./schemas/findUserById');
const UsersService = require('./service');

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
 const routes = async fastify => {
  const usersService = new UsersService(fastify.db.modelManager.getModel('users') || null, fastify.log);
  fastify.get(
    '/', 
    {
      schema: findUsersSchema
    },
    async () => {
      return usersService.findUsers();
    },
  );

  fastify.get(
    '/:id', 
    {
      schema: findUserByIdSchema
    },
    async (request) => {
      const { id } = request.params;
      return usersService.findById(id);
    },
  );

  fastify.post(
    '/',
    {
      schema: createUserSchema
    },
    async (request) => {
      return await usersService.createUser(request.body);
    },
  );

  fastify.put(
    '/:id',
    {
      schema: updateUserSchema
    },
    async (request) => {
      const { id } = request.params;
      return await usersService.updateUser(id, request.body);
    },
  );
};

module.exports = routes;
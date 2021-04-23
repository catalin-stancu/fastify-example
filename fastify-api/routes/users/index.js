const createUserSchema = require('./schemas/createUser');
const updateUserSchema = require('./schemas/updateUser');
const findUsersSchema = require('./schemas/findUsers');
const findUserByIdSchema = require('./schemas/findUserById');
const idParamsSchema = require('../../utils/common-schemas/idParamsSchema');
const createNoteSchema = require('../notes/schemas/createNote');
const findNotesSchema = require('../notes/schemas/findNotes');
const updateNoteSchema = require('../notes/schemas/updateNotes');

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
 const routes = async fastify => {
  const usersService = fastify.usersService

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

  fastify.delete(
    '/:id',
    {
      schema: {
        params: idParamsSchema
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      await usersService.deleteUser(id);
      reply.status(204);
    },
  );

  fastify.get(
    '/:id/notes',
    {
      schema: {
        ...findNotesSchema,
        params: idParamsSchema
      }
    },
    async (request) => {
      const { id } = request.params;
      return await usersService.getNotesForUser(id);
    },
  );

  fastify.post(
    '/:id/notes',
    {
      schema: {
        ...createNoteSchema,
        params: idParamsSchema
      }
    },
    async (request) => {
      const { id } = request.params;
      return await usersService.createNote(id, request.body);
    },
  );

  fastify.put(
    '/:id/notes/:noteId',
    {
      schema: {
        ...updateNoteSchema,
        params: {
          type: 'object',
          properties: {
            id: { 
                type: 'string',
                format: 'uuid'
            },
            noteId: {
              type: 'string',
              format: 'uuid'
            }
          }
        }
      }
    },
    async (request) => {
      const { id, noteId } = request.params;
      return await usersService.updateNote(id, noteId, request.body);
    },
  );
};

module.exports = routes;
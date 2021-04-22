const findNotesSchema = require('./schemas/findNotes');
const findNoteByIdSchema = require('./schemas/findNoteById');

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
 const routes = async fastify => {
  const notesService = fastify.notesService;
  fastify.get(
    '/', 
    {
      schema: findNotesSchema
    },
    async () => {
      return notesService.findNotes();
    },
  );

  fastify.get(
    '/:id', 
    {
      schema: findNoteByIdSchema
    },
    async (request) => {
      const { id } = request.params;
      return notesService.findById(id);
    },
  );
};

module.exports = routes;
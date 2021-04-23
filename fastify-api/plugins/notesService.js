const fp = require('fastify-plugin');
const NotesService = require('../routes/notes/service');

module.exports = fp(async (fastify, opts) => {
    const notesService = new NotesService(fastify.db.modelManager.getModel('notes') || null, fastify.log);
    fastify.decorate('notesService', notesService);
});

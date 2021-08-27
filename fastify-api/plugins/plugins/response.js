import fp from 'fastify-plugin';
import path from 'path';
import ResponseClass from '../services/response.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates the response formatter
 * For error handling see this the reference
 * [flow](https://www.fastify.io/docs/latest/Lifecycle/#reply-lifecycle)
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.appCode - application code number
 *   https://explorado.atlassian.net/wiki/spaces/EXP/pages/138805249/APP+info
 * @param {boolean} [opts.envIsProduction = true] - if true, uses a production setup
 *   e.g. internal errors are replaced with generic errors in production
 * @param {class} opts.Response - class used to handle responses, if you want
 *   to override the default one
 * @returns {Promise<void>}
 * @async
 */
async function responseAsync(fastify, opts) {
  const {
    appCode,
    envIsProduction = true,
    Response = ResponseClass
  } = opts;

  Response.setAppCode(appCode);
  fastify.decorate('Response', Response);

  /**
   * Custom error handler that standardizes error response structure
   *
   * By default all errors are internal server errors and if we use validation
   * or write custom code in our routes to handle them they can become client
   * errors. This makes sure that we don't treat unhandled / unexpected errors
   * as client errors or forget to handle them properly
   *
   * @param {Error} error - error object
   * @param {object} req - request object
   * @param {object} reply - reply object
   * @returns {Promise<void>}
   */
  function customErrorHandler(error, req, reply) {
    try {
      // We need to keep the logging of errors which was present in the default
      // fastify error handler, otherwise errors will not appear in the logs
      if ((reply.statusCode >= 500) || (reply.statusCode < 400)) {
        // Operational (internal) errors
        this.log.error(error);
      } else {
        // Client errors are displayed differently
        // If params are provided they are not displayed
        // in order to prevent log injection vulnerabilities
        const { message } = error;
        this.log.info(`Client error: ${message}`);
      }

      // Hide unexpected unhandled (internal) error messages in production
      const prodErrorObj = new Error('An unexpected error occurred. '
        + 'Contact the system admin');
      Object.assign(prodErrorObj, {
        localeNamespace: 'global',
        errClass: 1
      });

      const shownError = (envIsProduction && (reply.statusCode >= 500))
        ? prodErrorObj
        : error;

      Object.assign(shownError, {
        // Make sure that internal error codes are kept; even though they give clues
        // i.e. that some internal errors are different, it is useful in debugging
        internalCode: error.internalCode,
        errClass: error.errClass
      });

      const response = new Response(null);
      response.addError(shownError);
      reply.send(response);
    } catch (err) {
      this.log.error(err, 'Error in customErrorHandler() itself!');
      throw err;
    }
  }

  /**
   * Custom not found error handler with standard error response structure
   * Should not return data key at all according to document above
   *
   * @param {object} req - request object
   * @param {object} reply - reply object
   * @returns {Promise<void>}
   */
  async function notFoundHandlerAsync(req, reply) {
    const { url, method } = req;
    const message = 'Route {{routeName}} not found';
    req.log.info(message);

    const errorObj = new Error(message);
    Object.assign(errorObj, {
      localeNamespace: 'global',
      errClass: 1,
      params: {
        routeName: `${method} ${url}`
      }
    });

    const response = new Response();
    response.addError(errorObj);
    reply.code(404).send(response);
  }

  // Load custom response handlers in order of request lifecycle
  fastify.setNotFoundHandler(notFoundHandlerAsync);

  // We don't use the onError hook since it should be a side-effect only
  // https://www.fastify.io/docs/latest/Hooks/#onerror
  fastify.setErrorHandler(customErrorHandler);
}

export default fp(responseAsync, {
  name: moduleName
});
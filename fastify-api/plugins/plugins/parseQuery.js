import fp from 'fastify-plugin';
import {
  checkReservedColumnNames,
  deserializeFromQuerystring
} from '../services/parseQuery.js';
import { to, httpErrors } from '../services/utils.js';

/**
 * Pre-process all query params and construct them into
 * valid `where` and `order` route handler inputs
 *
 * @param {object} nullFilter - filter used to return no result
 *   in case no filter is provided when it is explicitly required
 *   e.g. for bulk delete/update
 * @returns {Function} Hook used to process query params and
 *   obtain the ORM filter expression
 */
function makeProcessQuery(nullFilter) {
  /**
   * Pre-process all query params and construct them
   * into valid `where` and `order` inputs
   *
   * @param {object} req - fastify request object
   * @param {object} reply - fastify reply object
   * @returns {Promise<void>}
   * @async
   */
  async function processQuery(req) {
    const {
      filterEnabledFor,
      sortingEnabledFor,
      filteringIsRequired,
      defaultFilter,
      defaultSort
    } = req.context?.config?.queryParsing || {};

    let where = {};
    let order = [];
    let isDefaultFilterOn = false;
    let isDefaultSortOn = false;

    const filterEnabled = filterEnabledFor?.length;
    const sortingEnabled = sortingEnabledFor?.length;

    if (filterEnabled || sortingEnabled) {
      const [parseError, result] = await to(() => deserializeFromQuerystring(
        req.query,
        filterEnabledFor,
        sortingEnabledFor
      ));

      if (parseError) {
        // Format expected query parser service client errors
        // to the format used in the rest of the server
        const { message, ...rest } = parseError;
        if (parseError.expectedError) {
          httpErrors.throwBadRequest(message, rest);
        }

        // Unexpected errors will be handled as internal server errors by default
        throw parseError;
      }

      const { queryObject, orderBy } = result;

      if (filterEnabled) {
        // If a filter is optional we default to allowing anything if no
        // filter is specified (e.g. for findAll), otherwise we allow
        // nothing (e.g. for bulk delete/update)
        where = filteringIsRequired
          ? (queryObject || nullFilter)
          : (queryObject || defaultFilter);

        if (!queryObject) {
          isDefaultFilterOn = true;
        }
      }

      if (sortingEnabled) {
        order = orderBy.length ? orderBy : defaultSort;
        isDefaultSortOn = !orderBy.length;
      }
    }

    req.where = where;
    req.order = order;
    req.isDefaultFilterOn = isDefaultFilterOn;
    req.isDefaultSortOn = isDefaultSortOn;
  }

  return processQuery;
}

/**
 * This plugin performs query filter parsing
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {object} opts.nullFilter - ORM formatted expression in object form
 *   that specifies what ORM filter expression to use to obtain no results.
 *   This is needed so that we don't update anything if no filter is specified
 *   for bulk delete or bulk update queries (as a safety measure).
 * @returns {Promise<void>}
 * @async
 */
async function queryFilter(fastify, opts) {
  const {
    // If no null filter is specified, fallback to `WHERE FALSE` or `id == 0`
    nullFilter = fastify?.db?.Sequelize?.literal('FALSE') || { id: 0 }
  } = opts;

  // Check column names by looking at column names in allow-lists in route configs
  fastify.addHook('onRoute', route => {
    const { config, path: routePath, method } = route;

    if (config?.queryParsing) {
      const { filterEnabledFor, sortingEnabledFor } = config.queryParsing;
      const routeInfo = `${method} ${routePath}`;

      checkReservedColumnNames(filterEnabledFor, sortingEnabledFor, routeInfo);
    }
  });

  fastify.decorateRequest('where', null);
  fastify.decorateRequest('order', null);
  fastify.decorateRequest('isDefaultFilterOn', false);
  fastify.decorateRequest('isDefaultSortOn', false);

  const processQueryHook = makeProcessQuery(nullFilter);
  // This will sanitize and reset the values decorated in the request for every
  // request at the preValidation lifecycle event
  fastify.addHook('preValidation', processQueryHook);

  fastify.log.info('Query filter preValidation Hooks added => new decorators are available: '
    + 'req.where = filter expression in ORM format; '
    + 'req.order = sort expression in ORM format; '
    + 'req.isDefaultFilterOn = true if no explicit filter was requested & the default one was used; '
    + 'req.isDefaultSortOn = true if no explicit sort was requested & the default one was used.');
}

export default fp(queryFilter, {
  name: 'queryFilter'
});
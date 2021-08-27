import Sequelize from 'sequelize';
import SqlString from 'sequelize/lib/sql-string.js';
const { Op } = Sequelize;

/**
 * Build searchFor query
 *
 * @param {string} searchFor - search term(s)
 * @param {array} columns - columns in which to search
 * @param {string} table - table in which to search
 * @returns {object}
 */
export function buildSearchForQuery(searchFor, columns = [], table) {

  // We use SqlString.escape() function to prevent SQL injection
  // when passing user "searchFor" input to Sequelize.literal() function

  // Simple SQL Injection escaping
  const searchForEscapedInjection = SqlString.escape(searchFor, '', 'postgres');

  // Escape _ and % characters to prevent wrong
  // results using like/ilike, then prepare format
  // for ilike (add it between `%%`)
  const searchForPartial = searchFor.replace(/_/g, '\_').replace(/%/g, '\%');
  const searchForEscapedIlike = `%${searchForPartial}%`;

  // SQL Injection escaping that applies on top of the
  // iLike search expression
  const searchForEscapedIlikeAndInjection = SqlString
    .escape(searchForEscapedIlike, '', 'postgres');

  /// BUILD ORDER_PRIORITY column. Will return 'include'
  // Here we build a new column called ORDER_PRIORITY, whose values
  // depend on these cases. We then order ascending by this column
  // to get exact matches first, then partial matches next.
  // Check line somewhere below saying [Sequelize.literal('ORDER_PRIORITY')]
  let currentPriorityIndex = 1;
  let includeString = 'CASE '; // will be appended to
  // add exact match conditionals, with equals (=) operator
  columns.forEach(column => {
    includeString += `WHEN LOWER("${table}"."${column}") = `
      + `${searchForEscapedInjection.toLowerCase()} THEN ${currentPriorityIndex} `;
    currentPriorityIndex += 1;
  });
  // add partial match conditionals, with ilike operator
  columns.forEach(column => {
    includeString += `WHEN "${table}"."${column}" ilike `
      + `${searchForEscapedIlikeAndInjection} THEN ${currentPriorityIndex} `;
    currentPriorityIndex += 1;
  });
  includeString += 'END AS ORDER_PRIORITY';
  // Build it into a Sequelize literal
  const include = [Sequelize.literal(includeString)];

  /// BUILD where clause. Will return 'where'
  const where = {
    [Op.or]: columns.map(column => ({
      [column]: {
        [Op.iLike]: searchForEscapedIlike
      }
    }))
  };

  /// BUILD order clause. Will return 'order'
  const order = [
    // Assign higher sort order if the name is an
    // exact match for the search term
    // We use Sequelize.literal() because a simple order
    // results in a broken SQL query from Sequelize
    [Sequelize.literal('ORDER_PRIORITY')],
    // Otherwise we have a default alphabetic
    // case-insensitive sort by name
    ...columns.map(column => (
      [Sequelize.fn('LOWER', Sequelize.col(`${table}.${column}`)), 'ASC']
    ))
  ];

  return {
    include,
    where,
    order
  };
}
import hyperId from 'hyperid';
import util from 'util';

const getFastId = hyperId({ urlSafe: true });

const debuglogVerbose = util.debuglog('QUERY_PARSER:VERBOSE');
const debuglog = util.debuglog('QUERY_PARSER');

const FIELD_PATTERN_REGEX = /^fld\[(\w[\w\d]*)\]\[(\w+)\](\[(\d+)?\])?$/;
const FIELD_PATTERN_FORMAT_EXAMPLE = 'fld[name][op][id] or fld[name][op][] or fld[name][op]';
const ORDER_PATTERN_REGEX = /^ord\[(\w[\w\d]*)\]$/;
const ORDER_PATTERN_FORMAT_EXAMPLE = 'ord[name]';

export const FIELD_PARAM_PREFIX = 'fld';
export const ORDER_PARAM_PREFIX = 'ord';
export const OPS_PARAM_NAME = 'ops';
export const ID_DELIM_START_CHAR = '[';
export const ID_DELIM_END_CHAR = ']';
export const EXPRESSION_DELIM_START_CHAR = '(';
export const EXPRESSION_DELIM_END_CHAR = ')';
export const VALID_FIELD_OP_MAP = new Map(Object.entries({
  eq: '$eq',
  neq: '$ne',
  in: '$in',
  lt: '$lt',
  lte: '$lte',
  gt: '$gt',
  gte: '$gte',
  like: '$like',
  ilike: '$ilike'
}));
export const VALID_FIELD_OP_LIST = [...VALID_FIELD_OP_MAP.keys()];
export const VALID_SORT_DIR_LIST = ['ASC', 'DESC'];
export const VALID_GROUP_OP_MAP = new Map(Object.entries({
  AND: '$and',
  OR: '$or'
}));
export const VALID_GROUP_OP_LIST = [...VALID_GROUP_OP_MAP.keys()];
export const MAX_GROUP_OP_LENGTH = VALID_GROUP_OP_LIST
  .map(key => key.length)
  .reduce((first, second) => (first > second ? first : second));
export const VALID_MAPPED_GROUP_OP_LIST = [...VALID_GROUP_OP_MAP.values()];
export const RESERVED_COLUMN_NAMES = [
  ORDER_PARAM_PREFIX,
  FIELD_PARAM_PREFIX,
  ...VALID_GROUP_OP_LIST,
  ID_DELIM_START_CHAR,
  ID_DELIM_END_CHAR,
  EXPRESSION_DELIM_START_CHAR,
  EXPRESSION_DELIM_END_CHAR
];

/**
 * Throw an error and attach:
 * - an internal error code to it
 * - locale namespace to use to localize error message
 * - parameters needed for localization phrase template
 *
 * @param {number} code - error code used to track each type of error
 * @param {string} message - error message which can contain {{param1}} parameters
 *   to be passed to i18n
 * @param {object} params - parameter passed to i18n function when
 *   translating the message
 * @returns {string}
 */
function throwError(code, message, params = {}) {
  const errorObj = new Error(message);

  Object.assign(errorObj, {
    internalCode: code,
    expectedError: true,
    errClass: 2,
    params,
    localeNamespace: 'global'
  });

  throw errorObj;
}

/**
 * Build an object that encodes an expression in the ORM format
 * from a list of operators and smaller expression
 * @param {string} operatorsList - list of operators to be used between
 *   the operands in expressionsList
 * @param {number} expressionsList - list of smaller expressions to
 *   combine into a larger one
 * @returns {object} object that encodes an expression in ORM format
 * @example
 *    input operatorsList = ["$or", "$and"]
 *    input expressionsList = [
 *        {
 *            "$and": [
 *                {
 *                    "status": {"$gte": "0"}
 *                },
 *                {
 *                    "status": {"$lte": "2"}
 *                }
 *            ]
 *        }, // Consider this A
 *        {
 *            "status": {"$gte": "5"}
 *        }, // Consider this B
 *        {
 *            "$and": [
 *                {
 *                    "age": {"$gte": "0"}
 *                },
 *                {
 *                    "age": {"$lte": "20"}
 *                }
 *            ]
 *        } // Consider this C
 *    ]
 *
 *    // This function applies "$or", "$and" to A,B,C in order i.e.
 *    // A "$or" B "$and" C in order <=> ((A "$or" B) "$and" C)
 *
 *    output = {
 *        "$and": [
 *            {
 *                "$or": [
 *                    {
 *                        "$and": [
 *                            {
 *                                "status": {"$gte": "0"}
 *                            },
 *                            {
 *                                "status": {"$lte": "2"}
 *                            }
 *                        ]
 *                    },
 *                    {
 *                        "status": {"$gte": "5"}
 *                    }
 *                ]
 *            },
 *            {
 *                "$and": [
 *                    {
 *                        "age": {"$gte": "0"}
 *                    },
 *                    {
 *                        "age": {"$lte": "20"}
 *                    }
 *                ]
 *            }
 *        ]
 *    }
 */
function nestOperatorsAndExpressions(operatorsList, expressionsList) {
  debuglogVerbose('Calling nestOperatorsAndExpressions() with:');
  debuglogVerbose('\toperatorsList:', JSON.stringify(operatorsList, null, 2));
  debuglogVerbose('\texpressionsList:', JSON.stringify(expressionsList, null, 2));

  if (expressionsList.length - 1 !== operatorsList.length) {
    throwError(
      911,
      'Syntax error at query parsing in {{ops}} expression: there are '
        + 'more or less operators than appropriate for the number of operands',
      { ops: OPS_PARAM_NAME }
    );
  }

  // Handle trivial cases upfront
  if (!operatorsList.length) {
    debuglogVerbose(
      '\texpressionObject:',
      JSON.stringify(expressionsList[0], null, 2),
      '\n'
    );

    return expressionsList[0];
  }

  if (operatorsList.length === 1) {
    debuglogVerbose('\texpressionObject:', JSON.stringify({
      [operatorsList[0]]: expressionsList
    }, null, 2), '\n');

    return {
      [operatorsList[0]]: expressionsList
    };
  }

  let prevOperator = null;
  const expressionObject = {};
  let prevOperandList = [];

  // Build the nested objects that represent the expression in reverse order
  // because the grouping is implicit by order and the priority is proportional
  // to reverse order of operators
  for (let opIndex = operatorsList.length - 1; opIndex >= 0; opIndex -= 1) {
    const operator = operatorsList[opIndex];
    const currentExpression = expressionsList[opIndex + 1];

    // Initialize current grouping with the first operand
    let operandList = [currentExpression];

    // When we reach the last operator we know that it
    // applies to the remaining two operands
    if (opIndex === 0) {
      operandList = expressionsList.slice(0, 2);
    }

    if (!prevOperator) {
      // Prepare the initial grouping of operands
      expressionObject[operator] = operandList;
      prevOperandList = operandList;
    } else if (operator === prevOperator) {
      // Prevent unnecessary extra nested grouping of operations:
      // combine multiple operands that have the same operator into a single group
      prevOperandList.unshift(...operandList);
    } else {
      // Create the next nested grouping of operands using the current operator
      // Use the ref of the parent list of operands to append the second operand
      // to ensure operand groups nesting as required by the ORM
      prevOperandList.unshift({
        [operator]: operandList
      });
      prevOperandList = operandList;
    }

    prevOperator = operator;
  }

  debuglogVerbose(
    '\texpressionObject',
    JSON.stringify(expressionObject, null, 2),
    '\n'
  );
  return expressionObject;
}

/**
 * Parse field ids in expression and replace them with their
 * corresponding field expressions in ORM format
 *
 * @param {number} index - index in expressionText to begin parsing
 * @param {string} expressionText - expression in serialized form
 * @param {number} startPosition - position in expression text used to
 *   indicate syntax error if any
 * @param {Map} fieldDataByIdMap - map of all fields and their parsed expression data
 * @param {string} delimStart - delimiter used to signal start of id characters
 * @param {string} delimEnd - delimiter used to signal end of id characters
 * @returns {{number, object}} an object that contains:
 * + newIndex - next value of the index used to iterate in expressionText
 * + expressionInObjectFormat - an object that encodes the expression associated
 *   with the field id, in ORM format
 * @example
 * input expressionText = '([1]AND[2]OR[3])'
 * input index = 6 // Which means look at id that starts after the 6th character: [2]
 * input delimStart = '[' // How to recognize the start of the id
 * input delimEnd = ']' // How to recognize the end of the id
 * input startPosition = 1
 * input fieldDataByIdMap = Map {
 *  '1' => { status: { 'gte': '0' } },
 *  '2' => { status: { 'lte': '2' } },
 *  '3' => { age: { '$gte': '20' } },
 *  ...
 * }
 *
 * // The function sees that it must return an expression in ORM format for: id 2
 * // Map the id with its corresponding ORM expression using
 * // fieldDataByIdMap: '2' => { status: { 'lte': '2' } }
 *
 * output = {
 *   newIndex: 9
 *   expressionInObjectFormat: {
 *     status: { '$lte': '2' }
 *   }
 * }
 */
function replaceFieldIdWithExpression(
  index, expressionText, startPosition, fieldDataByIdMap, delimStart, delimEnd
) {
  debuglogVerbose('Calling replaceFieldIdWithExpression() with:');
  debuglogVerbose('\tindex:', index);
  debuglogVerbose('\texpressionText:', expressionText);
  debuglogVerbose('\tstartPosition:', startPosition);
  debuglogVerbose('\tdelimStart:', delimStart);
  debuglogVerbose('\tdelimEnd:', delimEnd);

  // Advance to first digit
  const idStart = index + 1;
  let newIndex = idStart;

  // Search for end of id digits
  while ((expressionText[newIndex] >= '0') && (expressionText[newIndex] <= '9')) {
    newIndex += 1;
  }

  if (expressionText[newIndex] !== delimEnd) {
    throwError(
      912,
      'Syntax error at query parsing in {{ops}} expression: identifier at position '
        + '{{pos}} should be a number encased in {{delimStart}}123{{delimEnd}}',
      {
        ops: OPS_PARAM_NAME,
        pos: newIndex + startPosition,
        delimStart,
        delimEnd
      }
    );
  } else {
    // Advance after the closing DELIM of the identifier
    newIndex += 1;
  }

  const idStop = newIndex - 1;
  if (idStart === idStop) {
    throwError(
      913,
      'Syntax error at query parsing in {{ops}} expression: '
        + 'the id segment is empty at position {{pos}}',
      {
        ops: OPS_PARAM_NAME,
        pos: index + startPosition
      }
    );
  }

  const id = expressionText.slice(idStart, idStop);

  if (!fieldDataByIdMap.has(id)) {
    throwError(
      914,
      'Syntax error at query parsing in {{ops}} expression: '
        + 'the id {{id}} is not present in the {{fld}} query field parameters',
      {
        ops: OPS_PARAM_NAME,
        id,
        fld: FIELD_PARAM_PREFIX
      }
    );
  }

  const expressionInObjectFormat = fieldDataByIdMap.get(id);

  return {
    newIndex,
    expressionInObjectFormat
  };
}

/**
 * Break down expression (whether it operates on groups or ids) into operators
 * and field / group operands, then return two lists: extracted operands and
 * extracted operators
 *
 * @param {string} expressionText - expression in serialized form
 * @param {Function} parser - function to use to parse string found within
 *   given delimiters (delimStart and delimEnd)
 * @param {number} startPosition - position in expression text used to
 *   indicate syntax error if any
 * @param {Map} fieldDataByIdMap - map of all fields and their parsed expression data
 * @param {string} delimStart - delimiter used to signal start of group characters
 * @param {string} delimEnd - delimiter used to signal end of group characters
 * @returns {{operandsList: Array<object>, operatorsList: Array<string>}} an object
 *   that contains:
 * + operandsList - extracted operands
 * + operatorsList - extracted operators which are objects that encode
 *   sub-expressions in ORM format
 * @example
 * input expressionText = '[4]AND[5]OR[7]'
 * input delimStart = '['
 * input delimEnd = ']'
 * input parser = function replaceFieldIdWithExpression() {...}
 * input startPosition = 2
 * input fieldDataByIdMap = Map {
 *  ...
 *  '4' => { status: { '$gte': '0' } },
 *  '5' => { status: { '$lte': '2' } },
 *  '6' => { age: { '$gte': '100' } },
 *  '7' => { age: { '$gte': '20' } },
 *  ...
 * }
 *
 * // Parse expr '[4]AND[5]OR[7]' and extract every id between delimiters [] => 4,5,7
 * // Map every id to its corresp. expr using fieldDataByIdMap to obtain operandsList
 * // At the same time extract every raw operator between delimited groups => AND,OR
 * // Map each raw operator to its corresp. ORM operator to obtain the operatorsList
 *
 * output = {
 *   operandsList: [
 *     { status: { '$gte': '0' } },
 *     { status: { '$lte': '2' } },
 *     { age: { '$gte': '20' } }
 *   ],
 *   operatorsList: [ '$and', '$or' ]
 * }
 */
function analyzeExpression(
  expressionText, parser, startPosition, fieldDataByIdMap, delimStart, delimEnd
) {
  debuglogVerbose('Calling analyzeExpression() with: ');
  debuglogVerbose('\texpressionText:', expressionText);
  debuglogVerbose('\tdelimStart:', delimStart);
  debuglogVerbose('\tdelimEnd:', delimEnd);
  debuglogVerbose('\tparser:', parser);
  debuglogVerbose('\tstartPosition:', startPosition);

  let charIndex = 0;
  const operandsList = [];
  const operatorsList = [];
  const expressionLength = expressionText.length;

  while (charIndex < expressionLength) {
    // Match expressions between delimiters
    if (expressionText[charIndex] === delimStart) {
      if (operandsList.length !== operatorsList.length) {
        throwError(
          915,
          'Syntax error at query parsing in {{ops}} expression: '
            + 'missing operator (e.g. {{opList}}) at position {{pos}}',
          {
            ops: OPS_PARAM_NAME,
            opList: VALID_GROUP_OP_LIST,
            pos: startPosition + charIndex
          }
        );
      }

      const {
        expressionInObjectFormat,
        newIndex
      } = parser(
        charIndex,
        expressionText,
        startPosition,
        fieldDataByIdMap,
        delimStart,
        delimEnd
      );

      charIndex = newIndex;
      operandsList.push(expressionInObjectFormat);
      // Match top-level operators between expressions
    } else {
      if (operandsList.length !== operatorsList.length + 1) {
        throwError(
          916,
          'Syntax error at query parsing in {{ops}} expression: '
            + 'invalid character at position {{pos}}, expected {{delimStart}}',
          {
            ops: OPS_PARAM_NAME,
            pos: startPosition + charIndex,
            delimStart
          }
        );
      }

      let currentOperator = null;
      const rawOperatorCandidate = expressionText.slice(
        charIndex, charIndex + MAX_GROUP_OP_LENGTH + 1
      );
      let nextPosition = 0;

      // eslint-disable-next-line no-loop-func
      VALID_GROUP_OP_LIST.forEach(rawOperator => {
        if (rawOperatorCandidate.startsWith(rawOperator)) {
          currentOperator = VALID_GROUP_OP_MAP.get(rawOperator);
          nextPosition = charIndex + rawOperator.length;
        }
      });

      if (currentOperator) {
        operatorsList.push(currentOperator);
      } else {
        throwError(
          917,
          'Syntax error at query parsing in {{ops}} expression: '
            + 'invalid operator {{op}} at position {{pos}}',
          {
            ops: OPS_PARAM_NAME,
            op: rawOperatorCandidate,
            pos: startPosition + charIndex
          }
        );
      }

      charIndex = nextPosition;
    }
  }

  return {
    expressionsList: operandsList,
    operatorsList
  };
}

/**
 * Parse groups of operands at the top level operator expression
 * and transform them into unified expression objects in the ORM format
 *
 * @param {number} index - index in expressionText to begin parsing
 * @param {string} expressionText - expression in serialized form
 * @param {number} startPosition - position in expression text used to
 *   indicate syntax error if any
 * @param {Map} fieldDataByIdMap - map of all fields and their parsed expression data
 * @param {string} delimStart - delimiter used to signal start of group characters
 * @param {string} delimEnd - delimiter used to signal end of group characters
 * @returns {{number, object}} an object that contains:
 * + newIndex - next value of the index used to iterate in expressionText
 * + expressionInObjectFormat - object that encodes the group expression,
 *   in ORM format
 * @example
 * input expressionText = '([1]AND[2]OR[3])OR([4]AND[5])'
 * input index = 18 // Which means look at group that starts after the
 *   18th character: ([4]AND[5])
 * input delimStart = '(' // How to recognize the start of the group
 * input delimEnd = ')' // How to recognize the end of the group
 * input startPosition = 1
 * input fieldDataByIdMap = Map {
 *  '1' => ...
 *  '2' => ...
 *  '3' => ...
 *  '4' => { status: { '$gte': '0' } },
 *  '5' => { age: { '$lte': '2' } }
 * }
 *
 * // The function sees that it must return an expression in ORM
 * // format for: (id 4) AND (id 5)
 * // Map the raw operator to the internal one => {
 * //   '$and': [
 * //      expression-for(id 4),
 * //      expression-for(id 5)
 * //   ]
 * // }
 * // Then replace the ids with the actual expressions using fieldDataByIdMap
 *
 * output = {
 *   newIndex: 29
 *   expressionInObjectFormat: {
 *     '$and': [
 *       {
 *         status: { '$gte': '0' }
 *       },
 *       {
 *         age: { '$lte': '2' }
 *       }
 *     ]
 *   }
 * }
 */
function transformGroup(
  index, expressionText, startPosition, fieldDataByIdMap, delimStart, delimEnd
) {
  debuglogVerbose('Calling transformGroup() with:');
  debuglogVerbose('\tindex:', index);
  debuglogVerbose('\texpressionText:', expressionText);
  debuglogVerbose('\tstartPosition:', startPosition);
  debuglogVerbose('\tdelimStart:', delimStart);
  debuglogVerbose('\tdelimEnd:', delimEnd);

  const subExpressionStart = index + 1;
  let newIndex = index;

  // Search for end of expression
  while (expressionText[newIndex] !== delimEnd) {
    newIndex += 1;
  }
  // Advance to the character after the expression
  newIndex += 1;

  // Extract sub-expression
  const subExpressionStop = newIndex - 1;
  if (subExpressionStart === subExpressionStop) {
    throwError(
      918,
      'Syntax error at query parsing in {{ops}} expression: '
            + 'the expression is empty at position {{pos}}',
      {
        ops: OPS_PARAM_NAME,
        pos: subExpressionStart
      }
    );
  }
  const subExpressionText = expressionText.slice(
    subExpressionStart,
    subExpressionStop
  );

  const {
    expressionsList,
    operatorsList
  } = analyzeExpression(
    subExpressionText,
    replaceFieldIdWithExpression,
    index + startPosition + 1,
    fieldDataByIdMap,
    ID_DELIM_START_CHAR,
    ID_DELIM_END_CHAR
  );

  const expressionInObjectFormat = nestOperatorsAndExpressions(
    operatorsList,
    expressionsList
  );

  return {
    newIndex,
    expressionInObjectFormat
  };
}

/**
 * Add value in pre-processed dictionary of [in] groups
 *
 * @param {object} opts - options object
 * @param {object} opts.inGroupsByColumnByIdDict - dictionary which will be populated with
 *   pre-processed values of [in] field expressions, since their allowed list of values needs
 *   to be grouped by column and id. This object will be a dictionary with keys equal to
 *   column names of expressions that include the [in] operator, where each value is another
 *   dictionary with keys equal to the name of the id of that [in] group and its value the
 *   list of requested values.
 *
 *   Example: {
 *     col1: {
 *       "1": ["1", "2", "3"],
 *       "2": ["aa", "bb", "cc"]
 *     },
 *     col2: {
 *       "3": ["100", "200", "300"]
 *     },
 *   }
 * @param {string} opts.columnName - name of column
 * @param {string} opts.fieldName - expression field raw value
 * @param {string} opts.value - value to add in [in] group
 * @param {string} opts.id - id of subexpression
 * @returns {void}
 */
function addValueForInGroup({
  inGroupsByColumnByIdDict,
  columnName,
  fieldName,
  value,
  id = 'default'
}) {
  debuglogVerbose('Calling addValueForInGroup() with:');
  debuglogVerbose('\tcolumnName:', columnName);
  debuglogVerbose('\tfieldName:', fieldName);
  debuglogVerbose('\tvalue:', value);
  debuglogVerbose('\tid:', id);

  let processedValues = value;
  if (!Array.isArray(value)) {
    processedValues = [value];
  }

  if (!inGroupsByColumnByIdDict[columnName]) {
    inGroupsByColumnByIdDict[columnName] = {};
  }
  inGroupsByColumnByIdDict[columnName][id] = processedValues;

  debuglogVerbose('\tResulted inGroupsByColumnByIdDict =', inGroupsByColumnByIdDict);
}

/**
 * Build a hash of all field ids and their parsed expressions in ORM format
 *
 * @param {Array<{name: string, value: any}>} fields - list of objects that provide
 *   query params name and value for query params that specify filters
 * @param {Array<string>} allowlistFilterColumns - list of columns to allow in
 *   query filtering
 * @returns {Map<string, object>} Map of all parsed field expressions by field ids
 * @example
 * input fields = fields: [
 *   { name: 'fld[status][gte][1]', value: '0' },
 *   { name: 'fld[status][lte][2]', value: '2' }
 * ]
 * input allowlistFilterColumns = ['id', 'status']
 * output = Map(2) {
 *  '1' => { status: { '$gte': '0' } },
 *  '2' => { status: { '$lte': '2' } }
 * }
 */
function parseFieldsFromQuery(fields, allowlistFilterColumns = []) {
  debuglogVerbose('Calling parseFieldsFromQuery() with:');
  debuglogVerbose('\tfields:', fields);
  debuglogVerbose('\tallowlistFilterColumns:', allowlistFilterColumns);
  const fieldDataByIdMap = new Map();
  const inGroupsByColumnByIdDict = {};

  // Deconstruct each field param into an object
  // expression that can be understood by the ORM
  fields.forEach(({ name: fieldName, value: inputValue }) => {
    let value = inputValue;
    const fieldData = fieldName.match(FIELD_PATTERN_REGEX);

    // Check if a match was not found
    if (!fieldData) {
      throwError(
        919,
        'Syntax error at parsing query parameter {{fieldName}}: '
          + 'should be {{format}}',
        {
          fieldName,
          format: FIELD_PATTERN_FORMAT_EXAMPLE
        }
      );
    }

    const [, columnName, rawOperator,, id] = fieldData;

    // The fastify default querystring deserializer decodes repeated query field names into
    // an array of values - which is only supported for the in operator in this query parser
    if ((rawOperator !== 'in') && Array.isArray(value)) {
      throwError(
        927,
        'Syntax error at parsing query parameter {{fieldName}}: it was provided '
        + 'multiple times for an operator which doesn\'t support multiple values',
        { fieldName }
      );
    }

    // Ignore this filter component if the column name is not allowed to be used
    // We must throw an error here otherwise parsing will throw a misguided
    // error since it cannot know if the user forgot a field or if he provided
    // a column that is not allowed
    if (!allowlistFilterColumns.includes(columnName)) {
      throwError(
        925,
        'Syntax error at parsing query parameter {{fieldName}}: column '
          + '{{columnName}} is not valid or allowed',
        {
          fieldName,
          columnName
        }
      );
    }

    // We only perform a basic partial search ILIKE / LIKE operation i.e.
    // %search_string%. Escape each char in the partial search string with \
    // and add % wildcards at the start and end
    if (rawOperator === 'ilike' || rawOperator === 'like') {
      if (!value.length) {
        throwError(
          923,
          'Syntax error at parsing query parameter {{fieldName}}: '
            + 'no value provided for {{op}}',
          {
            fieldName,
            op: rawOperator
          }
        );
      }
      value = `%\\${value.split('').join('\\')}%`;
    }

    // Interpret the string 'null' (without quotes) as the NULL value
    if (value === 'null') {
      value = null;
    }
    // Allow the backslash to be used as an escape operator for
    // specifying the 'null' string instead of the NULL value
    if (value === "\\'null\\'") {
      value = 'null';
    }

    const operator = VALID_FIELD_OP_MAP.get(rawOperator);
    if (!operator) {
      throwError(
        920,
        'Syntax error at parsing query parameter {{fieldName}}: '
        + 'invalid operator {{op}}',
        {
          fieldName,
          op: rawOperator
        }
      );
    }

    // If an id is provided for the field expression and it's the second time it's used
    if (id && fieldDataByIdMap.has(id)) {
      if (rawOperator === 'in') {
        addValueForInGroup({ inGroupsByColumnByIdDict, columnName, value, fieldName, id });
      } else {
        throwError(
          928,
          'Syntax error at parsing query parameter {{fieldName}}: the id was already used',
          { fieldName }
        );
      }
    } else if (rawOperator === 'in') {
      // The [in] operator needs special handling since it's provided
      // multiple times to specify the allowed list of values
      addValueForInGroup({ inGroupsByColumnByIdDict, columnName, value, fieldName, id });
    } else {
      // All other operators just need to be saved in the correct ORM format
      const parsedFieldData = {
        [columnName]: {
          [operator]: value
        }
      };

      fieldDataByIdMap.set(id || getFastId(), parsedFieldData);
    }
  });

  /* Final handling of [in] operator:
   * Example value for inGroupsByColumnByIdDict = {
   *   col1: {
   *     "1": ["1", "2", "3"], // => has to be converted to an ORM sub-expression
   *     "2": ["aa", "bb", "cc"] // => has to be converted to an ORM sub-expression
   *   },
   *   col2: {
   *     "3": ["100", "200", "300"] // => has to be converted to an ORM sub-expression
   *   },
   * }
   */
  const inGroupsList = Object.entries(inGroupsByColumnByIdDict);
  if (inGroupsList.length) {
    // Process first object level: of columns
    inGroupsList.forEach(([columnName, idGroups]) => {
      const idGroupsList = Object.entries(idGroups);

      // Process second object level: of ids in that column
      idGroupsList.forEach(([id, valueList]) => {
        // Add the subexpression for each group of allowed [in] values
        fieldDataByIdMap.set(id, {
          [columnName]: {
            [VALID_FIELD_OP_MAP.get('in')]: valueList
          }
        });
      });
    });
  }

  return fieldDataByIdMap;
}

/**
 * Parse a query string param that encodes an order to sort list data by
 *
 * @param {string} name - name of field to sort list data by
 * @param {string} order - order of sorting to use
 * @param {Array<string>} allowlistSortColumns - list of columns to allow in sorting
 * @returns {Array<string>} A tuple: [field, direction], in a format accepted by ORM
 * @example
 * input (global variable) VALID_SORT_DIR_LIST = ['ASC', 'DESC'] // Allowed dis
 * input name = ord[id]
 * input order = asc
 * input allowlistSortColumns = ['id', 'status']
 * output = ['id', 'ASC']
 * @example
 * input (global variable) VALID_SORT_DIR_LIST = ['ASC', 'DESC'] // Allowed dirs
 * input name = ord[age]
 * input order = desc
 * input allowlistSortColumns = ['id', 'status']
 * // The function throws an error because 'age' is not in whitelist
 * @example
 * input (global variable) VALID_SORT_DIR_LIST = ['ASC', 'DESC'] // Allowed dirs
 * input name = ord[id]
 * input order = random
 * input allowlistSortColumns = ['id', 'status']
 * // The function throws because 'random' is not in list of allowed directions
 */
function parseOrderByParamFromQuery(name, order, allowlistSortColumns = []) {
  debuglogVerbose('Calling parseOrderByParamFromQuery() with:');
  debuglogVerbose('\tname:', name);
  debuglogVerbose('\torder:', order);
  debuglogVerbose('\tallowlistSortColumns:', allowlistSortColumns);

  const orderByColumnMatch = name.match(ORDER_PATTERN_REGEX);

  // Check if the format required for the order parameter is not respected
  if (!orderByColumnMatch) {
    throwError(
      921,
      'Syntax error at parsing query parameter {{name}}: '
            + 'order parameter should be {{format}}', {
        name,
        format: ORDER_PATTERN_FORMAT_EXAMPLE
      }
    );
  }

  if (!VALID_SORT_DIR_LIST.includes(order.toUpperCase())) {
    throwError(
      922,
      'Syntax error at parsing query parameter {{name}}: '
            + 'order direction should be one of: {{dir}}',
      {
        name,
        dir: VALID_SORT_DIR_LIST
      }
    );
  }

  const orderByColumn = orderByColumnMatch[1];

  // Throw error for column if it's not allowed explicitly in the endpoint definition
  if (!allowlistSortColumns.includes(orderByColumn)) {
    throwError(
      926,
      'Syntax error at parsing order parameter {{name}}: '
      + 'column {{columnName}} is not valid or allowed for sorting',
      {
        name,
        columnName: orderByColumn
      }
    );
  }

  return [orderByColumn, order.toUpperCase()];
}

/**
 * Filter querystring params and parse query related ones (if present)
 * into an expression in ORM format
 *
 * @param {Array<string>} params - object with querystring params
 * @param {Array<string>} allowlistFilterColumns - list of columns to allow
 *   in query filtering
 * @param {Array<string>} allowlistSortColumns - list of columns to allow in sorting
 * @returns {{object, object}} an object that contains:
 * + queryObject - deserialized object that encodes the query expression
 * + orderBy - object that encodes the group expression, in ORM format
 * @example
 * input params = {
 *   ...
 *   'fld[first_name][like][1]': 'escu',
 *   'fld[age][gt][2]': '60',
 *   'fld[last_name][in][3]': 'sonia',
 *   'fld[city][eq][4]': 'Cluj',
 *   'ops': '([1]AND[2])OR([3]AND[4])',
 *   'ord[zip]': 'asc',
 *   'ord[age]': 'desc'
 *   'cache': 'true',
 *   ...
 * }
 * input allowlistFilterColumns = ['first_name', 'age', 'last_name', 'city', 'zip']
 * input allowlistSortColumns = ['first_name', 'age', 'last_name', 'city', 'zip']
 *
 * // Extract all field parameters and convert them to ORM sub-expressions e.g.
 * //   'fld[age][gt][2]': '60' becomes {age:{'$gt': 60}} which has id 2
 * // Extract all order parameters and convert them to ORM order format e.g.
 * //   'ord[zip]': 'asc' -> ['zip', 'ASC']
 * //   'ord[age]': 'desc' -> ['age', 'DESC']
 * // which results in orderBy = [['zip', 'ASC'], ['age', 'DESC']]
 * // Parse ops expression and replace all ids with their corresponding
 * // sub-expressions determined above
 * // Transform the entire ops expression in the tree format understood
 * // by the ORM and return it in queryObject
 *
 * output = {
 *   queryObject: {
 *     '$or': [
 *       {
 *         '$and': [
 *           {
 *             first_name: {
 *               '$like': '%escu%'
 *             }
 *           },
 *           {
 *             age: {
 *               '$gt': '60',
 *             }
 *           }
 *         ],
 *       },
 *       {
 *         '$and': [
 *           {
 *             last_name: {
 *               '$in': ['sonia']
 *             }
 *           },
 *           {
 *             city: {
 *               '$eq': 'Cluj',
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   },
 *   orderBy: [['zip', 'ASC'], ['age', 'DESC']]
 * }
 */
export function deserializeFromQuerystring(
  params, allowlistFilterColumns = [], allowlistSortColumns = []
) {
  const fields = [];
  let operatorExpression;
  const orderBy = [];

  // Filter only query params that respect the allowed formats
  Object.entries(params).forEach(([paramName, paramValue]) => {
    if (paramName.startsWith(FIELD_PARAM_PREFIX) && allowlistFilterColumns.length) {
      fields.push({
        name: paramName,
        value: paramValue
      });
    } else if (paramName.startsWith(ORDER_PARAM_PREFIX) && allowlistSortColumns.length) {
      let sanitizedParamValue = paramValue;
      if (Array.isArray(paramValue)) {
        sanitizedParamValue = paramValue[paramValue.length - 1];
      }
      const orderItem = parseOrderByParamFromQuery(
        paramName, sanitizedParamValue, allowlistSortColumns
      );
      if (orderItem) {
        orderBy.push(orderItem);
      }
    } else if (paramName === OPS_PARAM_NAME) {
      operatorExpression = paramValue;
    }
  });

  debuglog('ops:', operatorExpression);
  debuglog('allowlistFilterColumns:', allowlistFilterColumns);
  debuglog('allowlistSortColumns:', allowlistSortColumns);
  debuglog('fields:', JSON.stringify(fields, null, 2));
  debuglog('order:', JSON.stringify(orderBy, null, 2));

  // Handle case when no operations expression is provided
  if (!operatorExpression) {
    if (fields.length > 0) {
      // Handle case where we have only one field expression and no operations
      // expression - in which case the field expression is the implicit result
      const fieldDataByIdMap = parseFieldsFromQuery(fields, allowlistFilterColumns);
      if (fields.length === 1) {
        const queryObject = [...fieldDataByIdMap.values()][0];

        debuglog('fields:', fields);
        debuglog('order:', orderBy);
        debuglog('fieldDataByIdMap:', fieldDataByIdMap);
        debuglog('queryObject:', JSON.stringify(queryObject, null, 2));

        return {
          queryObject,
          orderBy
        };
      }
      // If we have no field expression (ops) we combine sub-expressions
      // implicitly using AND as the default group operator
      // e.g. fld[age][gt]=2&fld[age][lt]=20 without ops => (age>2)AND(age<20)
      const expressionsList = [...fieldDataByIdMap.values()];

      // There will be one operator for each operand minus one
      const operatorsList = expressionsList.map(() => VALID_GROUP_OP_MAP.get('AND'));
      operatorsList.pop();

      const queryObject = nestOperatorsAndExpressions(
        operatorsList, expressionsList
      );

      debuglog('fields:', fields);
      debuglog('order:', orderBy);
      debuglog('fieldDataByIdMap:', fieldDataByIdMap);
      debuglog('queryObject:', JSON.stringify(queryObject, null, 2));

      return {
        queryObject,
        orderBy
      };
    }
    // If we have no field or operations expression query
    // string params we have nothing to parse
    debuglog('order:', orderBy);
    debuglog('queryObject: Not specified');

    return {
      queryObject: null,
      orderBy
    };
  } if (fields.length === 0) {
    throwError(
      924,
      'Syntax error at parsing query: {{ops}} expression is '
            + 'specified but no fields are present',
      {
        ops: OPS_PARAM_NAME
      }
    );
  }

  // Parse fields and extract them into a map by ids
  const fieldDataByIdMap = parseFieldsFromQuery(
    fields, allowlistFilterColumns
  );
  debuglog('fieldDataByIdMap:', fieldDataByIdMap);

  // Then parse the expression that uses the fields above
  const {
    expressionsList,
    operatorsList
  } = analyzeExpression(
    operatorExpression,
    transformGroup,
    1,
    fieldDataByIdMap,
    EXPRESSION_DELIM_START_CHAR,
    EXPRESSION_DELIM_END_CHAR
  );

  // Combine operators and sub-expressions into a
  // single object representing the expression
  const queryObject = nestOperatorsAndExpressions(operatorsList, expressionsList);

  debuglog('queryObject:', JSON.stringify(queryObject, null, 2));

  return {
    queryObject,
    orderBy
  };
}

/**
 * Check if any of the columns in the allowlists is a reserved keyword
 *
 * @param {Array<string>} allowlistFilterColumns - list of columns to allow
 *   in query filtering
 * @param {Array<string>} allowlistSortColumns - list of columns to allow in sorting
 * @param {string} routeInfo - route to display in error message for easy debug
 * @returns {void}
 */
export function checkReservedColumnNames(
  allowlistFilterColumns = [],
  allowlistSortColumns = [],
  routeInfo = ''
) {
  RESERVED_COLUMN_NAMES.forEach(reservedColumnName => {
    const reservedColumnNameLower = reservedColumnName.toLowerCase();

    /**
     * Check if column is equal to a reserved name (case-insensitive)
     *
     * @param {string} column name to check
     * @returns {boolean} true if column is equal to a reserved name
     *
    */
    const checkColumn = column => column.toLowerCase() === reservedColumnNameLower;

    const restrictedName = allowlistFilterColumns.find(checkColumn)
      || allowlistSortColumns.find(checkColumn);

    if (restrictedName) {
      throw new Error(`The '${restrictedName}' column name is reserved and `
        + `should not be used with query parsing in ${routeInfo} route config`);
    }
  });
}

export default {
  deserializeFromQuerystring,
  checkReservedColumnNames,
  VALID_FIELD_OP_LIST,
  VALID_GROUP_OP_LIST,
  VALID_SORT_DIR_LIST,
  FIELD_PARAM_PREFIX,
  ORDER_PARAM_PREFIX,
  OPS_PARAM_NAME,
  ID_DELIM_START_CHAR,
  ID_DELIM_END_CHAR,
  EXPRESSION_DELIM_START_CHAR,
  EXPRESSION_DELIM_END_CHAR,
  VALID_FIELD_OP_MAP,
  VALID_GROUP_OP_MAP,
  MAX_GROUP_OP_LENGTH,
  VALID_MAPPED_GROUP_OP_LIST,
  RESERVED_COLUMN_NAMES
};
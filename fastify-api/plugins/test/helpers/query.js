import QUERY_PARSER from '../../services/parseQuery.js';

const VALID_GROUP_OP_REVERSE_MAP = new Map(
  Array.from(QUERY_PARSER.VALID_GROUP_OP_MAP.entries(), entry => {
    const [queryOperator, mappedOperator] = entry;
    return [mappedOperator, queryOperator];
  })
);

const VALID_FIELD_OP_REVERSE_MAP = new Map(
  Array.from(QUERY_PARSER.VALID_FIELD_OP_MAP.entries(), entry => {
    const [fieldOperator, mappedOperator] = entry;
    return [mappedOperator, fieldOperator];
  })
);

function isObject(value) {
  return (value !== null) && (typeof value === 'object');
}

// If we receive ops=([1]AND[2])OR([3]AND[4])AND([5]AND[6]OR[1])', after de-serialization we gain explicit 
// instead of implicit grouping thus queryObject will be serialized back into '((([1]AND[2])OR([3]AND[4]))
// AND(([5]AND[6])OR[1]))' by this function if no parens are removed, but we need to remove them to compare to
// the original input URL which has implicit () grouping. This is why we remove parens that aren't at top level.
function serializeQuery(queryObject, fieldsMap, counterObj) {
  let objectKeys = Object.entries(queryObject);
  if (!objectKeys.length) return '';

  if (objectKeys.length === 1) {
    let firstEntry = objectKeys[0];
    let [ormGroupOperatorOrFieldName, operandsListOrFieldObject] = firstEntry;
    let isGroupExpression = QUERY_PARSER.VALID_MAPPED_GROUP_OP_LIST.includes(ormGroupOperatorOrFieldName) 
      && Array.isArray(operandsListOrFieldObject);
    let isField = isObject(operandsListOrFieldObject);

    if (isGroupExpression) {
      let [ormGroupOperator, operandsList] = firstEntry;
      let queryOperator = VALID_GROUP_OP_REVERSE_MAP.get(ormGroupOperator);
      if (!queryOperator) {
        throw new Error('Provided object contains invalid operators');
      }

      // Serialize current group of operands with the current operator
      let serializedObjectsList = operandsList.map(operand => {
        return serializeQuery(operand, fieldsMap, counterObj);
      });
      let serializedSubExpression = serializedObjectsList.join(queryOperator);
      
      // Remove parens from operations between top-level groups since they are implicit from the order of 
      // operations. This is detected here by checking if an operator's right-most child is not an operator
      // because - in an order-encoded expression evaluation with prio from left to right - a grouping always
      // ends with an operand e.g. ((a & b) | c). Parens inside groups will be removed in another function.
      let highestPrioOperatorSubtree = operandsList[operandsList.length - 1];
      let highestPrioOperator = Object.keys(highestPrioOperatorSubtree)[0];
      let applyGroupingParens = !VALID_GROUP_OP_REVERSE_MAP.has(highestPrioOperator);

      return applyGroupingParens 
        ? `${QUERY_PARSER.EXPRESSION_DELIM_START_CHAR}${serializedSubExpression}${QUERY_PARSER.EXPRESSION_DELIM_END_CHAR}` 
        : serializedSubExpression;
    } else if (isField) {
      let [fieldName, fieldObject] = firstEntry;
      let [ormFieldOperator, fieldValue] = Object.entries(fieldObject)[0];

      let queryFieldOperator = VALID_FIELD_OP_REVERSE_MAP.get(ormFieldOperator);
      if (!queryFieldOperator) {
        throw new Error('Provided object contains invalid operators');
      }

      // If the field parameter was encountered before don't add it again in the
      // list, just retrieve its id for the operations expression serialization
      let id;
      let fieldObjectSignature = `${fieldName}:${JSON.stringify(fieldObject)}`;
      
      if (fieldsMap.has(fieldObjectSignature)) {
        id = fieldsMap.get(fieldObjectSignature).id;
      } else {
        id = counterObj.value;
        // Reverse escaped and % chars that surround the partial search value
        if (queryFieldOperator === 'like' || queryFieldOperator === 'ilike') {
          if (fieldValue.length < 3) {
            throw new Error('Provided value is empty for [ilike] or [like] operator');
          }
          fieldValue = fieldValue.slice(1,-1).split('\\').join('');
        }
        

        if (queryFieldOperator === 'in') {
          if (!Array.isArray(fieldValue)) {
          throw new Error('The [in] operator expects an array of values');
          }

          const fieldParametersList = [];
          fieldValue.forEach(value => {
          fieldParametersList.push(`${QUERY_PARSER.FIELD_PARAM_PREFIX}[${fieldName}][in][${id}]=${value}`);
          });

          // Hash all fields by their signature to be able to deduplicate them and 
          // serialize them later uniquely in the final query string output
          fieldsMap.set(fieldObjectSignature, {
            id,
            fieldParameter: fieldParametersList.join('&')
          });
        } else {
          let fieldParameter = `${QUERY_PARSER.FIELD_PARAM_PREFIX}[${fieldName}]`
          + `[${queryFieldOperator}][${id}]=${fieldValue}`;

          fieldsMap.set(fieldObjectSignature, {
            id,
            fieldParameter
          });
        }
        counterObj.increment();
      }

      return `${QUERY_PARSER.ID_DELIM_START_CHAR}${id}${QUERY_PARSER.ID_DELIM_END_CHAR}`;
    } else {
      throw new Error('Invalid expression element. Should be an object with a key specifying an operator ' 
        + 'and a value representing a list of operands or an object encoding a field');
    }
  } else {
    throw new Error('An object expression should have only one key');
  }
}

function serializeOrder(orderBy) {
  let orderParamsList = orderBy.map(([fieldName, direction]) => {
    if (!QUERY_PARSER.VALID_SORT_DIR_LIST.includes(direction)) {
      throw new Error(`Unsupported sort direction: ${direction}`)
    }
    return `${QUERY_PARSER.ORDER_PARAM_PREFIX}[${fieldName}]=${direction.toLowerCase()}`;
  });

  return orderParamsList.join('&');
}

// Remove all parens that are not at top level since operand grouping from left-to-right is not specified
// explicitly in the URL and must be removed to be able to compare the re-serialized URL to the original input
// This means we detect all parens inside groups and remove them since they are implied by order of operations 
function removeGroupParens(expr) {
  let fixedExprCharList = [];
  let openedParensCount = 0;

  for (let index = 0; index < expr.length; index++) {
    let currentChar = expr[index];

    if (currentChar === QUERY_PARSER.EXPRESSION_DELIM_START_CHAR) {
      if (openedParensCount === 0) {
        fixedExprCharList.push(currentChar);
      }
      openedParensCount++;
    } else if (currentChar === QUERY_PARSER.EXPRESSION_DELIM_END_CHAR) {
      if (openedParensCount === 1) {
        fixedExprCharList.push(currentChar);
      }
      openedParensCount--;
    } else {
      fixedExprCharList.push(currentChar);
    }
  }

  let rewrittenExpr = fixedExprCharList.join('');
  return rewrittenExpr;
}

export default function serializeToQuerystring(queryObject, orderBy = []) {
  let fieldsMap = new Map();
  let counterObj = {
    value: 1,
    increment() {
      this.value = this.value + 1;
      return this.value;
    }
  };

  let operationsParam;
  let concatenatedFieldParams;

  // Obtained serialized query params in two steps
  if (queryObject && Object.keys(queryObject).length) {
    // Get serialized query and remove implied top-level parens between groups
    let serializedOperatorExpression = serializeQuery(queryObject, fieldsMap, counterObj);

    if (counterObj.value > 2) {
      // Get serialized query and remove implied parens inside groups
      let fixedSerializedOpExpression = removeGroupParens(serializedOperatorExpression);
      operationsParam = `${QUERY_PARSER.OPS_PARAM_NAME}=${fixedSerializedOpExpression}`;
    } 

    concatenatedFieldParams = [...fieldsMap.values()]
      .map(({ fieldParameter: f }) => f)
      .join('&');
  }

  // Join all query params into the search-string part of the URL
  let orderParams = orderBy.length ? serializeOrder(orderBy) : null;
  let anyParamIsProvided = concatenatedFieldParams || operationsParam || orderParams;

  if (!anyParamIsProvided) return '';
  if (!concatenatedFieldParams) return `${orderParams}`;

  operationsParam = operationsParam ? `&${operationsParam}` : '';
  orderParams = orderParams ? `&${orderParams}` : '';
  return `${concatenatedFieldParams || ''}${operationsParam}${orderParams}`;
}
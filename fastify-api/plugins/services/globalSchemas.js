import S from 'fluent-json-schema';
import { isObject } from './utils.js';

export default {
  getQueryPageLimitSchema: ({
    defaultPageSize = 10,
    maxPageSize = 500
  } = {}) => S.number()
    .id('#global.pageLimit')
    .multipleOf(1)
    .minimum(1)
    .maximum(maxPageSize)
    .default(defaultPageSize)
    .description('The total entries to retrieve from the database')
    .examples([defaultPageSize, maxPageSize]),

  getQueryPageOffsetSchema: () => S.number()
    .id('#global.pageOffset')
    .multipleOf(1)
    .minimum(0)
    .default(0)
    .description('The offset from where to start retrieving the entries')
    .examples([0, 5]),

  getQueryOrderFieldsSchema: () => S.object()
    .id('#global.orderFields')
    .additionalProperties(true)
    .description('The specified order for the retrieved entries. Order '
      + 'params have the following format e.g. '
      + '{"ord[name]": "asc", "ord[age]": "desc"}')
    .examples([
      {
        'ord[name]': 'asc'
      },
      {
        'ord[name]': 'asc',
        'ord[age]': 'desc'
      }
    ]),

  getQueryFilterFieldsSchema: () => S.object()
    .id('#global.filterFields')
    .additionalProperties(true)
    .description('The query request used to retrieved entries from the database. '
      + 'Filter params have the following format e.g. {"fld[age][gt][1]": 10, '
      + '"fld[age][lt][2]": 40, "ops": "([1]AND[2])"}')
    .examples([
      {
        'fld[age][opGt][1]': 10
      },
      {
        'fld[age][opGt][1]': 10,
        'fld[age][opLt][2]': 40,
        ops: '([1]AND[2])'
      },
      {
        'fld[age][opGt][1]': 10,
        'fld[age][opLt][2]': 40,
        'fld[age][opIn][3]': '44,45,50',
        ops: '([1]AND[2])OR([3])'
      }
    ]),

  getResponseMessagesSchema: () => S.array()
    .id('#global.responseMessages')
    .items(S.object()
      .prop('code', S.string()
        .pattern('^\\d{3}.\\d{3}.\\d{3}$')
        .description('Error code specified for the application')
        .examples(['003.0.1', '003.103.35']))
      .prop('type', S.number().enum([2, 1, 0])
        .description('The type of the received message: '
          + '0 = Info, 1 = Warning, 2 = Error')
        .examples([2, 1, 0]))
      .prop('details', S.array().items(
        S.object()
          .prop('field', S.string()
            .description('The field targeted by the message')
            .examples(['name', 'properties.status']))
          .prop('content', S.string()
            .description('The message text')
            .examples(['The field status is missing', 'An error occurred']))
      )))
    .description('The message details')
    .examples([
      {
        field: 'properties.status',
        content: 'The field properties.status is missing'
      },
      {
        field: 'name',
        content: 'The name property is too small'
      }
    ]),

  getResponseMetaSchema: () => S.object()
    .id('#global.responseMeta')
    .prop('end', S.boolean()
      .description('If true informs that there are more entries to be retrieved')
      .examples([true, false]))
    .prop('count', S.number()
      .multipleOf(1)
      .minimum(0)
      .description('Number of retrieved entries. '
        + 'Cannot be higher than specified limit')
      .examples([10, 20]))
    .prop('total_items', S.number()
      .multipleOf(1)
      .minimum(0)
      .description('Total number of entries in database')
      .examples([10, 20])),

  getErrorResponseSchema: () => S.object()
    .id('#global.errorResponse')
    .description('Internal server error response')
    .prop('data', S.array().raw({ nullable: true }))
    .prop('messages', S.ref('#global.responseMessages')),

  getTotalCountSchema: () => S.boolean()
    .id('#global.totalCount')
    .description('Flag to retrieve the total entries from the database or not.')
    .examples([true, false]),

  getUuidSchema: () => S.string()
    .id('#global.uuid')
    .format('uuid')
    .description('Unique entry identifier')
    .examples(['f5934803-aa2b-4c21-acfa-b2386ca0e5de']),

  getIdSchema: () => S.number()
    .id('#global.id')
    .multipleOf(1)
    .minimum(1)
    .description('Database id (should be used as needed, prefer UUID if you can)')
    .examples([1, 23, 422, 24224]),

  getNameSchema: () => S.string()
    .id('#global.name')
    .minLength(2)
    .maxLength(100)
    .pattern('^[a-zA-Z\\u00C0-\\u1FFF\\u2C00-\\uD7FF]+([ \'-][a-zA-Z\\u00C0-\\u1FFF\\u2C00-\\uD7FF]+){0,4}$')
    .description('Name (first, middle or last) of a person, only 4 \', space or - characters are'
      + 'allowed as internal separators and they cannot occupy more than one consecutive position '
      + 'e.g. `--` or `-\'` or  `\' -`, and they cannot be placed at the start or end')
    .examples(["O'Connor", 'Ana-Maria', 'George', 'van der Built']),

  getIdentifierNameSchema: () => S.string()
    .id('#global.identifierName')
    .minLength(2)
    .maxLength(100)
    .pattern('^[a-zA-Z0-9ĂÎÂȘȚăîâșț]+([ \\.]?[-_a-zA-Z0-9ĂÎÂȘȚăîâșț]+){0,15}$')
    .description('Generic identifier name with [-_a-zA-Z0-9ĂÎÂȘȚăîâșț] allowed, '
      + 'only 15 spaces or . characters are allowed as internal '
      + 'separators and they cannot occupy more than one consecutive position '
      + 'e.g. `  ` or `..` or  ` .`, and they cannot be placed at the start or end'),

  getPhoneRoSchema: () => S.string()
    .id('#global.phoneRo')
    .minLength(10)
    .maxLength(10)
    .pattern('^0\\d{9}$')
    .description('The phone number of the account holder for Romanian number only')
    .examples(['0712123123']),

  getSearchForSchema: () => S.string()
    .id('#global.searchFor')
    .minLength(0)
    .maxLength(100)
    .default('')
    .description('The search field used to filter entries')
    .examples(['escu', 'name']),

  getEmailSchema: () => S.string()
    .id('#global.email')
    .minLength(5)
    .maxLength(100)
    .description('Email format taken from https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch04s01.html#validation-email-solution-tld')
    .pattern('^[\\w!#$%&\'*+/=?`{|}~^-]+(?:\\.[\\w!#$%&\'*+/=?`{|}~^-]+)*'
      + '@(?:[A-Za-z0-9-]+\\.)+[A-Za-z]{2,30}$')
    .examples(['george.popescu@gmail.com']),

  getPostalCodeSchema: () => S.string()
    .id('#global.postalCode')
    .minLength(6)
    .maxLength(6)
    .description('Romanian post code format, from https://ro.wikipedia.org/wiki/Cod_po%C8%99tal')
    .pattern('^\\d{6}$')
    .examples(['020151'])
};

/**
 * Add JSON schema property to remove unexpected object properties
 *
 * @param {any} data - sub-schema to be transformed
 * @returns {object} transformed schema
 */
export function updateSchema(data) {
  if (Array.isArray(data)) {
    return data.map(updateSchema);
  } if (isObject(data)) {
    const result = {};
    Object.entries(data).forEach(([key, val]) => {
      result[key] = updateSchema(val);
    });

    if (result.type === 'object') {
      // Add setting that removes unexpected properties
      // only if not explicitly specified
      result.additionalProperties = result.additionalProperties || false;
    }
    return result;
  }
  return data;
}
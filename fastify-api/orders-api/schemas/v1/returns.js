import path from 'path';
import fp from 'fastify-plugin';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin contains all the basic schemas needed for returns
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
async function addReturnsSchemasAsync(fastify) {
  const { utils: { S, capitalizeFirstLetter }, getSchema } = fastify;
  const resourceTag = `[${version}] ${capitalizeFirstLetter(moduleName)}`;

  const addressSchema = S.object()
    .description('The instance data to persist in the database')
    .additionalProperties(false)
    .prop('recipient_name', getSchema('#global.name').id('#recipient_name')
      .description('The full name of the recipient if used as a delivery address')
      .examples(['George Popescu'])
      .required())
    .prop('recipient_phone', S.string()
      .maxLength(10)
      .minLength(10)
      .pattern('^0\\d{9}$')
      .description('The phone number of the contact person (recipient) used for delivery')
      .examples(['0735123456'])
      .required())
  // TODO: add required when DMS is implemented
    .prop('county', getSchema('#global.uuid').id('#county')
      .description('The county for the address')
      .examples(['06b76219-46e6-4f47-88e4-7d247c1aa6b8']))
  // TODO: add required when DMS is implemented
    .prop('city', getSchema('#global.uuid').id('#city')
      .description('The city for the address')
      .examples(['06b76219-46e6-4f47-88e4-7d247c1aa6b8']))
    .prop('street', S.string()
      .minLength(2)
      .maxLength(100)
      .description('The Street section of the address')
      .examples(['Bd. Marasesti'])
      .required())
    .prop('street_no', S.string()
      .minLength(1)
      .maxLength(20)
      .pattern('^(?!\\W)[\\w\\W]+$')
      .description('The Street Number section of the address')
      .examples([1, 102])
      .required())
    .prop('address_details', S.string()
      .minLength(0)
      .maxLength(200)
      .description('The rest of the address')
      .raw({ nullable: true })
      .examples(['Scara 3, Ap. 12, Et. 1']))
    .prop('postcode', S.string()
      .minLength(6)
      .maxLength(6)
      .pattern('^\\d{6}$')
      .description('The postal code of the address')
      .raw({ nullable: true })
      .examples(['020151']));

  const productSchema = S.object()
    .id(`#${moduleName}.product`)
    .prop('pid', S.string())
    .prop('reason', S.string())
    .prop('quantity', S.number()
      .multipleOf(1)
      .minimum(1))
    .prop('price', S.string());

  const returnPayloadSchema = S.object()
    .id(`#${moduleName}.payload`)
    .additionalProperties(false)
    .description('The instance for a new return in the database')
    .prop('return_type', S.string()
      .required())
    .prop('pickup_method', S.string().required())
    .prop('recipient_name', getSchema('#global.name').id('#recipient_name')
      .description('The full name of the recipient if used as a delivery address')
      .examples(['George Popescu'])
      .required())
    .prop('recipient_phone', S.string()
      .maxLength(10)
      .minLength(10)
      .pattern('^0\\d{9}$')
      .description('The phone number of the contact person (recipient) used for delivery')
      .examples(['0735123456'])
      .required())
    .prop('county', S.string().id('#county')
      .description('The county for the address')
      .examples(['06b76219-46e6-4f47-88e4-7d247c1aa6b8']))
    .prop('city', S.string().id('#city')
      .description('The city for the address')
      .examples(['06b76219-46e6-4f47-88e4-7d247c1aa6b8']))
    .prop('street', S.string()
      .minLength(2)
      .maxLength(100)
      .description('The Street section of the address')
      .examples(['Bd. Marasesti'])
      .required())
    .prop('street_no', S.string()
      .minLength(1)
      .maxLength(20)
      .pattern('^(?!\\W)[\\w\\W]+$')
      .description('The Street Number section of the address')
      .examples([1, 102])
      .required())
    .prop('address_details', S.string()
      .minLength(0)
      .maxLength(200)
      .description('The rest of the address')
      .raw({ nullable: true })
      .examples(['Scara 3, Ap. 12, Et. 1'])
      .required())
    .prop('postcode', S.string()
      .minLength(6)
      .maxLength(6)
      .pattern('^\\d{6}$')
      .description('The postal code of the address')
      .raw({ nullable: true })
      .examples(['020151'])
      .required())
    .prop('customer_iban', S.string()
      .minLength(15)
      .maxLength(34)
      .examples(['RO49AAAA1B31007593840000'])
      .pattern('^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$'))
    .prop('customer_bank', S.string()
      .minLength(2)
      .maxLength(100)
      .description('Name of the bank for the main company account')
      .examples(['Second Bank']))
    .prop('bank_account_beneficiary', getSchema('#global.name').id('#bank_account_beneficiary')
      .description('The full name of the name from the customer\'s account')
      .examples(['George Popescu']))
    .prop('products', S.array()
      .items(S.object()
        .prop('pid', S.string().required())
        .prop('reason', S.string().required())
        .prop('quantity', S.number().required()
          .multipleOf(1)
          .minimum(1)))
      .minItems(1)
      .required())
    .prop('created_at', S.string()
      .format('date-time'))
    .prop('modified_at', S.string()
      .format('date-time'));

  const responseCreateOneSchema = S.object()
    .id(`#${moduleName}.payload.response`)
    .additionalProperties(false)
    .description('The response received after creating one return')
    .prop('increment_id', S.string()
      .pattern('^EXP\\d{10}$')
      .description('Order number')
      .examples(['EXP0000000059'])
      .required())
    .prop('status', S.string().required())
    .prop('return_suffix', S.number().multipleOf(1).required())
    .prop('return_type', S.string().required())
    .prop('pickup_method', S.string().required())
    .prop('recipient_name', getSchema('#global.name').id('#recipient_name')
      .description('The full name of the recipient if used as a delivery address')
      .examples(['George Popescu'])
      .required())
    .prop('recipient_phone', S.string()
      .maxLength(10)
      .minLength(10)
      .pattern('^0\\d{9}$')
      .description('The phone number of the contact person (recipient) used for delivery')
      .examples(['0735123456'])
      .required())
    .prop('county', S.string().id('#county')
      .description('The county for the address')
      .examples(['06b76219-46e6-4f47-88e4-7d247c1aa6b8']))
    .prop('city', S.string().id('#city')
      .description('The city for the address')
      .examples(['06b76219-46e6-4f47-88e4-7d247c1aa6b8']))
    .prop('street', S.string()
      .minLength(2)
      .maxLength(100)
      .description('The Street section of the address')
      .examples(['Bd. Marasesti'])
      .required())
    .prop('street_no', S.string()
      .minLength(1)
      .maxLength(20)
      .pattern('^(?!\\W)[\\w\\W]+$')
      .description('The Street Number section of the address')
      .examples([1, 102])
      .required())
    .prop('address_details', S.string()
      .minLength(0)
      .maxLength(200)
      .description('The rest of the address')
      .raw({ nullable: true })
      .examples(['Scara 3, Ap. 12, Et. 1'])
      .required())
    .prop('postcode', S.string()
      .minLength(6)
      .maxLength(6)
      .pattern('^\\d{6}$')
      .description('The postal code of the address')
      .raw({ nullable: true })
      .examples(['020151'])
      .required())
    .prop('customer_iban', S.string()
      .minLength(15)
      .maxLength(34)
      .examples(['RO49AAAA1B31007593840000'])
      .pattern('^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$')
      .required())
    .prop('customer_bank', S.string()
      .minLength(2)
      .maxLength(100)
      .description('Name of the bank for the main company account')
      .examples(['Second Bank'])
      .required())
    .prop('bank_account_beneficiary', getSchema('#global.name').id('#bank_account_beneficiary')
      .description('The full name of the name from the customer\'s account')
      .examples(['George Popescu'])
      .required())
    .prop('products', S.array()
      .items(S.object()
        .prop('pid', S.string().required())
        .prop('reason', S.string().required())
        .prop('quantity', S.number().required()
          .multipleOf(1)
          .minimum(1)))
      .minItems(1)
      .required())
    .prop('created_at', S.string()
      .format('date-time'))
    .prop('modified_at', S.string()
      .format('date-time'));

  const responseDataSchemaList = S.object()
    .id(`#${moduleName}.data.list`)
    .additionalProperties(false)
    .prop('return_suffix', S.number().required())
    .prop('status', S.string().required())
    .prop('return_type', S.string().required())
    .prop('increment_id', S.string()
      .pattern('^EXP\\d{10}$')
      .description('Order number')
      .examples(['EXP0000000059'])
      .required())
    .prop('customer_name', S.string()
      .description('Client name')
      .examples(['George Popescu'])
      .required())
    .prop('pickup_method', S.string().required())
    .prop('order_created_at', S.string()
      .format('date-time').required())
    .prop('return_created_at', S.string()
      .format('date-time'))
    .prop('return_modified_at', S.string()
      .format('date-time'));

  const schemaCollection = {
    findMany: {
      description: 'Find all returns in the database',
      summary: 'List returns',
      tags: [resourceTag],
      query: S.object()
        .prop('limit', getSchema('#global.pageLimit'))
        .prop('offset', getSchema('#global.pageOffset'))
        .prop('total_count', getSchema('#global.totalCount'))
        .prop('where', getSchema('#global.filterFields'))
        .prop('order', getSchema('#global.orderFields')),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object()
            .prop('meta', getSchema('#global.responseMeta'))
            .prop('data', S.array().items(responseDataSchemaList))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    createOne: {
      description: '',
      summary: '',
      tags: [resourceTag],
      body: returnPayloadSchema,
      params: S.object()
        .prop('increment_id', S.string()
          .maxLength(50)
          .description('Order number')
          .required()),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('data', responseCreateOneSchema)
        ),
        400: getSchema('#global.response.400'),
        404: getSchema('#global.response.404'),
        500: getSchema('#global.response.500')
      }
    }
  };

  if (!fastify.schemaCollections[version]) {
    fastify.schemaCollections[version] = {};
  }

  fastify.schemaCollections[version][moduleName] = schemaCollection;
}

export default fp(addReturnsSchemasAsync);
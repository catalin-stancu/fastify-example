import path from 'path';
import fp from 'fastify-plugin';
import { fileURLToPath } from 'url';

const moduleName = path.basename(import.meta.url).split('.')[0];
const version = fileURLToPath(import.meta.url).split(path.sep).slice(-2)[0];

/**
 * This plugin contains all the basic schemas needed for orders
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
async function addOrdersSchemasAsync(fastify) {
  const { utils: { S, capitalizeFirstLetter }, getSchema } = fastify;
  const resourceTag = `[${version}] ${capitalizeFirstLetter(moduleName)}`;

  /**
   * Generate price schema with description
   *
   * @param {string} description description to be added to the schema
   * @return {object} schema
   */
  const generatePriceSchema = description => S.string()
    .description(description)
    .maxLength(20)
    .required();

  const priceSchema = S.string()
    .description()
    .maxLength(20)
    .required();

  const orderCommonSchema = S.object()
    .id(`#${moduleName}`)
    .additionalProperties(false)
    .description('The order metadata to persist in the database')
    .prop('increment_id', S.string()
      .pattern('^EXP\\d{10}$')
      .description('Order number')
      .examples(['EXP0000000059'])
      .required())
    .prop('total', S.string()
      .description('Order value')
      .examples(['1223.00'])
      .required())
    .prop('registered_at', S.string()
      .format('date-time')
      .description('The date when the order was places')
      .examples(['2021-07-20T12:55:15.050Z'])
      .required())
    .prop('status', S.string()
      .description('Order status')
      .examples(['New'])
      .required());

  const orderResponseDataListSchema = S.mergeSchemas(
    S.object()
      .description('Order structure')
      .prop('client_name', S.string()
        .description('Account holder name')
        .examples(['George Popescu']))
      .prop('created_at', S.string()
        .format('date-time')
        .description('The date when the order was created')
        .examples(['2020-04-09T11:18:15.445Z']))
      .prop('modified_at', S.string()
        .format('date-time')
        .description('The date when the order was modified')
        .examples(['2020-06-09T11:18:15.445Z'])),
    orderCommonSchema
  );

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
      .examples(['Scara 3, Ap. 12, Et. 1']))
    .prop('postcode', S.string()
      .minLength(6)
      .maxLength(6)
      .pattern('^\\d{6}$')
      .description('The postal code of the address')
      .raw({ nullable: true })
      .examples(['020151']))
    .prop('company_name', S.string()
      .minLength(2)
      .maxLength(100)
      .description('Name of the company')
      .examples(['Best Company SRL']))
    .prop('company_fiscal_code', S.string()
      .minLength(2)
      .maxLength(12)
      .pattern('^(RO)?\\d{2,10}$')
      .description('Fiscal Identification Code (CIF / CUI / VAT Tax code),'
      + ' format from https://www.contzilla.ro/cif-cui-nr-registrul-comertului/')
      .examples(['RO1234567890', '1234567890']))
    .prop('company_bank', S.string()
      .minLength(2)
      .maxLength(100)
      .description('Name of the bank for the main company account')
      .examples(['Second Bank']))
    .prop('company_iban', S.string()
      .minLength(15)
      .maxLength(34)
      .examples(['RO49AAAA1B31007593840000'])
      .pattern('^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$'))
    .prop('company_reg_no', S.string()
      .description('Company registration number , optional i.e. null for NGOs')
      .examples(['J40/1234567/2021'])
      .minLength(10)
      .maxLength(16)
      .pattern('^[JFC]\\d{2}\\/\\d{1,7}\\/\\d{4}$')
      .raw({ nullable: true }));

  const orderItemSchema = S.object()
    .additionalProperties(false)
    .prop('pid', S.string()
      .description('Product ID')
      .required())
    .prop('quantity', S.number()
      .description('Quantity of the item in the suborder')
      .minimum(1)
      .required())
    .prop('base_price', S.string()
      .description('Base price of the item before discount')
      .required())
    .prop('price', S.string()
      .description('Price of the item')
      .required())
    .prop('discount', S.string()
      .description('Discount applied for the item')
      .required())
    .prop('total', S.string()
      .description('The result obtained after multiplying the product price by '
      + 'the quantity of the product')
      .required())
    .prop('product_parent_id', S.number()
      .description('ID of the product\'s parent, in case other product variations exist'))
    .prop('vendor', S.number()
      .description('Vendor name')
      .required())
    .prop('name', S.string()
      .description('Name of the product')
      .required())
    .prop('image', S.string()
      .description('Image for the product')
      .required())
    .prop('url_key', S.string()
      .description('URL key'));

  const orderResponseDataSingleSchema = S.mergeSchemas(
    S.object()
      .prop('discount', S.string()
        .description('Discount applied for the item'))
      .prop('items', S.array().items(orderItemSchema))
      .prop('address', S.object()
        .prop('billing', addressSchema)
        .prop('shipping', addressSchema))
      .prop('created_at', S.string()
        .format('date-time')
        .description('The date when the order was created')
        .examples(['2020-04-09T11:18:15.445Z']))
      .prop('modified_at', S.string()
        .format('date-time')
        .description('The date when the order was modified')
        .examples(['2020-06-09T11:18:15.445Z'])),
    orderCommonSchema
  );

  const schemaCollection = {
    findMany: {
      description: 'Find all orders in the database',
      summary: 'List orders',
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
            .prop('data', S.array().items(orderResponseDataListSchema))
        ),
        400: getSchema('#global.response.400'),
        500: getSchema('#global.response.500')
      }
    },
    findOne: {
      description: 'Find an order with the specified number',
      summary: 'Display one order',
      tags: [resourceTag],
      params: S.object()
        .prop('increment_id', S.string()
          .maxLength(50)
          .description('Order number')
          .required()),
      query: S.object()
        .prop('available_quantities', S.boolean()
          .default(false)),
      response: {
        200: S.mergeSchemas(
          getSchema('#global.response.200'),
          S.object().prop('data', orderResponseDataSingleSchema)
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

export default fp(addOrdersSchemasAsync);
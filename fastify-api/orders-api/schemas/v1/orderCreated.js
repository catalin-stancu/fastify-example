import fp from 'fastify-plugin';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin contains the schema to validate against the message for oms-checkout-order-created
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @returns {Promise<void>}
 * @async
 */
async function orderCreatedCheckoutSchemaAsync(fastify) {
  const { utils, getSchema } = fastify;
  const { S } = utils;

  const priceSchema = S.string()
    .maxLength(20)
    .required();

  const imageVariantsSchema = S.object()
    .additionalProperties(S.object()
      .description('Viewport variants')
      .additionalProperties(S.object()
        .description('Viewport resolution variant')
        .prop('width', S.number()
          .examples([1024])
          .required()
          .minimum(1)
          .multipleOf(1))
        .prop('height', S.number()
          .examples([768])
          .required()
          .minimum(1)
          .multipleOf(1))
        .prop('url', S.string())))
    .required();

  const orderItemSchema = S.object()
    .prop('id', S.number()
      .required())
    .prop('pid', S.string()
      .maxLength(100)
      .required())
    .prop('quantity', S.number()
      .minimum(0)
      .required())
    .prop('base_price', priceSchema)
    .prop('price', priceSchema)
    .prop('discount', priceSchema)
    .prop('total', priceSchema)
    .prop('parent_id', S.number()
      .raw({ nullable: true }))
    .prop('vendor', S.number()
      .required())
    .prop('name', S.string()
      .maxLength(255)
      .required())
    .prop('image', imageVariantsSchema)
    .prop('url_key', S.string()
      .maxLength(500)
      .required());

  const addressSchema = S.object()
    .prop('recipient_name', getSchema('#global.name')
      .required())
    .prop('recipient_phone', S.string()
      .maxLength(10)
      .minLength(10)
      .pattern('^0\\d{9}$')
      .required())
    .prop('county', S.string()
      .maxLength(32)
      .required())
    .prop('city', S.string()
      .maxLength(32)
      .required())
    .prop('street', S.string()
      .maxLength(100)
      .required())
    .prop('street_no', S.string()
      .maxLength(20)
      .pattern('^(?!\\W)[\\w\\W]+$')
      .required())
    .prop('address_details', S.string()
      .maxLength(200)
      .required()
      .raw({ nullable: true }))
    .prop('postcode', S.string()
      .minLength(6)
      .maxLength(6)
      .pattern('^\\d{6}$')
      .required()
      .raw({ nullable: true }))
    .prop('company_name', S.string()
      .maxLength(100)
      .raw({ nullable: true }))
    .prop('company_fiscal_code', S.string()
      .maxLength(12)
      .pattern('^(RO)?\\d{2,10}$')
      .raw({ nullable: true }))
    .prop('company_bank', S.string()
      .maxLength(100)
      .raw({ nullable: true }))
    .prop('company_iban', S.string()
      .minLength(15)
      .maxLength(34)
      .examples(['RO49AAAA1B31007593840000'])
      .pattern('^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$')
      .raw({ nullable: true }))
    .prop('company_reg_no', S.string()
      .minLength(10)
      .maxLength(16)
      .pattern('^[JFC]\\d{2}\\/\\d{1,7}\\/\\d{4}$')
      .raw({ nullable: true }))
    .minProperties(6);

  const payloadSchema = S.object()
    .id(`#${moduleName}`)
    .description('The order metadata to persist in the database')
    .additionalProperties(true)
    .prop('increment_id', S.string()
      .pattern('^EXP\\d{10}$')
      .description('Order number')
      .examples(['EXP0000000059'])
      .required())
    .prop('total', priceSchema)
    .prop('discount', priceSchema)
    .prop('registered_at', S.string()
      .maxLength(50)
      .required())
    .prop('items', S.array()
      .items(orderItemSchema)
      .minItems(1)
      .required())
    .prop('address', S.object()
      .prop('shipping', addressSchema)
      .prop('billing', addressSchema)
      .required())
    .valueOf();

  fastify.addSchema(payloadSchema);
}

export default fp(orderCreatedCheckoutSchemaAsync);
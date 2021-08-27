import testHelper from './index.js';

const {
  frisby
} = testHelper;

const { Joi } = frisby;

const INSTANCE_ERROR_MESSAGE = Joi.object({
  field: Joi.string(),
  content: Joi.string()
});

const INSTANCE_SCHEMA_ERROR_DATA = Joi.object({
  statusCode: Joi.number().valid(200, 400, 404, 401),
  name: Joi.string(),
  code: Joi.string().regex(new RegExp('^\\d{3}.\\d*.\\d*$')),
  type: Joi.number().valid(0, 1, 2),
  details: Joi.array().items(INSTANCE_ERROR_MESSAGE),
  status: Joi.number().valid(200, 400, 404, 401),
  stack: Joi.string()
});

const INSTANCE_SCHEMA_ERROR = Joi.object({
  meta: Joi.object().allow({}),
  messages: Joi.array().items(INSTANCE_SCHEMA_ERROR_DATA),
  data: Joi.object().allow({}, null)
});

const INSTANCE_SCHEMA_LIST_METADATA = Joi.object({
  total_items: Joi.number().integer().positive().allow(0),
  end: Joi.boolean(),
  count: Joi.number().integer().positive().allow(0)
});

export default {
  INSTANCE_SCHEMA_ERROR_DATA,
  INSTANCE_SCHEMA_ERROR,
  INSTANCE_SCHEMA_LIST_METADATA
};
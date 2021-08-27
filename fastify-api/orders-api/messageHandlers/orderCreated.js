import path from 'path';
import { OrderHelper } from '../helpers/orderHelper.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * Handle every message received in the notification PubSub subscription
 *
 * @param {object} opts parameters object
 * @param {function} opts.validateMessage - function to validate a message according to a schema
 * @param {object} opts.orderService - Orders Service
 * @param {class} opts.orderHelper - Orders Helper class
 * @param {function} opts.publishMessageAsync - function which publishes a message to topic
 * @param {object} opts.topicsObject - object containing the instance for each publishing topic
 * @param {object} opts.logger - logger instance
 * @returns {function} messageHandlerAsync - function to handle every message
 *   received via the PubSub subscription to which is is attached
 *   (on the 'message' event)
 */
export function orderCreated(opts) {
  const {
    validateMessage,
    orderService,
    orderHelper,
    publishMessageAsync,
    topicsObject,
    logger
  } = opts;

  /**
   * Handle every message received in the orders PubSub subscription
   *
   * @param {object} message
   *   [Message payload](https://googleapis.dev/nodejs/pubsub/latest/Message.html)
   * @returns {Promise<void>}
   * @async
   */
  async function messageHandlerAsync(message = {}) {
    try {
      const { data, deliveryAttempt } = message;
      let payload;

      try {
        payload = JSON.parse(data);
      } catch (err) {
        logger.error(err, `[${moduleName}] Received invalid JSON from checkout.`);
        message.ack();
        return;
      }

      logger.info(`[${moduleName}] Received order from checkout `
       + `in delivery attempt ${deliveryAttempt}`);

      // Stop message processing if it's not valid
      if (!validateMessage(message, payload, `#${moduleName}`)) return;

      // Add fields that are currently missing from checkout response
      const validOrder = orderHelper.formatFieldsForOMS(payload);

      const { increment_id: createdOrderNumber } = await orderService.createOneAsync(validOrder);

      if (!createdOrderNumber) {
        message.ack();
        return;
      }

      logger.info(`[${moduleName}] Order from checkout was saved.`);

      message.ack();
      logger.info(`[${moduleName}] PubSub message was acknowledged successfully.`);

      // Use findOne for better formatting
      const createdOrderWithDetails = await orderService.findOneAsync(createdOrderNumber);

      const formattedOrder = OrderHelper.formatFieldsForCOM(createdOrderWithDetails);

      // publish message to `oms-order-created` topic
      await publishMessageAsync(topicsObject.orderCreated, formattedOrder);
    } catch (err) {
      logger.error(err, `[${moduleName}] Error during PubSub message handling`);

      // This doesn't ack the message, but allows more messages to be retrieved
      // if the limit was hit or if you don't want to ack the message.
      message.nack();
    }
  }

  return messageHandlerAsync;
}
import fp from 'fastify-plugin';
import { PubSub } from '@google-cloud/pubsub';
import path from 'path';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates the Google Cloud Platform PubSub client
 *
 * [Quickstart / SDK setup](https://cloud.google.com/pubsub/docs/quickstart-client-libraries)
 *
 * [Node.js client docs](https://googleapis.dev/nodejs/pubsub/latest/index.html)
 *
 * [Code samples](https://cloud.google.com/pubsub/docs/samples)
 *
 * [How to create service account credentials](https://cloud.google.com/pubsub/docs/building-pubsub-messaging-system#create_service_account_credentials)
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {number} [opts.maxBatchSizeOnPublish = 100] - messages are batched when
 *   publishing them and this parameter sets the max size of the batch buffer
 * @param {number} [opts.maxBatchPublishWaitTimeSec  = 0.01] - max time to wait
 *   in seconds before publishing a batch of messages since it is created. We
 *   batch message publishing but we have a timeout so we don't wait too long.
 * @param {number} [opts.maxPulledMessages = 100] - max number of messages to
 *   pull at once
 * @param {number} [opts.maxSubscriberStreams = 5] - max number of subscriber
 *   streams to use in subscribers
 * @param {number} [opts.ackDeadlineSec = 10] - maximum time in sec we have before we
 *   can acknowledge receipt / processing of a message pulled from a subscription
 * @param {boolean} [opts.checkExistenceOnStartup = true] - if true the subscription
 *   and topics are first checked if they exist before connecting to them
 * @param {string} opts.projectName - tag used to store as metadata in published
 *   messages so that we can the microservice which published the message
 * @returns {Promise<void>}
 * @async
 */
async function pubSubAsync(fastify, opts) {
  const {
    maxBatchSizeOnPublish = 100,
    maxBatchPublishWaitTimeSec = 0.01,
    maxPulledMessages = 100,
    maxSubscriberStreams = 5,
    ackDeadlineSec = 10,
    checkExistenceOnStartup = true,
    projectName
  } = opts;

  const { httpErrors } = fastify.utils;

  // This list stores all promises related to graceful shutdown closing
  // This is needed because we don't want to close the PubSub client
  // connection before the subscriber / topic connection
  const closingConnectionPromises = [];

  // PubSub client configuration is taken from the filepath stored in the
  // GOOGLE_APPLICATION_CREDENTIALS env variable (as the docs recommend)
  // See https://cloud.google.com/docs/authentication/production
  const pubSubClient = new PubSub();

  /**
   * Create a reference for a topic in PubSub
   *
   * @param {string} topicName - topic to publish to in PubSub
   * @param {object} config - publish options
   *{@link https://googleapis.dev/nodejs/pubsub/latest/global.html#PublishOptions}
   * @returns {Promise<void>}
   * @async
   */
  async function createTopicConnectionAsync(topicName, config = {}) {
    if (checkExistenceOnStartup) {
      const [topicExists] = await pubSubClient.topic(topicName).exists();

      if (!topicExists) {
        throw new Error('There is no topic with the specified name');
      }
    }

    // References an existing topic
    const topic = pubSubClient
      .topic(topicName, {
        batching: {
          maxMessages: maxBatchSizeOnPublish,
          maxMilliseconds: maxBatchPublishWaitTimeSec * 1000
        },
        ...config
      });

    fastify.addHook('onClose', async () => {
      const closeTopicPromise = topic.flush();
      closingConnectionPromises.push(closeTopicPromise);
      return closeTopicPromise;
    });

    return topic;
  }

  /**
   * Publish a message to a topic in PubSub
   *
   * @param {Topic} topic - topic instance to publish to in PubSub
   * @param {object} data - data to publish
   * @param {object} attributes - attributes to attach to the published message
   * @param {string} orderingKey - ordering key used to order published messages
   * @returns {Promise<void>}
   * @async
   */
  async function publishMessageAsync(topic, data, attributes, orderingKey) {
    // Add an origin attribute by default to every message
    // to record the service that published it
    const customAttributes = {
      origin: projectName,
      ...attributes
    };

    // This friendlier syntax (from fastify-sensible) replaces try / catch
    const [publishError, messageId] = await fastify.utils.to(topic.publishMessage({
      json: data,
      attributes: customAttributes,
      ...({ orderingKey })
    }));

    if (publishError) {
      httpErrors.throwInternalServerError(
        `Received error while publishing on topic ${topic}: ${publishError.message}`,
        { errClass: 3 }
      );
    }

    fastify.log.trace(`Message with id ${messageId} published.`);
    return messageId;
  }

  /**
   * Asynchronously pull messages fom a topic in PubSub
   * @link https://googleapis.dev/nodejs/pubsub/latest/Subscription.html
   *
   * @param {string} subscriptionName - subscription name to listen in PubSub
   * @param {function} messageHandler - (message) => void function that
   *   handles every message; it must call the ack() or nack() methods on
   *   the message object before returning
   *
   *   See [Message structure here](https://googleapis.dev/nodejs/pubsub/latest/Message.html)
   * @param {object} config - subscription options
   *   https://googleapis.dev/nodejs/pubsub/latest/global.html#SubscriberOptions
   * @returns {Promise<void>}
   * @async
   * @example
   * function handler(message) {
   *    message.id = ID of the message.
   *    message.ackId = ID used to acknowledge the message reception.
   *    message.data = Contents of the message.
   *    message.attributes = Attributes of the message.
   *    message.publishTime = Timestamp when Pub/Sub received the message.
   *
   *    // "Ack" (acknowledge receipt of) the message
   *    message.ack();
   *
   *    // This doesn't ack the message, but allows more messages to be
   *    // retrieved if your limit was hit or if you don't want to
   *    // ack the message.
   *    message.nack();
   * }
   * listenForMessages('subscriptionName', handler);
   *
   * @summary
   * "All Subscription objects are instances of an EventEmitter. The
   * subscription will pull for messages automatically as long as there
   * is at least one listener assigned for the message event.
   *
   * You can adjust how many messages to process at any given time using
   * the options.flowControl.maxMessages setting.
   *
   * If your subscription is seeing more re-deliveries than preferable,
   * you might try:
   * - increasing the options.ackDeadline value
   * - decreasing the options.streamingOptions.maxStreams value.
   *
   * Subscription objects handle ack management, by automatically extending
   * the ack deadline while the message is being processed, to then issue
   * the ack or nack of such message when the processing is done.
   * Note: message redelivery is still possible."
   */
  async function startListeningForMessagesAsync(
    subscriptionName = '',
    messageHandler = () => null,
    config
  ) {
    if (checkExistenceOnStartup) {
      const [subscriptionExists] = await pubSubClient
        .subscription(subscriptionName)
        .exists();

      if (!subscriptionExists) {
        throw new Error('There is no subscription with the specified name');
      }
    }

    // References an existing subscription
    const subscription = pubSubClient.subscription(subscriptionName, {
      // Default options are set via plugin options but
      // they can be overridden by function options
      ackDeadline: ackDeadlineSec,
      flowControl: {
        maxMessages: maxPulledMessages,
        allowExcessMessages: false
      },
      streamingOptions: {
        maxStreams: maxSubscriberStreams
      },
      ...config
    });

    // Listen for new messages/errors until timeout is hit
    subscription.on('message', messageHandler);
    subscription.on('error', err => fastify.log.error(
      err, 'PubSub Subscription error'
    ));
    subscription.on('close', () => fastify.log.error(
      'PubSub Subscription connection closed unexpectedly'
    ));

    fastify.addHook('onClose', async () => {
      const closeSubscriptionPromise = subscription.close();
      closingConnectionPromises.push(closeSubscriptionPromise);
      return closeSubscriptionPromise;
    });
  }

  // Close PubSub client connections
  fastify.addHook('onClose', async () => {
    // Wait for opened topic and subscriber connections to flush / close
    await Promise.allSettled(closingConnectionPromises);

    // Close the subscriber and publisher client connections
    return Promise.allSettled([
      pubSubClient.v1.PublisherClient.close(),
      pubSubClient.v1.SubscriberClient.close()
    ]);
  });

  fastify.decorate('pubSub', {
    publishMessageAsync,
    createTopicConnectionAsync,
    startListeningForMessagesAsync
  });
}

export default fp(pubSubAsync, {
  name: moduleName
});
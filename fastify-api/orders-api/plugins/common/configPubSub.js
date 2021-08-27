import fp from 'fastify-plugin';
import path from 'path';
import fs from 'fs';
import pubSubPlugin from 'fastify-global-plugins/plugins/pubSub.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * This plugin encapsulates a Google PubSub client connection
 *
 * @param {Fastify} fastify - fastify server instance
 * @param {object} opts - options object
 * @param {string} opts.envIsDevelopment - variable telling if the environment is set to development
 * @param {string} opts.pubSub - PubSub plugin. Defaults to the plugin defined in global-plugins
 * @returns {Promise<void>}
 * @async
 */
async function configPubSubAsync(fastify, opts) {
  const { pubSub = pubSubPlugin } = opts;
  const {
    pubSubConfig,
    getSchema,
    validatorCompiler,
    helpers,
    messageHandlers,
    env,
    log,
    instantiatedServices
  } = fastify;
  const { orderService, orderHelper } = instantiatedServices;
  const { schemaValidator } = helpers;
  const { makeSchemaValidator } = schemaValidator;
  const topicPrefix = env.PUB_SUB_TOPIC_PREFIX;
  const subscriptionPrefix = env.PUB_SUB_SUBSCRIPTION_PREFIX;
  const { subscriptions, publishers } = pubSubConfig;

  const {
    maxBatchSizeOnPublish,
    maxBatchPublishWaitTimeSec,
    maxPulledMessages,
    maxSubscriberStreams,
    ackDeadlineSec
  } = pubSubConfig;

  // We provide the path relative to the CWD (server.js location)
  const { name: projectName } = JSON.parse(
    fs.readFileSync(path.resolve('./package.json'))
  );

  fastify.register(pubSub, {
    maxBatchSizeOnPublish,
    maxBatchPublishWaitTimeSec,
    maxPulledMessages,
    maxSubscriberStreams,
    ackDeadlineSec,
    projectName
  });

  // Wait until the above plugin is loaded, so that we have access to
  // the decorators introduced in the registration above
  await fastify.after();

  const {
    startListeningForMessagesAsync,
    createTopicConnectionAsync,
    publishMessageAsync
  } = fastify.pubSub;

  const subscriptionsConfig = [];
  const topicsObject = {};

  Object.keys(subscriptions).forEach(messageHandlerName => {
    const { subscriptionName } = subscriptions[messageHandlerName];

    subscriptionsConfig.push({ subscriptionName, messageHandlerName });
  });

  await Promise.all(
    Object.keys(publishers).map(async topicId => {
      const {
        topicName
      } = publishers[topicId];

      const topicInstance = await createTopicConnectionAsync(`${topicPrefix}${topicName}`);
      topicsObject[topicId] = topicInstance;

      log.info(`Topic instance for ${topicName} created`);
      return topicInstance;
    })
  );

  let messageHandlerInstantiationError;
  await Promise.all(subscriptionsConfig.map(async subConfig => {
    const { subscriptionName, messageHandlerName } = subConfig;

    // Start listening for messages from the PubSub checkout topic
    let messageHandlerAsync;
    try {
      const validateMessage = makeSchemaValidator(validatorCompiler, getSchema, log);

      messageHandlerAsync = messageHandlers[messageHandlerName][messageHandlerName]({
        validateMessage,
        orderService,
        orderHelper,
        publishMessageAsync,
        topicsObject,
        logger: log,
        env
      });
    } catch (error) {
      log.error(
        `Failed to instantiate message handler for subscription ${subscriptionName}`
      );
      messageHandlerInstantiationError = subscriptionName;
      return;
    }

    // Stop the loop if we can't instantiate a message handler
    if (messageHandlerInstantiationError) return;

    await startListeningForMessagesAsync(
      `${subscriptionPrefix}${subscriptionName}`,
      messageHandlerAsync
    );

    log.info(`Subscription ${subscriptionName} is listening for messages`);
  }));
}

export default fp(configPubSubAsync, {
  name: moduleName,
  dependencies: [
    'loadSchemas',
    'loadHelpers',
    'instantiateServices',
    'loadMessageHandlers'
  ]
});
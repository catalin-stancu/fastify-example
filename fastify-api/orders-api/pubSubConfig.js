export default {
  maxBatchSizeOnPublish: 100,
  maxBatchPublishWaitTimeSec: 0.01,
  maxPulledMessages: 100,
  maxSubscriberStreams: 5,
  ackDeadlineSec: 10,
  /**
  * messageHandlerName is the name of the file in which we define the message handler
  * for a specific topic. If we need to add a new message handler, we just need to
  * specify the file name in this config and it will be picked up and used.
  */

  subscriptions: {
    orderCreated: {
      subscriptionName: 'checkout-order-placed-oms'
    }
  },
  publishers: {
    orderCreated: {
      topicName: 'oms-order-created'
    }
  }
};
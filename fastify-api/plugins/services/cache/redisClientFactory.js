import Ioredis from 'ioredis';

const defaultRedisConfig = {
  // If all commands issued in one event loop are automatically pipelined,
  // the caching will start to throw nasty errors when under load, so we disable it
  enableAutoPipelining: false,

  // These options allow the client connection to not crash the server
  // if the connection to the redis server is dropped or the server
  // is unavailable, since caching is an optional service
  enableReadyCheck: true,
  connectTimeout: 15000,
  maxRetriesPerRequest: 0,
  enableOfflineQueue: false,
  autoResendUnfulfilledCommands: false,
  lazyConnect: false,

  /**
   * Handle retry strategy in case of connection errors
   *
   * @param {number} times - times this retry is called
   * @returns {number} delay until next retry
   */
  retryStrategy() {
    // Attempt to reconnect every 30 seconds
    return 30000;
  }
};

/**
 * Construct Redis client with specified or default config options
 *
 * @param {object} config - config options for redis client
 * @returns {ioredis} client instance
 */
function redisClientFactory(config) {
  const {
    log = { info: console.log, error: console.log },
    ...redisClientConfig
  } = config;

  const ioredisConfig = Object.assign(defaultRedisConfig, redisClientConfig);
  const redisClient = new Ioredis(ioredisConfig);

  redisClient.on('ready', () => log.info(
    'Connection to caching server established successfully'
  ));
  redisClient.on('end', () => log.info(
    'Connection to caching server is closed'
  ));
  redisClient.on('error', err => log.error(err,
    'Error in Redis connection'));

  return redisClient;
}

export default redisClientFactory;
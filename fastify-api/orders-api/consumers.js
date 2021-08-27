// When using ES6 modules strict mode is enabled by default

import fastify from 'fastify';
import {
  baseServerConfig,
  baseSetupConfig
} from 'fastify-global-plugins/baseConfig.js';
import consumersSetup from './consumersSetup.js';

// We cannot use the fastify-cli to run the app directly if we
// want to pass advanced options to the fastify server instance.
const fastifyConfig = {
  ...baseServerConfig
  // Add project specific overrides here
  // ...
};

// The default pino config formats the logs to JSON so we use
// a customized pretty-print version in development
if (process.env.NODE_ENV === 'development') {
  fastifyConfig.logger = {
    level: 'trace',
    timestamp: () => `,'time':'${new Date().toLocaleString()}'`,
    prettyPrint: {
      levelFirst: true,
      ignore: 'pid,hostname'
    }
  };
} else if (process.env.NODE_ENV !== 'production') {
  fastifyConfig.logger = {
    level: 'trace'
  };
}

// To be able to pass advanced options, we load all the plugins manually,
// based on the reference config from the fastify-global-plugins repository
(async () => {
  let app;

  try {
    app = fastify(fastifyConfig);
    app.register(consumersSetup, baseSetupConfig);
    // Wait for all the plugins to be loaded
    await app.ready();
  } catch (err) {
    if (app) {
      app.log.error(err);
    } else {
      console.error(err, 'Error during Consumers instantiation');
    }
    process.exit(1);
  }
})();
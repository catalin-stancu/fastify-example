/* eslint-disable no-unused-expressions */
import CHAI from 'chai';
import frisby from 'frisby';
import { v4 as uuid } from 'uuid';
import fastify from 'fastify';
import fastifyExplorer from 'fastify-explorer';
import fastifyDeprecations from 'fastify/lib/warnings.js';
import {
  baseServerConfig,
  baseSetupConfig
} from 'fastify-global-plugins/baseConfig.js';
import appSetup from '../../setup.js';

// Disable useless buggy deprecation warnings caused by fastify.inject() calls
fastifyDeprecations.emitted.set('FSTDEP001', true);
fastifyDeprecations.emitted.set('FSTDEP002', true);

const ASSERT = CHAI.assert;
const EXPECT = CHAI.expect;
const BASE_URL = `http://localhost:${process.env.PORT}/api/v1`;
const ENABLE_ALL_TESTS = true;

// declare common Fastify testing instance
let app;

// TODO: implement a method to automatically calculate this number
let testsToRun = 2;

/**
 * Promisify timeout
 *
 * @param {*} ms time in ms
 * @returns {Promise<null>}
 */
const waitAsync = ms => new Promise(resolve => {
  setTimeout(resolve, ms);
});

/**
 * Poll for a db change
 *
 * @param {Function} fn function returning a promise
 * @param {Function} condition function which will run a condition on the result of fn()
 * @param {number} pollIntervalMs poll interval in milliseconds
 * @param {Promise} stopHandler promise which resolves when we want to cancel the polling
 * @return {Promise}
 */
async function pollAsync(fn, condition, pollIntervalMs) {
  // eslint-disable-next-line no-async-promise-executor
  // start promise resulting from running fn()
  // since we don't await here, we will go straight to the next line
  const getOrderPromise = fn();

  // These next two lines do the following thing:
  // It will await {pollInterval} ms, and then, if getOrderPromise is not finished,
  // it will wait for the remaining time, until getOrderPromise is settled.
  // Thus, the total waiting time is bound between [1, (getOrderPromise settle time)] seconds
  await waitAsync(pollIntervalMs);
  const order = await getOrderPromise;

  if (condition(order)) {
    return order;
  // eslint-disable-next-line no-else-return
  }

  return pollAsync(fn, condition, pollIntervalMs);
}

/**
 * Create fastify test instance
 * @returns {object} fastify instance
 *
 */
async function createFastifyTestInstance() {
  if (!app) {
    app = fastify({
      ...baseServerConfig,
      // In tests show only errors from the log
      logger: {
        level: 'error',
        timestamp: () => `,'time':'${new Date().toLocaleString()}'`,
        prettyPrint: {
          levelFirst: true,
          ignore: 'pid,hostname'
        }
      }
    });

    // This plugin will allow us to access and mutate any decorator from fastify
    app.register(fastifyExplorer);
    app.register(appSetup, { ...baseSetupConfig, explorer: { name: 'override' } });

    // Wait for the test fastify instance to fully load
    await app.ready();
  }

  return app;
}

/**
 * Close fastify test instance
 * @param {string} moduleName name of the test file
 * @returns {object} fastify instance
 *
 */
async function closeFastifyTestInstance() {
  testsToRun -= 1;
  if (testsToRun === 0) return app.close();
}

/**
 * Function for testing responses
 *
 * @param {object} response Fastify response object resulted from inject method
 * @param {number} errorCode some sort of hash
 * @param {number} [classCode='000'] class code from the file
 * @returns {undefined}
 */
function expectErrorWithCode(response, errorCode, classCode = '000') {
  const data = response?.json()?.data;
  const meta = response?.json()?.meta;
  const messages = response?.json()?.messages;

  EXPECT(messages).to.not.be.empty;
  EXPECT(meta).to.be.undefined;
  EXPECT([null, undefined]).to.include(data);
  EXPECT(messages).to.have.length(1);
  EXPECT(messages[0].code).to.equal(`011.${classCode}.${errorCode}`);
}

export default {
  assert: ASSERT,
  EXPECT,
  BASE_URL,
  ENABLE_ALL_TESTS,
  frisby,
  uuid,
  pollAsync,
  waitAsync,
  createFastifyTestInstance,
  closeFastifyTestInstance,
  expectErrorWithCode
};
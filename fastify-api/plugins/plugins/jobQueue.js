import fp from 'fastify-plugin';
import path from 'path';
import { EventEmitter } from 'events';
import JobQueue from '../services/jobQueue.js';

const moduleName = path.basename(import.meta.url).split('.')[0];

/**
 * Creates piscina promises and push them to p-queue.
 * A URL filepath needs to be provided to the file which exports the job functions.
 *
 * The piscina library serves as an interface for Worker threads.
 * The p-queue library serves as an enqueuer for piscina's calls and also provides
 * the added option of setting different priorities for different jobs.
 *
 * Remark: piscina actually uses a fifo by default but it doesn't have a priority feature
 * https://github.com/piscinajs/piscina#custom-task-queues
 *
 * Piscina docs: https://github.com/piscinajs/piscina
 * p-queue docs: https://www.npmjs.com/package/p-queue
 *
 * @param {object} fastify - fastify instance
 * @param {object} opts - options object
 * @param {string} opts.fileName - file name which has the function to be
 *    put in the queue and take effect immediately
 * @param {EventEmitter} opts.changeEmitter - optional, if provided it should
 *    emit a `change` event whenever any run time options needs to be changed
 * @returns {Promise<void>}
 */
async function jobQueueAsync(fastify, opts) {
  const {
    fileName,
    queueName = 'queue',
    changeEmitter = new EventEmitter() // Prevent crash if not provided
  } = opts;

  if (!fileName) {
    throw new Error('Provide a filename with the processes for the queue.');
  }

  // Setup job queue instance
  const jobQueueInstance = new JobQueue(fileName);
  changeEmitter.on('change', ({ jobQueue }) => {
    const {
      concurrency,
      timeoutMs,
      throwOnTimeout,
      idleTimeoutMs
    } = jobQueue;

    jobQueue.setRuntimeConfig({
      concurrency,
      timeoutMs,
      throwOnTimeout,
      idleTimeoutMs
    });
  });

  if (!fastify.queue) {
    fastify.decorate('queue', {});
  }

  Object.assign(fastify.queue, {
    [queueName]: jobQueueInstance
  });
}

export default fp(jobQueueAsync, {
  name: moduleName
});
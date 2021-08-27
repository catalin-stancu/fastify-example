import PQueue from 'p-queue';
import Piscina from 'piscina';
import { pathToFileURL } from 'url';
import { to } from './utils.js';

/**
 * Job Queue class with priority feature.
 * Blends a promise-based priority queue (p-queue) with
 * a promise-based worker-threads wrapper (piscina).
 *
 * The number of worker threads is autoscaling between 4 and 8
 * but the concurrency option of the input queue is what decides
 * how many threads to actually use from the range of 4 -> 8.
 * Thus the autoscaling will go from 4 -> concurrency setting.
 *
 * This way we don't have to have a complicated setup in which we
 * transition and handover from an old piscina instance with a fixed
 * number of threads to a new instance with a different thread count
 * when we change the concurrency option at runtime.
 *
 * @todo This service needs further investigation because a proper
 * one was not done due to lack of time and Out of Mem errors when
 * there are > 8 threads
 *
 * https://github.com/piscinajs/piscina
 * https://www.npmjs.com/package/p-queue
 */
export default class JobQueue {
  /**
   * Creates an instance of JobQueue, and handles configuration options
   * that can only be set during instantiation
   *
   * @param {string} fileName - file name which has the function to be
   *    put in the queue and take effect immediately
   * @param {boolean} [enabled = true] - if false, the queue will do nothing
   */
  constructor(fileName, enabled = true) {
    this.fileName = fileName;
    this.enabled = enabled;
    this.fileModule = null;

    // Set default runtime configuration options
    this.setRuntimeConfig({
      enabled: true,
      concurrency: 4,
      timeoutMs: undefined,
      throwOnTimeout: true,
      idleTimeoutMs: 5000
    });
  }

  /**
   * Handle run-time configuration options changes.
   * If only one option is given to be updated, the other ones keep their values.
   * Use an arrow function to allow easy function passing as an event handler
   *
   * @param {object} opts - config object
   * @param {boolean} opts.enabled - if false, the queue will do nothing, this can
   *   also be initialized in the constructor
   * @param {number} opts.timeoutMs - timeout after which a job in the queue is removed
   * @param {boolean} opts.throwOnTimeout - if true an error will be thrown on timeout
   * @param {number} opts.idleTimeoutMs - how long a Worker is allowed to be idle before it is shut down
   * @param {number} opts.concurrency - how many concurrent threads to use
   * @returns {void}
   */
  setRuntimeConfig = (opts) => {
    const updateFlags = {};
    if ((opts.fileName !== this.fileName)
      || (opts.idleTimeoutMs !== this.idleTimeoutMs)) {
      updateFlags.piscina = true;
    }
    if ((opts.concurrency !== this.concurrency)
      || (opts.timeoutMs !== this.timeoutMs)
      || (opts.throwOnTimeout !== this.throwOnTimeout)) {
      updateFlags.pqueue = true;
    }

    const optionNames = ['enabled', 'concurrency', 'timeoutMs', 'throwOnTimeout', 'idleTimeoutMs'];
    optionNames.forEach(optionName => {
      // Only update the provided options
      if (Object.prototype.hasOwnProperty.call(opts, optionName)) {
        this[optionName] = opts[optionName];
      }
    });

    if (updateFlags.piscina) {
      this.piscina = new Piscina({
        filename: this.fileName,
        idleTimeout: this.idleTimeoutMs,
        minThreads: 4,
        maxThreads: 8
      });
    }

    if (updateFlags.pqueue) {
      // Autostart is true by default. The queue is ready to handle new jobs
      this.pqueue = new PQueue({
        concurrency: this.concurrency,
        timeout: this.timeoutMs,
        throwOnTimeout: this.throwOnTimeout
      });

      this.pqueue.on('error', error => {
        console.error(error);
      });
    }
  }

  /**
   * Get file with functions to execute as an imported module
   *
   * @return {object} imported module
   */
  async getFileModuleAsync() {
    if (this.fileModule) return this.fileModule;

    // Check that the file exists and can be loaded
    const filePath = pathToFileURL(this.fileName);
    const [importError, fileModule] = await to(import(filePath));

    if (importError) {
      importError.message = `File '${this.fileName}' could not be loaded. `
        + importError.message;
      throw importError;
    }

    this.fileModule = fileModule;
    return fileModule;
  }

  /**
   * Add one task to the job queue
   *
   * @param {string} funName function to be located in the provided file
   * @param {Object} args arguments for the function
   * @returns {Promise<void>} - promise resolved when the job finishes
   */
  async addAsync(funName, args) {
    if (!this.enabled) {
      const fileModule = await this.getFileModuleAsync();
      return fileModule[funName](args);
    }

    if (!this.pqueue || !this.piscina) {
      throw new Error('The options that can be changed at runtime are not set');
    }

    return this.pqueue.add(() => this.piscina.run(args, {
      name: funName
    }));
  }

  /**
   * Add multiple tasks
   *
   * @param {Array<Array<string|Object>>} arr array in specified format
   *   format: [
   *     [function, args],
   *     [function, args],
   *     ...
   *   ]
   * @returns {Promise<void>}
   */
  async addManyAsync(arr) {
    if (!this.enabled) {
      const fileModule = await this.getFileModuleAsync();

      return Promise.all(arr.map(
        ([funName, args]) => fileModule[funName](args)
      ));
    }

    if (!this.pqueue || !this.piscina) {
      throw new Error('The options that can be changed at runtime are not set');
    }

    return this.pqueue.addAll(arr.map(

      // pqueue.addAll accepts an array of functions that return a promise
      // piscina.run evaluates to a promise, so we wrap that in another function
      ([funName, args]) => () => this.piscina.run(
        args, {
          name: funName
        }
      )
    ));
  }
}
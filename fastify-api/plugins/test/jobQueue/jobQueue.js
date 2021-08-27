import fastify from 'fastify';
import INDEX from '../helpers/index.js';
import QueuePlugin from '../../plugins/jobQueue.js';
import * as Utils from '../../services/utils.js';

const concurrency = 4;

/**
 *
 *
 * @param {*} plugins asd
 * @return {*}
 */
async function buildFastify() {
  const app = fastify();
  app.decorate('utils', { ...Utils });
  await app.after();

  const jobsPath = new URL('./jobs.js', import.meta.url).href;

  app.register(QueuePlugin, {
    fileName: jobsPath,
    concurrency
  });

  await app.listen();

  return app;
}

const {
  ENABLE_ALL_TESTS,
  EXPECT: expect
} = INDEX;

let app;
describe('Queue tests', () => {
  before(async () => {
    app = await buildFastify();
  });

  if (ENABLE_ALL_TESTS) {
    describe.only('Queue basic tests', () => {
      it('Should not be undefined', async () => {
        // eslint-disable-next-line no-unused-expressions
        expect(app.queue.queue).to.be.not.undefined;
      });

      it('Should add one job to the queue and do it', async () => {
        await app.queue.queue.add(
          'getPrimesBetween', { a: 3, b: 51 }
        );

        const nrWorkers = app.queue.queue.piscina.threads.length;
        expect(nrWorkers).to.equal(concurrency);
      });

      it('Should run all jobs in the queue', async () => {
        const jobs = [
          ['getPrimesBetween', { a: 3, b: 213 }],
          ['getPrimesBetween', { a: 321, b: 893 }],
          ['getPrimesBetween', { a: 1, b: 1 }],
          ['getPrimesBetween', { a: 100, b: 101 }],
          ['getPrimesBetween', { a: 100, b: 101 }],
          ['getPrimesBetween', { a: 100, b: 101 }]
        ];
        await app.queue.queue.addAll(jobs);

        const nrWorkers = app.queue.queue.piscina.threads.length;
        expect(nrWorkers).to.equal(concurrency);
      });
    });
  }
});
/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
import { Storage } from '@google-cloud/storage';
import { pathToFileURL } from 'url';
import readline from 'readline';

/**
 * Promisified setTimeout, used to wait for a certain amount of time
 *
 * @param {number} ms - miliseconds to wait
 * @returns {void}
 */
const waitAsync = ms => new Promise(resolve => setTimeout(resolve, ms));

const { BUCKET_NAME } = process.env;

const [ignored, fileName, bucketName = BUCKET_NAME] = process.argv;
const importedFileName = pathToFileURL(fileName).href;

// Module was not imported but called directly as a script
if (import.meta.url === importedFileName) {
  const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readlineInterface.question(
    `Are you sure you want to delete all objects in bucket '${bucketName}'? \ny/n `,
    async response => {
      if (response !== 'y' && response !== 'Y') return readlineInterface.close();
      const storageClient = new Storage();
      const bucketHandle = storageClient.bucket(bucketName);
      console.log('Starting deletion...');

      try {
        let bucketResponse;
        let previousCount = -1;
        while (!bucketResponse) {
          // If we don't limit then umber of calls the client library crashes out of memory
          await bucketHandle.deleteFiles({
            force: true,
            maxApiCalls: 100
          });

          // Try to count how many objects are still left in the bucket
          // In case of timeout it means there are still a lot of them there
          bucketResponse = await Promise.race([
            bucketHandle.getFiles(),
            // Use a timeout of 10s in case it takes too long
            waitAsync(10000)
          ]);

          if (bucketResponse) {
            const [files] = bucketResponse;

            // If we could not make any progress in the last iteration, exit the script
            if (files.length === previousCount) {
              bucketResponse = null;
              console.log(
                '\nFinished deletion. ',
                `Number of objects that could not be deleted: ${files.length}`
              );
            }
            previousCount = files.length;
          }
        }
        // Make sure to end the request to bucketHandle.getFiles() in case a timeout occurred
        process.exit(0);
      } catch (err) {
        console.error(err);
      } finally {
        readlineInterface.close();
      }
    }
  );
}
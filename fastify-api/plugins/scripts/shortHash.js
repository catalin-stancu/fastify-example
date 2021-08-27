/* eslint-disable no-console */
import { pathToFileURL } from 'url';
import { shortHash } from '../services/utils.js';

const [ignored, fileName, inputString] = process.argv;
const importedFileName = pathToFileURL(fileName).href;

// Module was not imported but called directly as a script
if (import.meta.url === importedFileName) {
  if (!inputString) {
    console.error('Please provide an input string argument');
    process.exit(0);
  }

  console.log(`Short hash for: '${inputString}'`);
  console.log('=', shortHash(inputString));
}
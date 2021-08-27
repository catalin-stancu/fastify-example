/* eslint-disable no-console */
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';

const [ignored, fileName, roLocalePath] = process.argv;
const importedFileName = pathToFileURL(fileName).href;

// Module was not imported but called directly as a script
if (import.meta.url === importedFileName) {
  if (!roLocalePath) {
    console.error('Please provide the path for the ro.json locale');
    process.exit(0);
  }

  const roDictionary = JSON.parse(fs.readFileSync(path.resolve(roLocalePath)));
  const enDictionary = {};

  Object.keys(roDictionary).forEach(key => enDictionary[key] = key);
  const enLocalePath = path.join(path.dirname(roLocalePath), 'en.json');
  const newEnLocaleContent = JSON.stringify(enDictionary, null, 2)
    .replace(/\n/g, '\r\n');
  const currentEnLocaleContent = fs.readFileSync(path.resolve(enLocalePath));

  const serializedEnLocaleContent = JSON.stringify(JSON.parse(currentEnLocaleContent));
  const serializedNewEnLocaleContent = JSON.stringify(enDictionary);

  // Only update file if the contents have changed
  if (serializedEnLocaleContent !== serializedNewEnLocaleContent) {
    fs.writeFileSync(enLocalePath, newEnLocaleContent);
    console.log('Regenerated en.json localization dictionary');
  } else {
    console.log('No need to regenerate en.json localization dictionary (up to date)');
  }
}
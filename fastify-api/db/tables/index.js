"use strict";

const FS = require('fs');
const PATH = require('path');

// Read all files from the current folder, but skip the index.js file
const allFilesInDir = FS.readdirSync(PATH.resolve(__dirname, '../models'));
console.log('ALL FILES', allFilesInDir);

// Require all files found in the current folder and export them
const tablesDefinitions = allFilesInDir.map(file => {
    let filePath = PATH.resolve(__dirname, `../models/${file}`);
    return require(filePath);
});

module.exports = tablesDefinitions;
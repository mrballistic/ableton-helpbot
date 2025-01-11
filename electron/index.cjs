const { app } = require('electron');
const path = require('path');

// Resolve the path to the main process file
const mainPath = path.join(__dirname, 'main.cjs');

// Load the main process file
require(mainPath);

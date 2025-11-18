// Bootstrap file to register path mappings before loading the app
const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('../tsconfig.json');

// Register paths based on tsconfig
tsConfigPaths.register({
  baseUrl: tsConfig.compilerOptions.outDir || './dist',
  paths: {
    '~/prisma/*': ['src/prisma/*'],
    '~/*': ['src/*'],
  },
});

// Now require the main application
require('./main');

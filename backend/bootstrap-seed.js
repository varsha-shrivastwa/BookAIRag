/**
 * SWC Bootstrap for seed script
 */
const { addHook } = require('pirates');
const { transformSync } = require('@swc/core');

const SWC_OPTIONS = {
  jsc: {
    parser: { syntax: 'typescript', tsx: false, decorators: true, dynamicImport: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    target: 'es2020',
    keepClassNames: true,
  },
  module: { type: 'commonjs' },
};

addHook(
  (code, filename) => transformSync(code, { ...SWC_OPTIONS, filename }).code,
  { exts: ['.js', '.ts', '.mjs'], ignoreNodeModules: true }
);

require('./src/seed.js');

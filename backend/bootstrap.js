/**
 * SWC Bootstrap
 * Registers a require hook using @swc/core directly so that all .js files
 * in this project are compiled with full legacy decorator + decoratorMetadata
 * support — regardless of file extension detection in @swc-node/register.
 */
const { addHook } = require('pirates');
const { transformSync } = require('@swc/core');

const SWC_OPTIONS = {
  jsc: {
    parser: {
      syntax: 'typescript',   // TS parser is a superset of JS; handles decorators
      tsx: false,
      decorators: true,
      dynamicImport: true,
    },
    transform: {
      legacyDecorator: true,     // NestJS-style (TypeScript experimentalDecorators)
      decoratorMetadata: true,   // Emit Reflect.metadata("design:paramtypes", [...])
    },
    target: 'es2020',
    keepClassNames: true,
  },
  module: { type: 'commonjs' },
};

addHook(
  (code, filename) => {
    try {
      return transformSync(code, { ...SWC_OPTIONS, filename }).code;
    } catch (err) {
      // Surface the original SWC parse error with file context
      throw Object.assign(new Error(`SWC compile error in ${filename}: ${err.message}`), { stack: err.stack });
    }
  },
  {
    exts: ['.js', '.ts', '.mjs'],
    ignoreNodeModules: true,
  }
);

// Now boot the NestJS app
require('./src/main.js');

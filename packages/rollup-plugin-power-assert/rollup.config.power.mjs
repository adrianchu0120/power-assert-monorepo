import { globSync } from 'glob';
import { powerAssert } from 'rollup-plugin-power-assert';

export default {
  input: globSync('examples/**/*.mjs'),
  output: {
    dir: 'tmp',
    format: 'es',
    entryFileNames: '[name].js',
    // entryFileNames: '[name].cjs',
    sourcemap: 'inline',
    // create a module for each module in the input, instead of trying to chunk them together.
    preserveModules: true,
    // do not add `Object.defineProperty(exports, '__esModule', { value: true })`
    esModule: false,
    // use const instead of var when creating statements
    generatedCode : {
      constBindings: true
    }
  },
  plugins: [
    // externals({
    //   // strip 'node:' prefix
    //   builtinsPrefix: 'strip'
    // }),
    powerAssert({
      include: ['examples/**/*.test.mjs'],
    }),
  ]
};

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { espowerAst } from '../dist/src/transpiler/transpiler-core.mjs';
import { parse } from 'acorn';
import { generate } from 'astring';
import { SourceMapGenerator } from 'source-map';
import { fromJSON } from 'convert-source-map';

function transpile (code) {
  const ast = parse(code, {
    sourceType: 'module',
    ecmaVersion: '2022',
    locations: true,
    ranges: true
  });
  const poweredAst = espowerAst(ast, {
    variables: [
      // set variable name explicitly for testing
      'assert'
    ],
    // runtime: 'espower3/runtime',
    code
  });
  const smg = new SourceMapGenerator({
    file: 'source.mjs',
  });
  const transpiledCode = generate(poweredAst, {
    sourceMap: smg,
  });
  const outMap = fromJSON(smg.toString());
  return transpiledCode + '\n' + outMap.toComment() + '\n';
}

function isAssertionError (e) {
  return e instanceof Error && /^AssertionError/.test(e.name);
}

export function ptest (title, testFunc, expected, howManyLines = 1) {
  // chop first line then extract assertion expression
  const expression = expected.split('\n').slice(2, (2 + howManyLines)).join('\n');
  test(title + ': ' + expression, () => {
    // remove first line contains import { _power_ } from '@power-assert/runtime'
    const transpiledCode = transpile(expression).split('\n').slice(1).join('\n');
    try {
      testFunc(transpiledCode);
      throw new Error('AssertionError should be thrown');
    } catch (e) {
      if (isAssertionError(e)) {
        assert.equal(e.message, expected);
      } else {
        throw e;
      }
    }
  });
}
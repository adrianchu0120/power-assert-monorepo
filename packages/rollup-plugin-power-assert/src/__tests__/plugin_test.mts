import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import { powerAssertPlugin } from '../rollup-plugin-power-assert.mjs';
import type { RollupBuild } from 'rollup';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('rollup-plugin-power-assert', () => {
  const options = {
    plugins: [
      powerAssertPlugin()
    ]
  };

  let bundle: RollupBuild;

  beforeEach(async () => {
    const exampleFilepath = resolve(__dirname, '..', '..', 'examples', 'bowling.test.mjs');
    bundle = await rollup({
      input: exampleFilepath,
      logLevel: 'silent',
      ...options
    });
  });

  it('transforms code', async () => {
    const { output } = await bundle.generate({ format: 'es' });
    assert(output.length === 1);
    assert.match(output[0].code, /import \{ _power_ \} from '@power-assert\/runtime';/);
  });
});

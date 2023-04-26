import { _power_ } from '../../../dist/runtime/runtime.mjs';
import {
    describe,
    it
} from 'node:test';
import assert from 'node:assert/strict';
describe('description', () => {
    it('example', () => {
        const _pasrt1 = _power_(assert.ok, assert, 'assert.ok(truthy)');
        const _parg1 = _pasrt1.recorder(0);
        const _pasrt2 = _power_(assert.equal, assert, 'assert.equal(truthy, falsy)');
        const _parg2 = _pasrt2.recorder(0);
        const _parg3 = _pasrt2.recorder(1);
        const truthy = '1';
        const falsy = 0;
        _pasrt1.run(_parg1.rec(truthy, 'arguments/0', 10));
        _pasrt2.run(_parg2.rec(truthy, 'arguments/0', 13), _parg3.rec(falsy, 'arguments/1', 21));
    });
});

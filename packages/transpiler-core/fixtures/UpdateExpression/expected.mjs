import assert from 'node:assert/strict';
import {_power_} from "@power-assert/runtime";
const _pasrt1 = _power_(assert, null, "assert(++foo)");
const _parg1 = _pasrt1.recorder(0);
const _pasrt2 = _power_(assert, null, "assert(bar--)");
const _parg2 = _pasrt2.recorder(0);
const _pasrt3 = _power_(assert.strictEqual, assert, "assert.strictEqual(++foo, bar--)");
const _parg3 = _pasrt3.recorder(0);
const _parg4 = _pasrt3.recorder(1);
_pasrt1.run(_parg1.rec(++foo, 7));
_pasrt2.run(_parg2.rec(bar--, 7));
_pasrt3.run(_parg3.rec(++foo, 19), _parg4.rec(bar--, 26));

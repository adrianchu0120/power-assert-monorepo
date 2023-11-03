import { describe, it, assert } from 'vitest';

describe('description', () => {
  it('example', () => {
    const truthy = '1';
    const falsy = 0;
    assert(truthy === falsy);
  });
  it('literal', () => {
    const truthy = '1';
    assert(truthy === 0);
  });
});

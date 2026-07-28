import { expect, test } from 'vitest';

test('intentional failure proves the gate is fail-closed', () => {
    expect('detected failure').toBe('silent success');
});

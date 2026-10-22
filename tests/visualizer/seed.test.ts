import { afterEach, expect, test, vi } from 'vitest';
import { ElementSeedSession, elementSeedField, resolveSessionSeed, validateSeed } from '../../src/visualizer/seed';

afterEach(() => vi.restoreAllMocks());
test.each([null, 0, 42, 0xffffffff])('validates seed %s', seed => expect(validateSeed(seed)).toBe(seed));
test.each([undefined, -1, 4294967296, 1.5, NaN, Infinity, '123', false])('rejects invalid seed %s', seed => {
    expect(() => validateSeed(seed)).toThrow();
});
test('non-seeded elements omit the field and never request randomness', () => {
    const random = vi.spyOn(crypto, 'getRandomValues');
    expect(elementSeedField(undefined)).toEqual({});
    expect(() => elementSeedField(null)).toThrow(/不使用/);
    expect(() => elementSeedField(undefined, true)).toThrow();
    expect(elementSeedField(null, true)).toEqual({ seed: null });
    expect(new ElementSeedSession().sync([{ id: 'solid' }]).size).toBe(0);
    expect(resolveSessionSeed(0)).toBe(0);
    expect(random).not.toHaveBeenCalled();
});
test('element seeds remain independent across edits, reorder and deletion', () => {
    let next = 100;
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
        (array as Uint32Array)[0] = next++;
        return array;
    });
    const session = new ElementSeedSession();
    const a = { id: 'a', seed: null },
        b = { id: 'b', seed: null },
        fixed = { id: 'fixed', seed: 0 };
    const before = session.sync([a, b, fixed, { id: 'solid' }]);
    expect([...before.values()]).toEqual([100, 101, 0]);
    expect(session.sync([fixed, b, a])).toBe(before);
    const changed = session.sync([{ ...a, seed: 42 }, b, fixed]);
    expect(changed.get('a')).toBe(42);
    expect(changed.get('b')).toBe(101);
    expect(before.get('a')).toBe(100);
    expect(session.sync([a, b, fixed]).get('a')).toBe(102);
    expect(session.values.get('b')).toBe(101);
    session.sync([a, b, fixed, { id: 'new', seed: null }]);
    expect(session.values.get('new')).toBe(103);
    session.sync([b, fixed]);
    expect(session.values.has('a')).toBe(false);
    expect(session.values.get('b')).toBe(101);
    expect(session.sync([b, fixed], true).get('b')).toBe(104);
    expect(random).toHaveBeenCalledTimes(5);
    session.clear();
    expect(session.values.size).toBe(0);
});

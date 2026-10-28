import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { assetsRoot, resourcePack } from '../support/visualizer-assets.mjs';
import { originalParticles } from '../support/circular-particle-reference';
import { createTestAlgorithm } from './algorithm-runtime-fixture';
import { validateDrawPacket } from '../../src/visualizer/drawPacket';

const spectrum = (bass: number, right = 0) => [bass, ...Array(63).fill(0), ...Array(64).fill(right)];
function parameters(kind = 'depth', extra: Record<string, any> = {}) {
    const definition = resourcePack('elements/circular-' + kind).elements[0];
    return {
        ...Object.fromEntries(definition.parameters.map((p: any) => [p.id, { value: p.defaultValue }])),
        spectrum: { value: spectrum(3) },
        responsiveness: { value: 100 },
        normalize: { value: false },
        noise: { value: false },
        ...extra,
    };
}
function helpers(kind = 'depth') {
    const context = vm.createContext({});
    const text = readFileSync(
        path.join(assetsRoot, 'elements/circular-' + kind + '/source/shared/circular.js'),
        'utf8',
    );
    vm.runInContext(
        text + '\nglobalThis.testApi = {fresh, updateState, renderCircular, createCircularState};',
        context,
    );
    return context.testApi;
}
const frame = (time: number, p = parameters(), mode: 'timeline' | 'realtime' = 'timeline') => ({
    time,
    parameters: p,
    seed: 123,
    revision: 'same',
    width: 1920,
    height: 1080,
    mode,
    range: mode === 'timeline' ? { startSeconds: 0, endSeconds: 30 } : null,
});
const depthParticle = (z = 0.6, id = 0) => ({ x: 0.1, y: 0.1, z, opacity: 1, r: 1, id, born: 0 });

test('reverse depth moves inward, respawns near the viewer, stays finite and retains silence freeze', () => {
    const api = helpers(),
        state = api.fresh(-1);
    state.particles = [depthParticle(0.6)];
    const p = parameters('depth', { count: { value: 1 }, reverse: { value: true } });
    for (let tick = 0; tick < 20; tick += 2) {
        const previous = state.particles[0].z;
        api.updateState(state, tick, spectrum(3), frame(tick / 60, p), 'depth');
        expect(state.particles[0].z).toBeGreaterThan(previous);
        expect(state.particles[0].drawZ).toBe(previous);
    }
    state.particles[0].z = 0.999;
    api.updateState(state, 20, spectrum(3), frame(1 / 3, p), 'depth');
    expect(state.particles[0]).toMatchObject({ z: 1 / 64, opacity: 0, born: 1 });
    api.updateState(state, 22, spectrum(3), frame(22 / 60, p), 'depth');
    expect(state.particles[0].opacity).toBe(0.04);
    expect([...api.renderCircular(frame(22 / 60, p), state, 'depth').mesh.positions].every(Number.isFinite)).toBe(true);
    const frozen = structuredClone(state.particles);
    api.updateState(state, 24, spectrum(0), frame(0.4, p), 'depth');
    expect(state.particles).toEqual(frozen);
});

test.each([0, 1, 2, 20, 100, 1000])(
    'depth matches original shared-speed order for %i particles across thresholds',
    count => {
        const api = helpers(),
            state = api.fresh(-1),
            reference = originalParticles();
        state.particles = Array.from({ length: count }, (_, i) => depthParticle(0.9, i));
        const originals = Array.from({ length: count }, () => ({ x: 1152, y: 432, z: 1728, opacity: 100 }));
        const trace = [0.1, 0.5, 0.500001, 2, 2.000001, 3, 3, 1, 0.5, 0.1];
        for (const [step, bass] of trace.entries()) {
            const expected = reference.depth(originals, bass);
            const p = parameters('depth', { count: { value: count } });
            api.updateState(state, step * 2, spectrum(bass), frame(step / 30, p), 'depth');
            expect(state.speed).toBe(expected.speed);
            for (let i = 0; i < count; i++) {
                const particle = state.particles[i],
                    draw = expected.draws[i]!;
                expect(particle.z * 1920).toBeCloseTo(originals[i]!.z, 8);
                expect(particle.drawZ).toBeGreaterThan(0);
                expect((particle.drawX * 1920) / particle.drawZ + 960).toBeCloseTo(draw.x, 8);
                expect(540 - (particle.drawY * 1080) / particle.drawZ).toBeCloseTo(draw.y, 8);
                expect(0.6 / particle.drawZ).toBeCloseTo(draw.radius, 8);
                expect(particle.drawOpacity).toBeCloseTo(draw.alpha, 12);
            }
        }
    },
);

test('depth fades cumulatively before movement, preserves its final draw through rebirth and freezes in silence', () => {
    const api = helpers(),
        state = api.fresh(-1),
        reference = originalParticles();
    state.particles = [depthParticle(0.12)];
    const originals = [{ x: 1152, y: 432, z: 230.4, opacity: 100 }];
    const p = parameters('depth', { count: { value: 1 } });
    for (let step = 0; step < 27; step++) {
        const expected = reference.depth(originals, 0.1);
        api.updateState(state, step * 2, spectrum(0.1), frame(step / 30, p), 'depth');
        expect(state.particles[0].drawOpacity).toBeCloseTo(expected.draws[0]!.alpha, 12);
    }
    expect(state.particles[0].opacity).toBe(0);
    const frozen = structuredClone(state.particles);
    const speed = state.speed;
    api.updateState(state, 54, spectrum(0, 1), frame(0.9, p), 'depth');
    expect(state.active).toBe(false);
    expect(state.speed).toBe(speed);
    expect(state.particles).toEqual(frozen);
    expect(api.renderCircular(frame(0.9, p), state, 'depth').mesh.positions).toHaveLength(0);
    state.particles = [depthParticle(1 / 1920)];
    originals[0] = { x: 1152, y: 432, z: 1, opacity: 100 };
    const expected = reference.depth(originals, 0.1);
    api.updateState(state, 56, spectrum(0.1), frame(56 / 60, p), 'depth');
    expect(state.particles[0]).toMatchObject({ z: 1, opacity: 1, born: 1 });
    expect(state.particles[0].drawZ * 1920).toBe(1);
    expect(state.particles[0].drawOpacity).toBeCloseTo(expected.draws[0]!.alpha);
    state.particles[0].z = 0;
    api.updateState(state, 58, spectrum(0.1), frame(58 / 60, p), 'depth');
    expect([...api.renderCircular(frame(58 / 60, p), state, 'depth').mesh.positions].every(Number.isFinite)).toBe(true);
});

test.each([
    [0.1, 0],
    [0.6, 0],
    [0.600001, 0],
    [0.1, 0.5],
    [0.1, 0.500001],
])('outward velocity and radius follow original 30 fps steps at bass=%s mid=%s', (bass, mid) => {
    const api = helpers('particles'),
        state = api.fresh(-1),
        reference = originalParticles();
    const original = { x: 1152, y: 432, vx: 0.01, vy: -0.01, radius: 1, id: 0 };
    state.particles = [{ x: 0.1, y: 0.1, vx: 0.01 / 1920, vy: 0.01 / 1080, r: 1, born: 0, id: 0 }];
    const p = parameters('particles', { count: { value: 0 } });
    for (let step = 0; step < 30; step++) {
        const input = spectrum(bass);
        input[29] = mid;
        reference.outward(original, bass, mid);
        api.updateState(state, step * 2, input, frame(step / 30, p), 'particles');
        const particle = state.particles[0];
        expect(particle.x * 1920 + 960).toBeCloseTo(original.x, 9);
        expect(540 - particle.y * 1080).toBeCloseTo(original.y, 9);
        expect(particle.vx * 1920).toBeCloseTo(original.vx, 9);
        expect(particle.r).toBeCloseTo(original.radius, 12);
        const before = structuredClone(state.particles);
        api.updateState(state, step * 2 + 1, input, frame((step * 2 + 1) / 60, p), 'particles');
        expect(state.particles).toEqual(before);
    }
    state.particles[0].born = -481;
    api.updateState(state, 60, spectrum(0), frame(1, p), 'particles');
    expect(state.particles).toHaveLength(0);
});

test.each(['particles', 'depth'])(
    '%s sealed algorithm is deterministic across 30/60 fps, seeks, modes and resize',
    async kind => {
        const algorithm = resourcePack('elements/circular-' + kind).algorithms[0];
        const a = await createTestAlgorithm(algorithm),
            b = await createTestAlgorithm(algorithm);
        const p = parameters(kind);
        const history = {
            history: async ({ startTick, endTick }: any) =>
                Array.from({ length: endTick - startTick }, (_, i) => ({
                    time: (startTick + i) / 60,
                    value: spectrum(3),
                })),
        };
        let last: any;
        for (let tick = 0; tick <= 120; tick++) {
            const actual = validateDrawPacket(await a.prepareFrame(frame(tick / 60, p), history as any), algorithm);
            if (tick % 2 === 0) {
                const expected = await b.prepareFrame(frame(tick / 60, p), history as any);
                expect(actual).toEqual(expected);
                last = actual;
            } else expect(actual).toEqual(last);
        }
        const target = await a.prepareFrame(frame(1.2, p), history as any);
        await a.prepareFrame(frame(0.1, p), history as any);
        expect(await a.prepareFrame(frame(1.2, p), history as any)).toEqual(target);
        expect(await a.prepareFrame({ ...frame(1.2, p), width: 1280, height: 720 }, history as any)).toEqual(target);
        const realtime = await createTestAlgorithm(algorithm);
        for (let tick = 0; tick <= 72; tick++) {
            const current = await realtime.prepareFrame(frame(tick / 60, p, 'realtime'), {
                history: () => {
                    throw Error('Realtime history forbidden');
                },
            } as any);
            if (tick === 72) expect(current).toEqual(target);
        }
        const changed = { ...p, size: { value: 10 } };
        const fresh = await createTestAlgorithm(algorithm);
        expect(await a.prepareFrame(frame(1.2, changed), history as any)).toEqual(
            await fresh.prepareFrame(frame(1.2, changed), history as any),
        );
    },
);

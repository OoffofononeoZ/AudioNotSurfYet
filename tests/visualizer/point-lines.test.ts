import { describe, expect, test } from 'vitest';
import { createComposition, validateComposition } from '../../src/visualizer/compositionCodec';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { elementRegistry, findResource } from '../../src/visualizer/elementRegistry';
import { createEditorMarkerReader } from '../../src/visualizer/editorMarkerReader';
import { validateDrawPacket } from '../../src/visualizer/drawPacket';
import { createTestAlgorithm } from './algorithm-runtime-fixture';
import { attachElements } from './resource-fixtures';
import type { DrawPacket, AlgorithmFrame } from '../../src/visualizer/algorithmTypes';

const ids = ['point-line-horizontal', 'point-line-vertical'];
const available = ids.every(id => elementRegistry.list().some(d => d.id === id));

async function harness(id: string, times: number[], end = 4) {
    const project = createComposition({
        contentHash: 'a'.repeat(64),
        fileName: 'points.wav',
        durationSeconds: 4,
        sampleRate: 48000,
    });
    const element = elementRegistry.create(id, 4, 0),
        laneId = crypto.randomUUID(),
        classId = crypto.randomUUID(),
        otherId = crypto.randomUUID();
    element.timing = { kind: 'manual', startSeconds: 0, endSeconds: end };
    element.markerBindings = { points: { kind: 'collection', laneId, innerClassIds: [classId] } };
    project.elements = [element];
    attachElements(project);
    const editor = createInitialEditorProject({ track: project.track });
    editor.lanes = [
        {
            id: laneId,
            name: '点轨道',
            eventKind: 'point',
            innerClasses: [
                { id: classId, label: '选定分类' },
                { id: otherId, label: '其他分类' },
            ],
            events: [
                ...times.map(atSeconds => ({ id: crypto.randomUUID(), innerClassId: classId, atSeconds })),
                { id: crypto.randomUUID(), innerClassId: otherId, atSeconds: 0.8 },
            ],
        },
    ];
    project.editorSnapshot = { capturedAt: editor.updatedAt, project: editor };
    const validated = validateComposition(project),
        algorithm = findResource(validated.resources.algorithms, validated.resources.elements[0]!.algorithm);
    const input = createEditorMarkerReader(validated, () => true);
    let calls = 0;
    async function instance() {
        const created = await createTestAlgorithm(algorithm);
        return {
            async run(
                time: number,
                seed = 7,
                width = 1280,
                height = 720,
                range = { startSeconds: 0, endSeconds: end },
            ) {
                const frame: AlgorithmFrame = {
                    time,
                    seed,
                    width,
                    height,
                    revision: 'test',
                    range,
                    parameters: Object.fromEntries(
                        elementRegistry
                            .get(id)
                            .parameters.map(p => [
                                p.id,
                                { value: typeof p.defaultValue === 'object' ? [...p.defaultValue] : p.defaultValue },
                            ]),
                    ),
                };
                return validateDrawPacket(
                    await created.prepareFrame(frame, {
                        history: async () => [],
                        markers: query => {
                            calls++;
                            return input(element.id, query);
                        },
                    }),
                    algorithm,
                );
            },
            dispose: () => created.dispose?.(),
        };
    }
    return { instance, calls: () => calls, validated, algorithm };
}
function lines(packet: DrawPacket, vertical: boolean, width = 1280, height = 720) {
    return packet.passes.flatMap(pass => {
        const mesh = pass.mesh!,
            result: Array<{ position: number; alpha: number; span: number }> = [];
        for (let i = 6; i < mesh.positions.length / 3; i += 6) {
            const xs = Array.from({ length: 6 }, (_, v) => mesh.positions[(i + v) * 3]!),
                ys = Array.from({ length: 6 }, (_, v) => mesh.positions[(i + v) * 3 + 1]!);
            result.push({
                position: vertical
                    ? 0.5 + (Math.max(...xs) + Math.min(...xs)) / 2 / (width / height)
                    : 0.5 - (Math.max(...ys) + Math.min(...ys)) / 2,
                alpha: mesh.colors[i * 4 + 3]!,
                span: vertical ? Math.max(...ys) - Math.min(...ys) : Math.max(...xs) - Math.min(...xs),
            });
        }
        return result;
    });
}

describe.skipIf(!available)('approved single-category point-line resources', () => {
    for (const id of ids) {
        const vertical = id.endsWith('vertical');
        test(id + ' has exact defaults and only accepts a project-bound point category', async () => {
            const definition = elementRegistry.get(id),
                unbound = elementRegistry.create(id, 4, 0);
            expect(definition.version).toBe(2);
            expect(definition.usesSeed).toBe(true);
            expect(unbound.seed).toBeNull();
            expect(definition.markerInputs).toEqual([
                {
                    id: 'points',
                    label: '点标记',
                    eventKind: 'point',
                    selectionModes: ['collection'],
                    categorySelection: 'single',
                },
            ]);
            expect(unbound.markerBindings).toEqual({ points: { kind: 'unbound' } });
            expect(definition.parameters.map(p => [p.id, p.defaultValue])).toEqual([
                ['color', '#ffffff'],
                ['lineWidth', 0.003],
                ['fadeInSeconds', 0.04],
                ['holdSeconds', 0.06],
                ['fadeOutSeconds', 0.1],
            ]);
        });
        test(
            id +
                ' reaches peak at the event with short smooth fades, ignores other categories and spans the whole axis',
            async () => {
                const h = await harness(id, [0.5]),
                    a = await h.instance();
                try {
                    for (const [time, alpha] of [
                        [0.45, 0],
                        [0.46, 0],
                        [0.48, 0.5],
                        [0.5, 1],
                        [0.56, 1],
                        [0.61, 0.5],
                        [0.66, 0],
                        [0.8, 0],
                    ]) {
                        const packet = await a.run(time!),
                            drawn = lines(packet, vertical);
                        if (alpha === 0) expect(drawn).toEqual([]);
                        else {
                            expect(drawn).toHaveLength(1);
                            expect(drawn[0]!.alpha).toBeCloseTo(alpha!, 6);
                            expect(drawn[0]!.span).toBeCloseTo(vertical ? 1 : 1280 / 720, 6);
                        }
                    }
                    const empty = await harness(id, []),
                        b = await empty.instance();
                    try {
                        expect((await b.run(0.8)).passes).toEqual([]);
                    } finally {
                        b.dispose();
                    }
                } finally {
                    a.dispose();
                }
            },
        );
        test(
            id +
                ' paginates all points, spaces temporal neighbors and keeps positions through seek, resize and new instances',
            async () => {
                const h = await harness(
                        id,
                        Array.from({ length: 610 }, (_, i) => 0.5 + i * 0.00005),
                    ),
                    a = await h.instance(),
                    b = await h.instance();
                try {
                    const first = await a.run(0.54),
                        positions = lines(first, vertical).map(l => l.position);
                    expect(first.state![0]).toBe(610);
                    expect(positions).toHaveLength(610);
                    expect(h.calls()).toBe(3);
                    for (let i = 0; i < positions.length; i++) {
                        expect(positions[i]!).toBeGreaterThanOrEqual(0.01 - 1e-6);
                        expect(positions[i]!).toBeLessThanOrEqual(0.99 + 1e-6);
                        if (i) expect(Math.abs(positions[i]! - positions[i - 1]!)).toBeGreaterThanOrEqual(0.05 - 1e-6);
                    }
                    await a.run(0.63);
                    await a.run(0.1);
                    expect(await a.run(0.54)).toEqual(first);
                    expect(h.calls()).toBe(3);
                    expect(await b.run(0.54)).toEqual(first);
                    const small = lines(await a.run(0.54, 7, 640, 360), vertical, 640, 360);
                    small.forEach((l, i) => expect(l.position).toBeCloseTo(positions[i]!, 6));
                    expect((await a.run(0.54, 8)).state).not.toEqual(first.state);
                } finally {
                    a.dispose();
                    b.dispose();
                }
            },
        );
        test(id + ' includes track endpoints and clips manual timing without triggering outside points', async () => {
            const h = await harness(id, [0, 4]),
                a = await h.instance();
            try {
                expect(lines(await a.run(0), vertical)[0]!.alpha).toBe(1);
                expect(lines(await a.run(3.98), vertical)[0]!.alpha).toBeCloseTo(0.5, 6);
                expect(lines(await a.run(4), vertical)[0]!.alpha).toBe(1);
            } finally {
                a.dispose();
            }
            const timed = await harness(id, [0.99, 1, 3, 3.01], 3),
                b = await timed.instance();
            try {
                expect(lines(await b.run(1, 7, 1280, 720, { startSeconds: 1, endSeconds: 3 }), vertical)).toHaveLength(
                    1,
                );
                expect(
                    lines(await b.run(2.98, 7, 1280, 720, { startSeconds: 1, endSeconds: 3 }), vertical),
                ).toHaveLength(1);
            } finally {
                b.dispose();
            }
        });
        test(id + ' preserves more than one GPU vertex batch without truncating active points', async () => {
            const h = await harness(
                    id,
                    Array.from({ length: 11000 }, (_, i) => 0.5 + i * 0.000001),
                ),
                a = await h.instance();
            try {
                const packet = await a.run(0.52);
                expect(packet.state![0]).toBe(11000);
                expect(packet.passes).toHaveLength(2);
                expect(lines(packet, vertical)).toHaveLength(11000);
                expect(packet.passes.map(p => p.uniforms.uHasImage)).toEqual([false, true]);
                for (const pass of packet.passes) expect(pass.mesh!.positions.length / 3).toBeLessThanOrEqual(65536);
            } finally {
                a.dispose();
            }
        });
    }
});

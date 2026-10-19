import { expect, test } from '@playwright/test';

test('new algorithm runs behind an opaque-origin boundary with no DOM, network, storage or nested rendering', async ({
    page,
}) => {
    await page.goto('/');
    const report = await page.evaluate(async () => {
        const runtimePath = '/src/visualizer/isolatedAlgorithmRuntime.ts',
            identityPath = '/src/visualizer/resourceIdentity.ts';
        const { IsolatedAlgorithmRuntime, algorithmRuntimeDiagnostics } = await import(runtimePath);
        const { resourceHash } = await import(identityPath);
        const algorithm = {
            id: 'not-in-any-registry',
            version: 1,
            apiVersion: 1,
            contract: { kind: 'visual', parameters: [], sharedParameters: [], historyParameters: [] },
            source: `export function create() { return { async prepareFrame() {
                let network = false, storage = false;
                try { await fetch('/'); network = true; } catch {}
                try { indexedDB.open('sandbox-test'); storage = true; } catch {}
                const escaped = typeof document !== 'undefined' || typeof Worker !== 'undefined' || typeof OffscreenCanvas !== 'undefined';
                return { passes: [{ program: 'draw', uniforms: { result: network || storage || escaped ? 0 : 21 } }] };
            } }; }`,
            programs: {
                draw: {
                    geometry: 'quad',
                    vertex: 'void main(){}',
                    fragment: 'void main(){}',
                    uniforms: { result: { type: 'number' } },
                },
            },
        };
        const runtime = new IsolatedAlgorithmRuntime();
        try {
            await runtime.initialize([{ id: 'instance', algorithm: { ...algorithm, hash: resourceHash(algorithm) } }]);
            const packets = await runtime.prepareFrames(
                [
                    {
                        id: 'instance',
                        frame: {
                            time: 0,
                            seed: 1,
                            revision: '1',
                            width: 640,
                            height: 360,
                            range: null,
                            parameters: {},
                        },
                    },
                ],
                async () => [],
            );
            return packets.get('instance')!.passes[0]!.uniforms.result;
        } finally {
            runtime.dispose();
            if (algorithmRuntimeDiagnostics.activeSandboxes || algorithmRuntimeDiagnostics.activeTasks)
                throw Error('sandbox leak');
        }
    });
    expect(report).toBe(21);
});

test('cancellation terminates an infinite algorithm without blocking the main page', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const runtimePath = '/src/visualizer/isolatedAlgorithmRuntime.ts',
            identityPath = '/src/visualizer/resourceIdentity.ts';
        const { IsolatedAlgorithmRuntime, algorithmRuntimeDiagnostics } = await import(runtimePath);
        const { resourceHash } = await import(identityPath);
        const algorithm = {
            id: 'infinite',
            version: 1,
            apiVersion: 1,
            contract: { kind: 'visual', parameters: [], sharedParameters: [], historyParameters: [] },
            source: 'export function create() { return { prepareFrame() { while(true) {} } }; }',
            programs: { draw: { geometry: 'quad', vertex: 'void main(){}', fragment: 'void main(){}', uniforms: {} } },
        };
        const runtime = new IsolatedAlgorithmRuntime();
        await runtime.initialize([{ id: 'instance', algorithm: { ...algorithm, hash: resourceHash(algorithm) } }]);
        const cancel = new AbortController();
        const pending = runtime.prepareFrames(
            [
                {
                    id: 'instance',
                    frame: { time: 0, seed: 1, revision: '1', width: 1, height: 1, range: null, parameters: {} },
                },
            ],
            async () => [],
            cancel.signal,
        );
        setTimeout(() => cancel.abort(), 100);
        try {
            await pending;
            return 'unexpected success';
        } catch {
            return algorithmRuntimeDiagnostics.activeSandboxes === 0 && algorithmRuntimeDiagnostics.activeTasks === 0
                ? 'cancelled'
                : 'leak';
        } finally {
            runtime.dispose();
        }
    });
    expect(result).toBe('cancelled');
});

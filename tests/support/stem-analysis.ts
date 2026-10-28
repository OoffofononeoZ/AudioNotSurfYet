import type { Page } from '@playwright/test';
import type { EditorSeparationService } from '../../src/processing/editorSeparationService';
import type { DecodedAudioCopyPort } from '../../src/analysis/pcm';
import type { SeparationResult } from '../../src/processing/kernel';

/** Synthetic distinct-role PCM, published and restored through the real checksum repository. */
export async function captureSeparation(page: Page) {
    await page.addInitScript(async () => {
        if (window.top !== window) return;
        // Inspect the live injection after mount; bare module imports can differ under Vite HMR.
        const observer = new MutationObserver(() => {
            const node = document.querySelector(
                '[data-testid="editor-ready"], [data-testid="visualizer-ready"]',
            ) as HTMLElement & { __vueParentComponent?: { provides: Record<symbol, EditorSeparationService> } };
            let provides = node?.__vueParentComponent?.provides;
            while (provides) {
                const key = Object.getOwnPropertySymbols(provides).find(
                    key => key.description === 'EditorSeparationService',
                );
                if (key) {
                    Reflect.set(window, '__stemTestService', provides[key]);
                    observer.disconnect();
                    return;
                }
                provides = Object.getPrototypeOf(provides);
            }
        });
        observer.observe(document, { childList: true, subtree: true });
        const post = Worker.prototype.postMessage;
        Reflect.set(window, '__stemRequests', []);
        Worker.prototype.postMessage = function (message, ...rest: unknown[]) {
            if (message.kind === 'stem-analyze' || message.kind === 'analyze')
                Reflect.get(window, '__stemRequests').push({
                    role: message.source?.role ?? 'original',
                    ids: [...message.featureIds],
                });
            return Reflect.apply(post, this, [message, ...rest]);
        };
    });
}
export async function seedStemResult(page: Page) {
    await page.evaluate(async () => {
        const node = document.querySelector(
            '[data-testid="editor-ready"], [data-testid="visualizer-ready"]',
        ) as HTMLElement & { __vueParentComponent: { provides: Record<symbol, EditorSeparationService> } };
        let provides = node.__vueParentComponent.provides;
        let service: EditorSeparationService | undefined;
        while (provides && !service) {
            const key = Object.getOwnPropertySymbols(provides).find(
                key => key.description === 'EditorSeparationService',
            );
            if (key) service = provides[key];
            provides = Object.getPrototypeOf(provides);
        }
        if (!service) throw new Error('Injected separation service not found.');
        Reflect.set(window, '__stemTestService', service);
        const port = (service as unknown as { port: DecodedAudioCopyPort }).port;
        const storageUrl = '/src/processing/storage.ts',
            repoUrl = '/src/processing/editorResultRepository.ts',
            manifestUrl = '/src/processing/modelManifest.ts',
            dspUrl = '/src/processing/dsp.ts',
            hashUrl = '/src/processing/sha256.ts',
            runtimeUrl = '/src/processing/runtime-manifest.json';
        const [
            { stagePcm, jobDirectory },
            { EditorStemRepository },
            manifest,
            { StemSummary, wavHeader, interleave },
            { hashBytes },
            runtime,
        ] = await Promise.all([
            import(storageUrl),
            import(repoUrl),
            import(manifestUrl),
            import(dspUrl),
            import(hashUrl),
            import(runtimeUrl),
        ]);
        const source = await stagePcm(port, `editor-${crypto.randomUUID()}`, new AbortController().signal),
            directory = await jobDirectory(source.directory),
            frames = Math.round(source.descriptor.durationSeconds * 44100);
        const stems = [];
        for (const [index, role] of ['drums', 'bass', 'other', 'vocals'].entries()) {
            const left = Float32Array.from(
                    { length: frames },
                    (_, i) => Math.sin((i * 2 * Math.PI * (110 * 2 ** index)) / 44100) * (index + 1) * 0.04,
                ),
                right = Float32Array.from(left, v => v * 0.5),
                summary = new StemSummary(frames);
            summary.append(left, right);
            for (const [name, data] of [
                [`${role}-left.f32`, left],
                [`${role}-right.f32`, right],
                [`${role}.wav`, new Blob([wavHeader(frames), interleave(left, right)])],
            ] as const) {
                const writer = await (await directory.getFileHandle(name, { create: true })).createWritable();
                await writer.write(data);
                await writer.close();
            }
            stems.push({
                role,
                frames,
                sampleRate: 44100,
                left: `${role}-left.f32`,
                right: `${role}-right.f32`,
                wav: `${role}.wav`,
                ...summary.finish(),
            });
        }
        const result: SeparationResult = {
            source,
            stems,
            config: manifest.FT_CONFIG,
            adapter: null,
            timeline: [],
            provenance: {
                configHash: manifest.FT_CONFIG_HASH,
                runtimeVersion: manifest.ORT_VERSION,
                runtimeManifestHash: hashBytes(new TextEncoder().encode(JSON.stringify(runtime.default))),
                backend: 'webgpu',
                models: manifest.FT_MODELS.map(
                    ({
                        role,
                        row,
                        revision,
                        sha256,
                    }: {
                        role: string;
                        row: number;
                        revision: string;
                        sha256: string;
                    }) => ({ role, row, revision, sha256 }),
                ),
            },
        };
        await new EditorStemRepository().publish(result, new AbortController().signal, () => {});
        await service.bind(null);
        await service.bind(source.descriptor.trackId);
    });
}
export async function chooseOverlay(page: Page, featureId: string, source = 'original') {
    await page.getByTestId('editor-overlay-menu-toggle').click();
    const menu = page.getByTestId('editor-overlay-feature-menu');
    await menu.locator(`[data-source="${source}"]`).click();
    await menu.locator(`[data-feature-id="${featureId}"]`).click();
}

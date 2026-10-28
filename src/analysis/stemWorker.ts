import { yieldAnalysisTask } from './taskScheduler';
import { runStemAnalysis, readStemCursor, readStemWindow } from './stemWorkerCore';
import type { StemWorkerRequest, StemWorkerResponse, StemPcmSource } from './stemProtocol';
import type { AnalysisSeries } from './types';

export function createStemWorker(
    post: (message: StemWorkerResponse) => void,
    enqueue: (run: () => Promise<void>) => void,
    yieldControl = yieldAnalysisTask,
) {
    let epoch = 0;
    const sources = new Map<string, { source: StemPcmSource; wallpaper?: AnalysisSeries }>();
    const reads = new Map<string, string>();
    const operations = new Set<Promise<void>>();
    return (request: StemWorkerRequest) => {
        if (request.kind === 'stem-clear') {
            epoch = request.epoch;
            sources.clear();
            reads.clear();
            const running = [...operations];
            enqueue(async () => {
                await Promise.allSettled(running);
                post({ kind: 'stem-cleared', epoch, requestId: request.requestId });
            });
            return;
        }
        if (request.kind === 'stem-analyze' && request.epoch > epoch) {
            epoch = request.epoch;
            sources.clear();
        }
        const current = () => request.epoch === epoch;
        const work = async () => {
            if (!current()) return;
            const role = request.kind === 'stem-analyze' ? request.source.role : request.role;
            try {
                if (request.kind === 'stem-analyze') {
                    const series = await runStemAnalysis(
                        request.source,
                        request.featureIds,
                        () => !current(),
                        progress => {
                            if (current())
                                post({ kind: 'stem-progress', requestId: request.requestId, epoch, role, progress });
                        },
                        yieldControl,
                    );
                    if (!current()) return;
                    sources.set(role, {
                        source: request.source,
                        wallpaper: series.find(s => s.featureId === 'wallpaperEngineSpectrum'),
                    });
                    post({ kind: 'stem-result', requestId: request.requestId, epoch, role, series });
                } else {
                    const saved = sources.get(role),
                        key = `${role}:${request.featureId}:${request.window ? 'window' : 'cursor'}`;
                    const cancelled = () => !current() || reads.get(key) !== request.requestId;
                    if (!saved || cancelled()) return;
                    const window = request.window
                        ? await readStemWindow(saved.source, request.window, cancelled)
                        : null;
                    const value = request.window
                        ? null
                        : await readStemCursor(
                              saved.source,
                              request.featureId,
                              request.timeSeconds,
                              epoch,
                              request.requestId,
                              cancelled,
                              saved.wallpaper,
                          );
                    if (!cancelled())
                        post({ kind: 'stem-value', requestId: request.requestId, epoch, role, value, window });
                }
            } catch (error) {
                if (current())
                    post({
                        kind: 'stem-error',
                        requestId: request.requestId,
                        epoch,
                        role,
                        message: error instanceof Error ? error.message : '分轨分析失败。',
                    });
            }
        };
        if (request.kind === 'stem-read') {
            reads.set(
                `${request.role}:${request.featureId}:${request.window ? 'window' : 'cursor'}`,
                request.requestId,
            );
            const operation = work();
            operations.add(operation);
            void operation.finally(() => operations.delete(operation));
        } else enqueue(work);
    };
}

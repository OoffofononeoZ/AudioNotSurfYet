import { RealtimeFeatureExtractor } from './realtimeCore';
import type { RealtimeAnalysisStart, RealtimeAnalysisResponse } from './realtimeTypes';

export async function startRealtimeWorker(
    request: RealtimeAnalysisStart,
    post: (value: RealtimeAnalysisResponse) => void,
) {
    const port = request.port;
    let closed = false,
        sequence = 0;
    const stop = () => {
        closed = true;
        port.close();
    };
    const fail = (error: unknown) => {
        if (!closed)
            post({
                kind: 'realtime-error',
                sessionId: request.sessionId,
                message: error instanceof Error ? error.message : '实时分析失败。',
            });
        stop();
    };
    try {
        const extractor = await RealtimeFeatureExtractor.create(request.sampleRate, request.featureIds);
        port.onmessage = event => {
            if (closed) return;
            const data = event.data;
            try {
                if (data.kind === 'fatal') throw Error(data.message);
                if (
                    data.kind !== 'pcm' ||
                    data.sequence !== sequence++ ||
                    !(data.left instanceof ArrayBuffer) ||
                    !(data.right instanceof ArrayBuffer)
                )
                    throw Error('实时音频流顺序无效。');
                for (const frame of extractor.push(new Float32Array(data.left), new Float32Array(data.right)))
                    post({ kind: 'realtime-frame', sessionId: request.sessionId, frame });
                port.postMessage({ kind: 'recycle', left: data.left, right: data.right }, [data.left, data.right]);
            } catch (error) {
                fail(error);
            }
        };
        port.onmessageerror = () => fail(Error('实时音频消息无法读取。'));
        port.start();
    } catch (error) {
        fail(error);
    }
    return stop;
}

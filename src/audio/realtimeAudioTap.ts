import captureUrl from './realtimeCapture.worklet.js?url';
import type { NativeAudioFrame, NativeInputFeature } from '../visualizer/nativeAudioAnalysis';

export interface RealtimeAudioTapOptions {
    analysisPort?: MessagePort;
    nativeFeatures: NativeInputFeature[];
    onError(message: string): void;
}
export interface RealtimeAudioLease {
    sampleRate: number;
    readNative(): NativeAudioFrame | null;
    release(): void;
}
const modules = new WeakMap<AudioContext, Promise<void>>();

/** Silent analysis branch, owned by AudioEngine and detached without touching audible connections. */
export async function createRealtimeAudioTap(
    context: AudioContext,
    source: AudioNode,
    options: RealtimeAudioTapOptions,
): Promise<RealtimeAudioLease> {
    const nodes: AudioNode[] = [];
    let released = false,
        worklet: AudioWorkletNode | null = null;
    let attached: AudioNode | null = null;
    const release = () => {
        if (released) return;
        released = true;
        if (attached) source.disconnect(attached);
        for (const node of nodes) node.disconnect();
        worklet?.port.close();
    };
    try {
        if (options.analysisPort) {
            let module = modules.get(context);
            if (!module) {
                module = context.audioWorklet.addModule(captureUrl);
                modules.set(context, module);
                void module.catch(() => modules.delete(context));
            }
            await module;
        }
        if (context.state === 'closed') throw Error('音频引擎已关闭。');
        const downmix = context.createGain(),
            silent = context.createGain();
        nodes.push(downmix, silent);
        downmix.channelCount = 2;
        downmix.channelCountMode = 'explicit';
        downmix.channelInterpretation = 'speakers';
        silent.gain.value = 0;
        silent.connect(context.destination);
        if (options.analysisPort) {
            worklet = new AudioWorkletNode(context, 'audiosurf-realtime-capture', {
                channelCount: 2,
                channelCountMode: 'explicit',
                outputChannelCount: [2],
            });
            nodes.push(worklet);
            worklet.onprocessorerror = () => options.onError('实时音频采集失败，请重试。');
            worklet.port.postMessage({ kind: 'connect', port: options.analysisPort }, [options.analysisPort]);
            downmix.connect(worklet);
            worklet.connect(silent);
        }
        const analysers: AnalyserNode[] = [];
        if (options.nativeFeatures.length) {
            const splitter = context.createChannelSplitter(2);
            nodes.push(splitter);
            downmix.connect(splitter);
            for (let channel = 0; channel < 2; channel++) {
                const analyser = context.createAnalyser();
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0;
                analyser.minDecibels = -100;
                analyser.maxDecibels = -30;
                nodes.push(analyser);
                analysers.push(analyser);
                splitter.connect(analyser, channel);
                analyser.connect(silent);
            }
        }
        source.connect(downmix);
        attached = downmix;
        let tick = -1,
            frame: NativeAudioFrame | null = null;
        return {
            sampleRate: context.sampleRate,
            readNative() {
                if (released || analysers.length !== 2) return null;
                const next = Math.floor(context.currentTime * 30);
                if (next === tick) return frame;
                tick = next;
                const frequency: number[] = [],
                    waves: Float32Array[] = [];
                for (const analyser of analysers) {
                    const bytes = new Uint8Array(1024),
                        wave = new Float32Array(2048);
                    analyser.getByteFrequencyData(bytes);
                    analyser.getFloatTimeDomainData(wave);
                    frequency.push(...bytes);
                    waves.push(wave);
                }
                frame = { frequency, waveform: Array.from(waves[0]!, (value, i) => (value + waves[1]![i]!) / 2) };
                return frame;
            },
            release,
        };
    } catch (error) {
        release();
        options.analysisPort?.close();
        throw error;
    }
}

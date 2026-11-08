const status = document.querySelector<HTMLPreElement>('#status')!;
let active: Worker | null = null;
const api = {
    async run(starts: number[], maxTokens = 512): Promise<Record<string, unknown>> {
        if (active) throw Error('A benchmark is already running.');
        const file = document.querySelector<HTMLInputElement>('#stem')!.files?.[0];
        if (!file) throw Error('Select the frozen FT drums WAV.');
        const context = new AudioContext({ sampleRate: 44100 });
        let pcm: Float32Array<ArrayBuffer>;
        try {
            const audio = await context.decodeAudioData(await file.arrayBuffer());
            pcm = new Float32Array(audio.length);
            for (let c = 0; c < audio.numberOfChannels; c++) {
                const input = audio.getChannelData(c);
                for (let i = 0; i < pcm.length; i++) pcm[i] = pcm[i]! + input[i]! / audio.numberOfChannels;
            }
        } finally {
            await context.close();
        }
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL('./benchmark.worker.ts', import.meta.url), { type: 'module' });
            active = worker;
            const stop = () => {
                worker.terminate();
                active = null;
            };
            worker.onmessage = event => {
                const message = event.data;
                status.textContent = JSON.stringify(message.type === 'progress' ? message : { type: message.type });
                if (message.type === 'progress') return;
                stop();
                if (message.type === 'error') reject(Error(message.message));
                else resolve(message.result);
            };
            worker.onerror = event => {
                stop();
                reject(Error(event.message));
            };
            worker.postMessage({ pcm, starts, maxTokens }, [pcm.buffer]);
        });
    },
    cancel() {
        active?.terminate();
        active = null;
    },
};
(window as unknown as { __DrumBenchmark: typeof api }).__DrumBenchmark = api;

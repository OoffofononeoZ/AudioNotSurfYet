// Only copies PCM. The bounded pool prevents the audio thread from queuing unbounded work.
class RealtimeCapture extends AudioWorkletProcessor {
    constructor() {
        super();
        this.free = [];
        this.current = null;
        this.offset = 0;
        this.sequence = 0;
        this.active = false;
        this.port.onmessage = ({ data }) => {
            if (data.kind !== 'connect') return;
            this.channel = data.port;
            this.channel.onmessage = ({ data: recycled }) => {
                if (recycled.kind === 'recycle')
                    this.free.push([new Float32Array(recycled.left), new Float32Array(recycled.right)]);
            };
            this.channel.start();
            this.free = Array.from({ length: 4 }, () => [new Float32Array(1024), new Float32Array(1024)]);
            this.active = true;
        };
    }
    process(inputs) {
        const channels = inputs[0];
        if (!this.active || !channels?.length) return true;
        const left = channels[0],
            right = channels[1] ?? left;
        for (let i = 0; i < left.length; i++) {
            if (!this.current) {
                this.current = this.free.pop();
                if (!this.current) {
                    this.active = false;
                    this.channel.postMessage({ kind: 'fatal', message: '实时分析跟不上播放，请重试。' });
                    return true;
                }
            }
            this.current[0][this.offset] = left[i];
            this.current[1][this.offset++] = right[i];
            if (this.offset === 1024) {
                const [l, r] = this.current;
                this.channel.postMessage({ kind: 'pcm', sequence: this.sequence++, left: l.buffer, right: r.buffer }, [
                    l.buffer,
                    r.buffer,
                ]);
                this.current = null;
                this.offset = 0;
            }
        }
        return true;
    }
}
registerProcessor('audiosurf-realtime-capture', RealtimeCapture);

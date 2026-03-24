export class AudioLoader {
    private audioContext: AudioContext;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    private analyser: AnalyserNode | null = null;

    constructor() {
        this.audioContext = new AudioContext();
    }

    // 加载音频文件
    async loadAudio(url: string): Promise<AudioBuffer> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        this.buffer = await this.audioContext.decodeAudioData(arrayBuffer);
        return this.buffer;
    }

    /**
     * 处理音频帧,分帧处理
     * @param frameSize 帧大小
     * @param hopSize 步长
     * @param callback 回调函数，参数为帧数据和帧索引
     */
    processFrames(
        frameSize = 1024,
        hopSize = 512,
        callback: (frames: Float32Array, index: number) => void,
    ): void {
        if (!this.buffer) {
            throw new Error("Audio not loaded");
        }
        const channelData = this.buffer.getChannelData(0);
        const total = channelData.length;

        let frameIndex = 0;

        for (let i = 0; i < total - frameSize; i += hopSize) {
            const frame = channelData.slice(i, i + frameSize);
            callback(frame, frameIndex++);
        }
    }

    // 创建音频节点
    createNodes() {
        if (!this.buffer) {
            throw new Error("Audio not loaded");
        }

        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.buffer;

        this.analyser = this.audioContext.createAnalyser();

        // 连接节点
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
    }

    // 播放
    play() {
        if (!this.source) {
            this.createNodes();
        }
        this.source?.start(0);
    }

    // 停止
    stop() {
        this.source?.stop();
    }

    // 获取频谱数据（用于FFT或3D可视化）
    getFrequencyData(): Uint8Array | null {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        this.analyser.getByteFrequencyData(dataArray);

        return dataArray;
    }

    // 获取时域数据
    getTimeDomainData(): Uint8Array | null {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        this.analyser.getByteTimeDomainData(dataArray);

        return dataArray;
    }
}

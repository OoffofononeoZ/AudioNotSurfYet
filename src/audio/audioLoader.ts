export class AudioLoader {
    private audioContext: AudioContext;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    private analyser: AnalyserNode | null = null;

    private playbackOffsetSec = 0;
    private playbackStartContextTime: number | null = null;

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
     * 处理音频帧,分帧处理（全音频文件处理）
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
            console.log(i / (total - frameSize), total, i);
            callback(frame, frameIndex++);
        }
    }

    private ensureAnalyser() {
        if (!this.buffer) {
            throw new Error("Audio not loaded");
        }
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.connect(this.audioContext.destination);
        }
    }

    /** 创建新的 BufferSource */
    private attachNewSource() {
        this.ensureAnalyser();
        if (this.source) {
            try {
                this.source.stop();
            } catch {
                /* 已停止 */
            }
            this.source.disconnect();
        }
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.analyser!);
    }

    /** 从当前 playbackOffsetSec 开始播放到结束 */
    private startFromCurrentOffset() {
        if (!this.buffer) {
            throw new Error("Audio not loaded");
        }
        if (this.playbackOffsetSec >= this.buffer.duration) {
            return;
        }
        void this.audioContext.resume();
        this.attachNewSource();
        const when = this.audioContext.currentTime;
        this.source!.start(when, this.playbackOffsetSec);
        this.playbackStartContextTime = when;
    }

    /** 重播 */
    play() {
        this.playbackOffsetSec = 0;
        this.startFromCurrentOffset();
    }

    /** 暂停 */
    pause() {
        if (!this.source || this.playbackStartContextTime === null || !this.buffer) {
            return;
        }
        const elapsed = this.audioContext.currentTime - this.playbackStartContextTime;
        this.playbackOffsetSec = Math.min(
            this.playbackOffsetSec + elapsed,
            this.buffer.duration,
        );
        try {
            this.source.stop();
        } catch {
            /* 已停止 */
            console.error('AudioLoader: pause failed, already paused');
        }
        this.source.disconnect();
        this.source = null;
        this.playbackStartContextTime = null;
    }

    /** 续播 */
    resume() {
        this.startFromCurrentOffset();
    }

    /** 停止 */
    stop() {
        if (this.source) {
            try {
                this.source.stop();
            } catch {
                /* 已停止 */
                console.error('AudioLoader: stop failed, already stopped');
            }
            this.source.disconnect();
            this.source = null;
        }
        this.playbackOffsetSec = 0;
        this.playbackStartContextTime = null;
    }

    /** 设置播放偏移时间
     * @param offset 偏移时间百分比.[0, 1]
     */
    setPlaybackOffsetPercent(offset: number) {
        this.playbackOffsetSec = offset * this.buffer!.duration;
    }

    /** 获取当前播放进度百分比.[0, 1] */
    getCurrentProgressPercent(): number {
        return this.playbackOffsetSec / this.buffer!.duration;
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

    getTimeDomainFloatData(): Float32Array | null {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);

        this.analyser.getFloatTimeDomainData(dataArray);

        return dataArray;
    }
}

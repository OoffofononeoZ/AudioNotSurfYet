export class AudioLoader {
    private audioContext: AudioContext;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    private analyser: AnalyserNode | null = null;

    private playbackOffsetSec = 0;
    private playbackStartContextTime: number | null = null;
    private onEndedCallback: () => void = () => {};
    private suppressEndedCallback = false;

    constructor() {
        this.audioContext = new AudioContext();
    }

    // 加载音频文件
    async loadAudio(url: string): Promise<AudioBuffer> {
        this.stop();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        this.buffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.playbackOffsetSec = 0;
        this.playbackStartContextTime = null;
        this.suppressEndedCallback = false;
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
            this.suppressEndedCallback = true;
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
        this.suppressEndedCallback = false;

        this.source.onended = () => {
            const shouldCallEnded = !this.suppressEndedCallback;
            if (shouldCallEnded) {
                this.playbackOffsetSec = this.buffer!.duration;
            }
            this.playbackStartContextTime = null;
            this.source = null;
            this.suppressEndedCallback = false;
            if (shouldCallEnded) {
                this.onEndedCallback();
            }
        }
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
            this.suppressEndedCallback = true;
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
                this.suppressEndedCallback = true;
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

    hasLoaded(): boolean {
        return this.buffer !== null;
    }

    setOnEndedCallback(callback: () => void) {
        this.onEndedCallback = callback;
    }

    /** 设置播放偏移时间
     * @param offset 偏移时间百分比.[0, 1]
     */
    setPlaybackOffsetPercent(offset: number) {
        if (!this.buffer) return;
        this.playbackOffsetSec = offset * this.buffer!.duration;
    }

    /** 获取当前播放进度百分比.[0, 1] */
    getCurrentProgressPercent(): number {
        if (!this.buffer || this.buffer.duration <= 0) return 0;
        return this.getCurrentTimeSec() / this.buffer.duration;
    }

    getCurrentTimeSec(): number {
        if (!this.buffer) return 0;
        if (!this.source || this.playbackStartContextTime === null) {
            return this.playbackOffsetSec;
        }
        const elapsed = this.audioContext.currentTime - this.playbackStartContextTime;
        return Math.min(this.playbackOffsetSec + elapsed, this.buffer.duration);
    }

    getDurationSec(): number {
        return this.buffer?.duration || 0;
    }

    getIsPlaying(): boolean {
        return this.source !== null && this.playbackStartContextTime !== null;
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

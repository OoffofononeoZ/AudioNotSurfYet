import { hashBytes } from './sha256';
export const FT_ROLES = ['drums', 'bass', 'other', 'vocals'] as const;
export type StemRole = typeof FT_ROLES[number];
export const FT_RATE = 44_100;
export const FT_FRAMES = 343_980;
export const FT_OVERLAP = 85_995;
export const FT_STRIDE = FT_FRAMES - FT_OVERLAP;
export const ORT_VERSION = '1.30.0';
export const FT_CONFIG = {
    version: 'ft-browser-p1-v3', sampleRate: FT_RATE, frames: FT_FRAMES,
    runtimeBuild: 'ort-all-jsep', graphOptimization: 'disabled',
    overlap: FT_OVERLAP, stride: FT_STRIDE, normalization: 'none-export-graph',
    window: 'linear-25pct-f32-uncovered-endpoint-1e-8', padding: 'zero',
    resampler: 'blackman-sinc-64tap-1024phase-zero-phase-v1',
    modelInput: 'native-44100-or-task-opfs-44100-stereo-reuse-v1',
    sourceHash: 'descriptor-v1-and-native-channel-chunks-16384-le-f32',
    energy: '30hz-channel-mean-square-rms-dbfs-minus80-zero-u16',
} as const;
export const FT_CONFIG_HASH=hashBytes(new TextEncoder().encode(JSON.stringify(FT_CONFIG)));
const revisions = [
    '44f630d49a19053a61c12df7244fe1f01b9ccc4f',
    '6b68834ec1a38cd0b52df39daef934b0129bf8df',
    'fbcaddbf49915896c2b1e8f53dc648e069ba16e9',
    'fd6ed435870341162ac4b3e7dcc9c8a89c3ecc60',
];
const checksums = [
    '047764dff888cfb87da917013377d4ec7a134f7419cbe486d9c339aa17975ddd',
    'b533037176b14b2df31c92a5d5b3d5660d0811b9b360d3db761964768b079961',
    'b739171a7057b3107bb0711c6222d4a619b41b13a8f04026431d30f32ad2bd71',
    '0cbe651f535415c9d26a7bb614f7d322dd5a080fa0298f2e50f478030a994dce',
];
export const FT_MODELS = FT_ROLES.map((role, row) => ({
    role, row, repository: `StemSplitio/htdemucs-ft-${role}-onnx`,
    revision: revisions[row]!, sha256: checksums[row]!, bytes: 165_612_636,
    file: `htdemucs_ft_${role}_fp16weights.onnx`, license: 'MIT',
    get url() {
        return `https://huggingface.co/${this.repository}/resolve/${this.revision}/${this.file}`;
    },
}));

export class ProcessingError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
        super(message); this.name = 'ProcessingError'; this.code = code;
    }
}
export function checkCancelled(signal: AbortSignal): void {
    if (signal.aborted) throw new ProcessingError('job-cancelled', 'Processing cancelled.');
}

import { ProcessingError } from './modelManifest';

// One application instance owns one processing Worker slot. The analysis
// Coordinator's existing feature Worker is a separate, unchanged resource.
export class EditorProcessingGate {
    private active:{token:symbol;kind:'separation'|'transcription'}|null = null;
    acquire(kind:'separation'|'transcription'):() => void {
        if (this.active) throw new ProcessingError('processing-busy',this.active.kind === 'separation' ? '音轨分离尚未结束。' : '自动标记尚未结束或正在释放资源。');
        const token = Symbol(kind); this.active = {token,kind};
        return () => { if (this.active?.token === token) this.active = null; };
    }
    get current():'separation'|'transcription'|null { return this.active?.kind ?? null; }
}

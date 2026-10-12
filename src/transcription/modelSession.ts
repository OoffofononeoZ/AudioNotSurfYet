import type { OrtModule } from '../processing/runtime';
import { FT_SESSION_OPTIONS, initializeRuntime } from '../processing/runtime';
import { loadModel } from '../processing/modelCache';
import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import { transcriptionModel, type TranscriptionModelId } from './modelManifest';

export type TranscriptionProgress = (phase:string,done:number,total:number|null) => void;
export type ModelSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;

export async function openTranscriptionRuntime(backend:'wasm'|'webgpu',signal:AbortSignal) {
    return initializeRuntime(signal,backend === 'wasm');
}
export async function openModelSession(ort:OrtModule,id:TranscriptionModelId,signal:AbortSignal,
    progress:TranscriptionProgress,modelBase?:string):Promise<ModelSession> {
    const model = transcriptionModel(id);
    const artifact = await loadModel(model,signal,progress,modelBase ? `${modelBase}/${model.file}` : model.url);
    checkCancelled(signal);
    progress('model-load',0,null);
    let session:ModelSession;
    try {
        session = await ort.InferenceSession.create(artifact.bytes,{...FT_SESSION_OPTIONS,executionProviders:[model.backend]});
    } catch (error) {
        checkCancelled(signal);
        throw new ProcessingError('model-incompatible',`${id}: ${error instanceof Error ? error.message : 'Model initialization failed.'}`);
    }
    if (signal.aborted) { await session.release(); checkCancelled(signal); }
    return session;
}

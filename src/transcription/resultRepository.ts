import { checkCancelled,ORT_VERSION,ProcessingError } from '../processing/modelManifest';
import { checkCapacity,jobDirectory,removeJob } from '../processing/storage';
import { blobHash } from '../processing/editorResultRepository';
import { hashBytes } from '../processing/sha256';
import { validateCandidates,validateThresholds } from './candidates';
import type { NoteThresholds,TranscriptionIdentity } from './candidateTypes';
import type { TranscriptionBundle } from './workerProtocol';
import { transcriptionModel } from './modelManifest';

export interface TranscriptionRecord {
    version:1;createdAt:number;identityKey:string;bundle:TranscriptionBundle;thresholds:NoteThresholds;
    files:Array<{name:string;bytes:number;sha256:string}>;metadataHash:string;
}
const identityKey = (identity:TranscriptionIdentity) => hashBytes(new TextEncoder().encode(JSON.stringify(identity)));
export function sameTranscriptionSource(a:TranscriptionIdentity,b:TranscriptionIdentity):boolean {
    const {selectedRoles:_a,...sourceA} = a,{selectedRoles:_b,...sourceB} = b;
    return Object.keys(sourceA).length === Object.keys(sourceB).length && Object.entries(sourceA).every(([key,value]) => value === sourceB[key as keyof typeof sourceB]);
}
function metadataHash(record:Omit<TranscriptionRecord,'metadataHash'>):string {
    return hashBytes(new TextEncoder().encode(JSON.stringify(record)));
}
async function database():Promise<IDBDatabase> {
    return new Promise((resolve,reject) => {
        const request = indexedDB.open('editor-transcriptions',1);
        request.onupgradeneeded = () => { request.result.createObjectStore('results'); };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
}
async function records():Promise<TranscriptionRecord[]> {
    const db = await database();
    try { return await new Promise((resolve,reject) => { const request = db.transaction('results').objectStore('results').getAll();request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
}
function validateBundle(bundle:TranscriptionBundle):void {
    validateCandidates(bundle.result);
    const auxiliary = bundle.auxiliary;
    if (!auxiliary) { if (bundle.result.auxiliaryDirectory !== null) throw new ProcessingError('result-invalid','辅助音频身份缺失。'); return; }
    const identity = bundle.result.identity;
    if (auxiliary.directory !== bundle.result.id || auxiliary.directory !== bundle.result.auxiliaryDirectory
        || !/^transcription-[a-f0-9-]{36}$/.test(auxiliary.directory) || auxiliary.source.hash !== identity.pcmHash
        || auxiliary.source.directory !== identity.ftResultId || auxiliary.provenance.configHash !== identity.configHash
        || auxiliary.provenance.modelManifestHash !== identity.modelManifestHash || auxiliary.provenance.runtimeManifestHash !== identity.runtimeManifestHash
        || auxiliary.provenance.runtimeVersion !== ORT_VERSION || auxiliary.provenance.backend !== 'webgpu'
        || JSON.stringify(auxiliary.provenance.model) !== JSON.stringify(transcriptionModel('htdemucs-6s'))
        || auxiliary.stems.map(stem => stem.role).join(',') !== 'guitar,piano') throw new ProcessingError('result-invalid','辅助音频模型或歌曲身份不匹配。');
    const frames = Math.round(identity.durationSeconds * 44100),count = Math.ceil(frames / 1470);
    for (const stem of auxiliary.stems) if (stem.frames !== frames || stem.sampleRate !== 44100 || stem.left !== `${stem.role}-left.f32`
        || stem.right !== `${stem.role}-right.f32` || stem.wav !== `${stem.role}.wav` || !(stem.energy instanceof Uint16Array)
        || !(stem.waveformMin instanceof Float32Array) || !(stem.waveformMax instanceof Float32Array)
        || [stem.energy.length,stem.waveformMin.length,stem.waveformMax.length].some(length => length !== count)
        || stem.energyScale !== 80 / 65535 || stem.energyOffset !== -80
        || stem.waveformMin.some((value,index) => !Number.isFinite(value) || value > stem.waveformMax[index]!)
        || stem.waveformMax.some(value => !Number.isFinite(value))) throw new ProcessingError('result-invalid','辅助音频元数据不完整。');
}
function fileManifest(bundle:TranscriptionBundle):Array<{name:string;bytes:number}> {
    return bundle.auxiliary?.stems.flatMap(stem => [{name:stem.left,bytes:stem.frames * 4},{name:stem.right,bytes:stem.frames * 4},{name:stem.wav,bytes:44 + stem.frames * 8}]) ?? [];
}
export interface TranscriptionRepositoryPort {
    publish(bundle:TranscriptionBundle,thresholds:NoteThresholds,signal:AbortSignal,cacheLimit:number):Promise<void>;
    saveEdits(bundle:TranscriptionBundle,thresholds:NoteThresholds,signal:AbortSignal):Promise<void>;
    restore(identity:TranscriptionIdentity,signal:AbortSignal):Promise<TranscriptionRecord|null>;
    discard(id:string):Promise<void>;
    clearForSource(ftResultId:string):Promise<void>;
    clearAll():Promise<void>;
}
export class TranscriptionRepository implements TranscriptionRepositoryPort {
    async saveEdits(bundle:TranscriptionBundle,thresholds:NoteThresholds,signal:AbortSignal):Promise<void> {
        validateBundle(bundle);validateThresholds(thresholds);checkCancelled(signal);
        const previous = (await records()).find(record => record.bundle?.result?.id === bundle.result.id);
        if (!previous) throw new ProcessingError('result-invalid','已保存的候选结果不存在。');
        const {metadataHash:expected,...body} = previous;
        if (expected !== metadataHash(body) || previous.identityKey !== identityKey(bundle.result.identity)) throw new ProcessingError('result-invalid','已保存的候选缓存身份损坏。');
        const nextBody = {...body,bundle,thresholds};
        const next = {...nextBody,metadataHash:metadataHash(nextBody)};
        const db = await database();
        try {
            await new Promise<void>((resolve,reject) => {
                const tx = db.transaction('results','readwrite'),cancel = () => tx.abort();signal.addEventListener('abort',cancel,{once:true});
                tx.oncomplete = () => { signal.removeEventListener('abort',cancel);resolve(); };
                tx.onabort = tx.onerror = () => { signal.removeEventListener('abort',cancel);reject(tx.error ?? new ProcessingError('job-cancelled','候选修正保存已取消。')); };
                tx.objectStore('results').put(next,bundle.result.id);if (signal.aborted) cancel();
            });
        } finally { db.close(); }
    }
    async publish(bundle:TranscriptionBundle,thresholds:NoteThresholds,signal:AbortSignal,cacheLimit:number):Promise<void> {
        validateBundle(bundle);validateThresholds(thresholds);checkCancelled(signal);
        const files:TranscriptionRecord['files'] = [];
        if (bundle.auxiliary) {
            const directory = await jobDirectory(bundle.auxiliary.directory);
            for (const entry of fileManifest(bundle)) {
                const file = await (await directory.getFileHandle(entry.name)).getFile();
                if (file.size !== entry.bytes) throw new ProcessingError('result-invalid','辅助音频文件不完整。');
                files.push({...entry,sha256:await blobHash(file,signal)});
            }
        }
        const body = {version:1 as const,createdAt:Date.now(),identityKey:identityKey(bundle.result.identity),bundle,thresholds,files};
        const record = {...body,metadataHash:metadataHash(body)};
        await checkCapacity(new TextEncoder().encode(JSON.stringify(record)).byteLength,cacheLimit);checkCancelled(signal);
        const db = await database();
        try {
            await new Promise<void>((resolve,reject) => {
                const tx = db.transaction('results','readwrite'),cancel = () => tx.abort();
                signal.addEventListener('abort',cancel,{once:true});
                const clear = () => signal.removeEventListener('abort',cancel);
                tx.oncomplete = () => { clear(); resolve(); }; tx.onabort = tx.onerror = () => { clear(); reject(tx.error ?? new ProcessingError('job-cancelled','候选保存已取消。')); };
                tx.objectStore('results').put(record,bundle.result.id);if (signal.aborted) cancel();
            });
        } finally { db.close(); }
    }
    async restore(identity:TranscriptionIdentity,signal:AbortSignal):Promise<TranscriptionRecord|null> {
        const key = identityKey(identity);
        const matching = (await records()).filter(record => record && (record.identityKey === key || (record.bundle?.result?.identity && sameTranscriptionSource(record.bundle.result.identity,identity)))).sort((a,b) => b.createdAt - a.createdAt);
        if (!matching.length) return null;
        const record = matching[0]!;checkCancelled(signal);
        const {metadataHash:expected,...body} = record;
        try {
            validateBundle(record.bundle);
            validateThresholds(record.thresholds);
            if (record.version !== 1 || record.identityKey !== identityKey(record.bundle.result.identity) || expected !== metadataHash(body) || !sameTranscriptionSource(record.bundle.result.identity,identity)) throw Error('Candidate metadata mismatch.');
            const expectedFiles = fileManifest(record.bundle);
            if (record.files.length !== expectedFiles.length || expectedFiles.some((file,index) => record.files[index]?.name !== file.name || record.files[index]?.bytes !== file.bytes)) throw Error('Auxiliary file manifest mismatch.');
            if (record.bundle.auxiliary) {
                const directory = await jobDirectory(record.bundle.auxiliary.directory);
                for (const entry of record.files) {
                    const file = await (await directory.getFileHandle(entry.name)).getFile();
                    if (file.size !== entry.bytes || await blobHash(file,signal) !== entry.sha256) throw Error('Auxiliary file checksum mismatch.');
                }
            }
            checkCancelled(signal);return record;
        } catch { checkCancelled(signal);throw new ProcessingError('result-invalid','候选或辅助音频缓存缺失／损坏，请重新分析或显式清理。'); }
    }
    async discard(id:string):Promise<void> {
        if (!/^transcription-[a-f0-9-]{36}$/.test(id)) throw new ProcessingError('invalid-request','无效的自动标记缓存身份。');
        if ((await removeJob(id)).length) throw new ProcessingError('cleanup-failed','辅助音频仍在使用或无法清理。');
        const db = await database();
        try { await new Promise<void>((resolve,reject) => { const tx = db.transaction('results','readwrite');tx.oncomplete = () => resolve();tx.onabort = tx.onerror = () => reject(tx.error);tx.objectStore('results').delete(id); }); }
        finally { db.close(); }
    }
    async clearForSource(ftResultId:string):Promise<void> { for (const record of await records()) if (record?.bundle?.result?.identity?.ftResultId === ftResultId) await this.discard(record.bundle.result.id); }
    async clearAll():Promise<void> {
        const ids = new Set<string>();
        const cache = await database();
        try {
            const keys = await new Promise<IDBValidKey[]>((resolve,reject) => { const request = cache.transaction('results').objectStore('results').getAllKeys();request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error); });
            for (const key of keys) if (typeof key === 'string' && /^transcription-[a-f0-9-]{36}$/.test(key)) ids.add(key);
        } finally { cache.close(); }
        try {
            const root = await navigator.storage.getDirectory(),directory = await root.getDirectoryHandle('processing-p1');
            for await (const key of (directory as FileSystemDirectoryHandle & {keys():AsyncIterableIterator<string>}).keys()) if (/^transcription-[a-f0-9-]{36}$/.test(key)) ids.add(key);
        } catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
        for (const id of ids) await this.discard(id);
        // Explicitly clear this feature's metadata, including malformed records
        // whose keys cannot name an owned OPFS directory. Other DBs are untouched.
        const db = await database();
        try { await new Promise<void>((resolve,reject) => { const tx = db.transaction('results','readwrite');tx.oncomplete = () => resolve();tx.onabort = tx.onerror = () => reject(tx.error);tx.objectStore('results').clear(); }); }
        finally { db.close(); }
    }
}

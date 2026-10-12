import { normalizeEditorSeconds } from '../editor/projectCodec';
import { ProcessingError } from '../processing/modelManifest';
import { TRANSCRIPTION_CONFIG } from './modelManifest';
import { TRANSCRIPTION_ROLES } from './candidateTypes';
import type { MarkerCandidate,NoteInstrument,NoteThresholds,TranscriptionResult } from './candidateTypes';

export function candidateEventKind(candidate:MarkerCandidate,thresholds:NoteThresholds):'point'|'range' {
    if (candidate.kind === 'drum') return 'point';
    const threshold = thresholds[candidate.instrument] ?? TRANSCRIPTION_CONFIG.pointRangeThresholdMs;
    if (!Number.isFinite(threshold) || threshold < 0) throw new ProcessingError('invalid-request','音符长短分界必须是非负毫秒数。');
    const duration = Math.round(candidate.endSeconds * 1e6) - Math.round(candidate.startSeconds * 1e6);
    return duration >= Math.round(threshold * 1000) ? 'range' : 'point';
}
export function candidateCategory(candidate:MarkerCandidate):string {
    return candidate.kind === 'drum' ? candidate.drum : String(candidate.pitch);
}
export function validateCandidates(result:TranscriptionResult):void {
    const identity = result?.identity;
    const hash = /^[a-f0-9]{64}$/;
    const text = (value:unknown):value is string => typeof value === 'string' && !!value.trim();
    if (!result || result.version !== 1 || !text(result.id) || !text(result.createdAt) || !Number.isFinite(Date.parse(result.createdAt))
        || !identity || !text(identity.trackId) || !text(identity.ftResultId)
        || !Number.isFinite(identity.durationSeconds) || identity.durationSeconds <= 0
        || [identity.contentHash,identity.pcmHash,identity.configHash,identity.modelManifestHash,identity.runtimeManifestHash].some(value => !hash.test(value))
        || !Array.isArray(identity.selectedRoles) || !identity.selectedRoles.length || new Set(identity.selectedRoles).size !== identity.selectedRoles.length
        || identity.selectedRoles.some(role => !TRANSCRIPTION_ROLES.includes(role))
        || !Array.isArray(result.completedRoles) || new Set(result.completedRoles).size !== result.completedRoles.length
        || result.completedRoles.some(role => !identity.selectedRoles.includes(role)) || !Array.isArray(result.failures)
        || result.failures.some(failure => !failure || !identity.selectedRoles.includes(failure.role) || result.completedRoles.includes(failure.role) || !text(failure.code) || !text(failure.message))
        || new Set(result.failures.map(failure => failure.role)).size !== result.failures.length
        || identity.selectedRoles.some(role => !result.completedRoles.includes(role) && !result.failures.some(failure => failure.role === role))
        || !(result.auxiliaryDirectory === null || text(result.auxiliaryDirectory))
        || !result.timings || typeof result.timings !== 'object' || Array.isArray(result.timings) || Object.values(result.timings).some(value => !Number.isFinite(value) || value < 0)
        || !Array.isArray(result.truncatedDrumSegments) || result.truncatedDrumSegments.some(time => !Number.isFinite(time) || time < 0 || time >= identity.durationSeconds)
        || !Array.isArray(result.candidates)) throw new ProcessingError('result-invalid','自动标记结果身份或任务状态无效。');
    const ids = new Set<string>();
    for (const candidate of result.candidates) {
        if (!candidate || typeof candidate.id !== 'string' || !candidate.id.trim() || ids.has(candidate.id) || typeof candidate.deleted !== 'boolean'
            || !Number.isFinite(candidate.startSeconds) || !Number.isFinite(candidate.endSeconds)
            || candidate.startSeconds < 0 || candidate.startSeconds >= identity.durationSeconds || candidate.endSeconds > identity.durationSeconds
            || candidate.endSeconds < candidate.startSeconds || !Number.isFinite(candidate.strength) || candidate.strength < 0 || candidate.strength > 1
            || !candidate.source || candidate.source.resultId !== result.id || typeof candidate.source.artifactId !== 'string' || !candidate.source.artifactId.trim()
            || !result.completedRoles.includes(candidate.source.inputRole)) throw new ProcessingError('result-invalid','候选时间、强度或来源身份无效。');
        const auxiliaryInput = candidate.source.inputRole === 'piano' || candidate.source.inputRole === 'guitar';
        if (candidate.source.artifactId !== (auxiliaryInput ? result.auxiliaryDirectory : identity.ftResultId)) {
            throw new ProcessingError('result-invalid','候选音频文件来源与结果不匹配。');
        }
        ids.add(candidate.id);
        if (candidate.kind === 'drum') {
            if (candidate.instrument !== 'drums' || candidate.source.inputRole !== 'drums' || candidate.source.model !== 'adt-str'
                || !['kick','snare','hat'].includes(candidate.drum) || !Number.isInteger(candidate.customPitch)) {
                throw new ProcessingError('result-invalid','鼓候选类别无效。');
            }
        } else if (candidate.kind === 'note') {
            if (!['bass','vocals','piano','guitar','unknown'].includes(candidate.instrument) || candidate.source.inputRole === 'drums'
                || candidate.source.model !== 'basic-pitch' || !Number.isInteger(candidate.pitch) || candidate.pitch < 21 || candidate.pitch > 108
                || normalizeEditorSeconds(candidate.endSeconds) <= normalizeEditorSeconds(candidate.startSeconds)) {
                throw new ProcessingError('result-invalid','音符候选类别、音高或持续时间无效。');
            }
        } else throw new ProcessingError('result-invalid','未知候选类型。');
    }
}

export function validateThresholds(thresholds:NoteThresholds):void {
    if (!thresholds || typeof thresholds !== 'object' || Array.isArray(thresholds)
        || Object.entries(thresholds).some(([instrument,value]) => !['bass','vocals','piano','guitar','unknown'].includes(instrument) || !Number.isFinite(value) || value < 0)) {
        throw new ProcessingError('result-invalid','音符长短分界缓存无效。');
    }
}

export function correctCandidate(result:TranscriptionResult,id:string,patch:{deleted?:boolean;instrument?:NoteInstrument;drum?:'kick'|'snare'|'hat'}):TranscriptionResult {
    const candidate = result.candidates.find(candidate => candidate.id === id);
    if (!candidate) throw new ProcessingError('invalid-request','候选已经不存在。');
    if ((patch.instrument !== undefined && candidate.kind !== 'note') || (patch.drum !== undefined && candidate.kind !== 'drum')) {
        throw new ProcessingError('invalid-request','此候选不支持该类修正。');
    }
    const next = {...result,candidates:result.candidates.map(candidate => candidate.id === id ? {...candidate,...patch} as MarkerCandidate : candidate)};
    validateCandidates(next); return next;
}

export function deduplicateCandidates(candidates:readonly MarkerCandidate[]):MarkerCandidate[] {
    const unique = new Map<string,MarkerCandidate>();
    for (const candidate of candidates) {
        if (candidate.deleted) continue;
        const key = [candidate.instrument,candidate.kind,candidateCategory(candidate),normalizeEditorSeconds(candidate.startSeconds),
            candidate.kind === 'note' ? normalizeEditorSeconds(candidate.endSeconds) : 'point'].join(':');
        const previous = unique.get(key);
        if (!previous || candidate.strength > previous.strength) unique.set(key,candidate);
    }
    return [...unique.values()].sort((a,b) => a.startSeconds - b.startSeconds || a.id.localeCompare(b.id));
}

// Review hint only: same pitch and nearly identical onset/end on different
// instrument candidates. It never deletes, merges or changes model results.
export function crossInstrumentHints(candidates:readonly MarkerCandidate[],toleranceSeconds = 0.05):Map<string,string[]> {
    if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) throw new ProcessingError('invalid-request','无效的复核时间容差。');
    const notes = candidates.filter(candidate => candidate.kind === 'note' && !candidate.deleted).sort((a,b) =>
        (a.kind === 'note' ? a.pitch : 0) - (b.kind === 'note' ? b.pitch : 0) || a.startSeconds - b.startSeconds);
    const hints = new Map<string,string[]>();
    for (let i = 0; i < notes.length; i++) {
        const a = notes[i]!;
        for (let j = i + 1; j < notes.length; j++) {
            const b = notes[j]!;
            if (a.kind !== 'note' || b.kind !== 'note' || a.pitch !== b.pitch || b.startSeconds - a.startSeconds > toleranceSeconds) break;
            if (a.instrument !== b.instrument && Math.abs(a.endSeconds - b.endSeconds) <= toleranceSeconds) {
                hints.set(a.id,[...(hints.get(a.id) ?? []),b.id]); hints.set(b.id,[...(hints.get(b.id) ?? []),a.id]);
            }
        }
    }
    return hints;
}

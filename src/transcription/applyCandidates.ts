import { normalizeEditorSeconds,validateEditorProjectV1 } from '../editor/projectCodec';
import type { EditorLaneV1,EditorProjectV1,InnerClassV1,PointEventV1,RangeEventV1 } from '../editor/types';
import { ProcessingError } from '../processing/modelManifest';
import { hashBytes } from '../processing/sha256';
import { candidateCategory,candidateEventKind,deduplicateCandidates,validateCandidates } from './candidates';
import { INSTRUMENT_LABELS } from './candidateTypes';
import type { CandidateInstrument,MarkerCandidate,NoteThresholds,TranscriptionResult } from './candidateTypes';

function prefix(result:TranscriptionResult):string {
    return `automatic-${hashBytes(new TextEncoder().encode(result.id))}-`;
}
export function resultAlreadyApplied(project:EditorProjectV1,result:TranscriptionResult):boolean {
    return project.lanes.some(lane => lane.id.startsWith(prefix(result)));
}
function categoryLabel(candidate:MarkerCandidate):string {
    if (candidate.kind === 'drum') return candidate.drum;
    const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
    return `${names[candidate.pitch % 12]}${Math.floor(candidate.pitch / 12) - 1} · ${candidate.pitch}`;
}

// Returns one fully validated replacement. The controller publishes it once;
// neither validation errors nor overlaps can partly mutate the user's project.
export function applyCandidateResult(project:EditorProjectV1,result:TranscriptionResult,thresholds:NoteThresholds,
    options:{now?:() => Date;selectedInstruments?:readonly CandidateInstrument[]} = {}):EditorProjectV1 {
    validateCandidates(result);
    if (project.track.contentHash !== result.identity.contentHash || Math.abs(project.track.durationSeconds - result.identity.durationSeconds) > 1e-6) {
        throw new ProcessingError('source-identity-mismatch','自动标记结果不属于当前工程的歌曲。');
    }
    if (resultAlreadyApplied(project,result)) throw new ProcessingError('result-already-applied','本批结果已经应用；不会重复添加标记轨。');
    const selected = options.selectedInstruments ? new Set(options.selectedInstruments) : null;
    const candidates = deduplicateCandidates(result.candidates).filter(candidate => !selected || selected.has(candidate.instrument));
    if (!candidates.length) throw new ProcessingError('invalid-request','没有可应用的候选。');
    const groups = new Map<string,{instrument:CandidateInstrument;kind:'point'|'range';candidates:MarkerCandidate[]}>();
    for (const candidate of candidates) {
        const kind = candidateEventKind(candidate,thresholds),key = `${candidate.instrument}-${kind}`;
        const group = groups.get(key) ?? {instrument:candidate.instrument,kind,candidates:[]};
        group.candidates.push(candidate); groups.set(key,group);
    }
    const root = prefix(result);
    const added:EditorLaneV1[] = [];
    for (const [key,group] of groups) {
        const laneId = root + key;
        const classes = new Map<string,InnerClassV1>();
        for (const candidate of group.candidates) {
            const category = candidateCategory(candidate);
            if (!classes.has(category)) classes.set(category,{id:`${laneId}-class-${category}`,label:categoryLabel(candidate)});
        }
        const common = {id:laneId,name:group.instrument === 'drums' ? '鼓击打（自动）' : `${INSTRUMENT_LABELS[group.instrument]} · ${group.kind === 'point' ? '短音' : '长音'}（自动）`,innerClasses:[...classes.values()]};
        if (group.kind === 'point') {
            const points = new Map<string,MarkerCandidate>();
            for (const candidate of group.candidates) {
                const key = `${candidateCategory(candidate)}:${normalizeEditorSeconds(candidate.startSeconds)}`;
                const previous = points.get(key); if (!previous || candidate.strength > previous.strength) points.set(key,candidate);
            }
            const events:PointEventV1[] = [...points.values()].map(candidate => ({id:`${laneId}-event-${candidate.id}`,
                innerClassId:classes.get(candidateCategory(candidate))!.id,atSeconds:normalizeEditorSeconds(candidate.startSeconds)}));
            added.push({...common,eventKind:'point',events});
        } else {
            const events:RangeEventV1[] = group.candidates.map(candidate => ({id:`${laneId}-event-${candidate.id}`,
                innerClassId:classes.get(candidateCategory(candidate))!.id,startSeconds:normalizeEditorSeconds(candidate.startSeconds),endSeconds:normalizeEditorSeconds(candidate.endSeconds)}));
            added.push({...common,eventKind:'range',events});
        }
    }
    try {
        return validateEditorProjectV1({...project,updatedAt:(options.now ?? (() => new Date()))().toISOString(),lanes:[...project.lanes,...added]});
    } catch (error) {
        throw new ProcessingError('candidate-conflict',`候选存在边界、重复时间或同类范围重叠，请先修正：${error instanceof Error ? error.message : String(error)}`);
    }
}

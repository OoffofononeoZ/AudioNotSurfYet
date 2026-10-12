import { describe, expect, it } from 'vitest';
import { createInitialEditorProject,decodeEditorProjectV1,encodeEditorProjectV1 } from '../../src/editor/projectCodec';
import { applyCandidateResult,resultAlreadyApplied } from '../../src/transcription/applyCandidates';
import { candidateEventKind,correctCandidate,crossInstrumentHints,deduplicateCandidates } from '../../src/transcription/candidates';
import type { DrumCandidate,NoteCandidate,NoteInstrument,TranscriptionResult,TranscriptionRole } from '../../src/transcription/candidateTypes';

function result():TranscriptionResult {
    return {version:1,id:'result-1',createdAt:'2026-10-12T12:00:00.000Z',identity:{trackId:'song',contentHash:'a'.repeat(64),pcmHash:'b'.repeat(64),ftResultId:'editor-source',durationSeconds:10,
        configHash:'c'.repeat(64),modelManifestHash:'d'.repeat(64),runtimeManifestHash:'e'.repeat(64),selectedRoles:['drums','bass','piano','guitar']},
        completedRoles:['drums','bass','piano','guitar'],failures:[],truncatedDrumSegments:[],candidates:[],auxiliaryDirectory:'transcription-00000000-0000-0000-0000-000000000000',timings:{}};
}
function note(id:string,instrument:NoteInstrument,start:number,end:number,pitch = 60):NoteCandidate {
    const inputRole:TranscriptionRole = instrument === 'unknown' ? 'piano' : instrument;
    return {id,kind:'note',instrument,startSeconds:start,endSeconds:end,pitch,strength:0.8,deleted:false,
        source:{resultId:'result-1',inputRole,artifactId:inputRole === 'piano' || inputRole === 'guitar' ? 'transcription-00000000-0000-0000-0000-000000000000' : 'editor-source',model:'basic-pitch'}};
}
function drum(id:string,category:'kick'|'snare'|'hat',start:number):DrumCandidate {
    return {id,kind:'drum',instrument:'drums',drum:category,customPitch:category === 'kick' ? 36 : category === 'snare' ? 38 : 42,
        startSeconds:start,endSeconds:start,strength:0.7,deleted:false,source:{resultId:'result-1',inputRole:'drums',artifactId:'editor-source',model:'adt-str'}};
}
function project() {
    let id = 0;
    const project = createInitialEditorProject({track:{contentHash:'a'.repeat(64),fileName:'song.wav',durationSeconds:10,sampleRate:44100},createId:() => `id-${id++}`});
    if (project.tempoMap[0]?.mode === 'metered') { project.tempoMap[0].bpm = 120; project.tempoMap[0].bpmSource = 'user'; }
    project.lanes.push({id:'manual-lane',name:'手动标记',eventKind:'point',innerClasses:[{id:'manual-class',label:'手动'}],events:[{id:'manual-event',innerClassId:'manual-class',atSeconds:0.5}]});
    return project;
}
describe('candidate preview and atomic V1 apply',() => {
    it('reclassifies existing notes at an exact 300ms boundary without losing note end',() => {
        const candidate = note('n','piano',0.123456,0.423456);
        expect(candidateEventKind(candidate,{})).toBe('range');
        expect(candidateEventKind(candidate,{piano:400})).toBe('point');
        expect(candidate.endSeconds).toBe(0.423456);
        expect(() => candidateEventKind(candidate,{piano:NaN})).toThrow();
    });
    it('preserves simultaneous drum classes and only removes duplicates within a class',() => {
        const candidates = [drum('a','kick',1),drum('b','hat',1),drum('c','kick',1)];
        expect(deduplicateCandidates(candidates).map(candidate => candidate.id)).toEqual(['a','b']);
        const r = result(); r.candidates = candidates;
        const applied = applyCandidateResult(project(),r,{}),lane = applied.lanes.find(lane => lane.name === '鼓击打（自动）')!;
        expect(lane.events).toHaveLength(2); expect(lane.innerClasses).toHaveLength(2);
    });
    it('adds unsnapped point/range lanes once, keeps manual data and survives the unchanged V1 codec',() => {
        const p = project(),before = JSON.stringify(p),r = result();
        r.candidates = [note('short','bass',0.137123,0.237123,48),note('long','piano',0.137123,0.741235)];
        const next = applyCandidateResult(p,r,{});
        expect(JSON.stringify(p)).toBe(before); expect(next.tempoMap).toEqual(p.tempoMap); expect(next.lanes[0]).toEqual(p.lanes[0]);
        expect(next.lanes.find(lane => lane.eventKind === 'range')?.events[0]).toMatchObject({startSeconds:0.137123,endSeconds:0.741235});
        expect(next.lanes.find(lane => lane.name.startsWith('低音'))?.events[0]).toMatchObject({atSeconds:0.137123});
        const restored = decodeEditorProjectV1(encodeEditorProjectV1(next));
        expect(restored).toEqual(next); expect(resultAlreadyApplied(restored,r)).toBe(true);
        expect(() => applyCandidateResult(restored,r,{piano:400})).toThrow(/已经应用/);
        expect(Object.keys(restored)).toEqual(Object.keys(p));
    });
    it('rejects an overlap atomically and accepts adjacent notes',() => {
        const p = project(),before = JSON.stringify(p),r = result();
        r.candidates = [note('a','piano',1,2),note('b','piano',1.5,2.5)];
        expect(() => applyCandidateResult(p,r,{})).toThrow(/重叠/); expect(JSON.stringify(p)).toBe(before);
        r.candidates[1] = note('b','piano',2,2.5);
        expect(applyCandidateResult(p,r,{}).lanes.find(lane => lane.eventKind === 'range')?.events).toHaveLength(2);
    });
    it('deduplicates point representations even when the two raw note end times differ',() => {
        const r = result(); r.candidates = [note('a','bass',1,1.1),note('b','bass',1,1.2)];
        expect(applyCandidateResult(project(),r,{}).lanes.find(lane => lane.name.startsWith('低音'))?.events).toHaveLength(1);
        expect(r.candidates).toHaveLength(2);
    });
    it('keeps cross-instrument suspected duplicates and supports unknown, correction and deletion',() => {
        const r = result(); r.candidates = [note('a','piano',1,2),note('b','guitar',1.02,2.01)];
        expect(crossInstrumentHints(r.candidates).get('a')).toEqual(['b']);
        expect(deduplicateCandidates(r.candidates)).toHaveLength(2);
        const corrected = correctCandidate(r,'a',{instrument:'unknown'});
        expect(corrected.candidates[0]?.source.inputRole).toBe('piano');
        expect(corrected.candidates[0]?.instrument).toBe('unknown');
        const deleted = correctCandidate(corrected,'b',{deleted:true});
        expect(applyCandidateResult(project(),deleted,{}).lanes.filter(lane => lane.name.startsWith('未知'))).toHaveLength(1);
        expect(r.candidates[0]?.instrument).toBe('piano');
    });
    it('rejects stale song identity, out-of-bounds and mismatched source results before mutation',() => {
        const p = project(),before = JSON.stringify(p),r = result(); r.candidates = [note('a','piano',1,2)];
        r.identity.contentHash = 'f'.repeat(64); expect(() => applyCandidateResult(p,r,{})).toThrow(/当前工程/);
        r.identity.contentHash = 'a'.repeat(64); r.candidates[0]!.endSeconds = 11;
        expect(() => applyCandidateResult(p,r,{})).toThrow(/无效/);
        r.candidates[0]!.endSeconds = 2; r.candidates[0]!.source.resultId = 'old';
        expect(() => applyCandidateResult(p,r,{})).toThrow(/无效/); expect(JSON.stringify(p)).toBe(before);
    });
});

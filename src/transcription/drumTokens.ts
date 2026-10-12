export type DrumClass = 'kick' | 'snare' | 'hat';
export interface DrumHit { startSeconds:number;endSeconds:number;drum:DrumClass;customPitch:number;strength:number }
export interface DrumDecodeResult { hits:DrumHit[];ignored:number;malformed:number }

// The model uses GM_custom, where 43/44 mean pedal/open hat and 46 means
// crash. Applying the standard GM numbering here would mislabel cymbals.
export function drumClass(customPitch:number):DrumClass|null {
    if ([35,36].includes(customPitch)) return 'kick';
    if ([38,40].includes(customPitch)) return 'snare';
    if ([42,43,44].includes(customPitch)) return 'hat';
    return null;
}
export function decodeDrumTokens(tokens:readonly number[],offsetSeconds:number,durationSeconds:number):DrumDecodeResult {
    if (!Number.isFinite(offsetSeconds) || !Number.isFinite(durationSeconds) || offsetSeconds < 0 || durationSeconds <= 0) {
        throw new ProcessingError('invalid-request','Invalid absolute drum event time base.');
    }
    const result:DrumDecodeResult = {hits:[],ignored:0,malformed:0};
    const seen = new Set<string>();
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]!;
        if (token === 3) break;
        if (token < 4 || token >= 300) continue;
        const pitchToken = tokens[index + 1],velocityToken = tokens[index + 2];
        if (pitchToken === undefined || velocityToken === undefined || pitchToken < 300 || pitchToken >= 400
            || velocityToken < 400 || velocityToken > 527 || ![token,pitchToken,velocityToken].every(Number.isInteger)) {
            result.malformed++; continue;
        }
        const customPitch = pitchToken - 300;
        const drum = drumClass(customPitch);
        const startSeconds = offsetSeconds + (token - 4) / 100;
        if (!drum || startSeconds < 0 || startSeconds >= durationSeconds || token >= 260) { result.ignored++; continue; }
        const key = `${drum}:${Math.round(startSeconds * 1e6)}`;
        const strength = Math.max(0,Math.min(1,(velocityToken - 400) / 127));
        if (!seen.has(key)) {
            result.hits.push({startSeconds,endSeconds:Math.min(durationSeconds,startSeconds + 0.1),drum,customPitch,strength});
            seen.add(key);
        } else {
            const previous = result.hits.find(hit => hit.drum === drum && Math.round(hit.startSeconds * 1e6) === Math.round(startSeconds * 1e6));
            if (previous) previous.strength = Math.max(previous.strength,strength);
        }
    }
    result.hits.sort((a,b) => a.startSeconds - b.startSeconds || a.drum.localeCompare(b.drum));
    return result;
}
import { ProcessingError } from '../processing/modelManifest';

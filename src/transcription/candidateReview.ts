import { hashBytes } from '../processing/sha256';
import { candidateCategory, candidateEventKind } from './candidates';
import { soundGroup, validateReviewSettings } from './reviewSettings';
import type { ReviewSettings, SoundGroupInfo, Sensitivity } from './reviewSettings';
import type { MarkerCandidate, NoteThresholds, TranscriptionResult } from './candidateTypes';
import { ACOUSTIC_CONFIG } from './acousticIndex';

export interface DuplicateReviewGroup {
    id: string;
    candidateIds: string[];
    recommendedId: string | null;
    selectedIds: string[];
    startSeconds: number;
}
export interface SoundMarker {
    id: string;
    groupId: string;
    label: string;
    instrument: MarkerCandidate['instrument'];
    startSeconds: number;
    endSeconds: number;
    eventKind: 'point' | 'range';
    rawIds: string[];
}
export interface ReviewedSoundGroup extends SoundGroupInfo {
    id: string;
    rawCount: number;
    selectedCount: number;
}
export interface CandidateReview {
    markers: SoundMarker[];
    selectedIds: string[];
    excluded: Record<string, string>;
    duplicateGroups: DuplicateReviewGroup[];
    groups: ReviewedSoundGroup[];
}
const PROFILES = {
    conservative: { activation: 0.5, velocity: 0.15, onset: 0.08, salience: 0.24, gap: 0.04 },
    balanced: { activation: 0.38, velocity: 0.08, onset: 0.04, salience: 0.14, gap: 0.06 },
    sensitive: { activation: 0, velocity: 0, onset: 0, salience: 0, gap: 0.08 },
} satisfies Record<Sensitivity, Record<string, number>>;

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0,
        aa = 0,
        bb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!;
        aa += a[i]! ** 2;
        bb += b[i]! ** 2;
    }
    return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : 0;
}
const timbreSimilarity = (a: MarkerCandidate, b: MarkerCandidate) =>
    a.acoustics && b.acoustics ? cosineSimilarity(a.acoustics.mfcc.slice(1), b.acoustics.mfcc.slice(1)) : 0;
function exclusion(candidate: MarkerCandidate, sensitivity: Sensitivity): string | null {
    if (candidate.deleted) return '已删除';
    const evidence = candidate.acoustics;
    if (!evidence) return '缺少声学证据，请重新分析';
    const profile = PROFILES[sensitivity];
    if ((candidate.kind === 'drum' ? evidence.bandRms : evidence.rms) < (sensitivity === 'sensitive' ? 1e-6 : 3e-5))
        return '局部声音过弱';
    if (evidence.salience < profile.salience) return '局部显著性不足';
    if (candidate.kind === 'drum') {
        if (candidate.strength < profile.velocity) return '鼓 velocity 低于当前筛选';
        if (evidence.onset < profile.onset && evidence.localContrast < 1.3) return '缺少独立起音证据';
    } else {
        if (candidate.strength < profile.activation) return '音符激活低于当前筛选';
        if (
            evidence.onset < profile.onset &&
            (candidate.onsetStrength ?? 0) < 0.35 &&
            !(candidate.endSeconds - candidate.startSeconds >= 0.45 && evidence.salience >= 0.55)
        )
            return '缺少起音或持续活动证据';
        if (!evidence.activity.length) return '未检测到有效活动区间';
    }
    return null;
}

/** Same-pitch, strongly similar, overlapping observations from distinct sources. */
function duplicateGroups(candidates: MarkerCandidate[], settings: ReviewSettings): DuplicateReviewGroup[] {
    const parent = new Map(candidates.map(candidate => [candidate.id, candidate.id]));
    const root = (id: string): string => {
        const next = parent.get(id)!;
        if (next === id) return id;
        const found = root(next);
        parent.set(id, found);
        return found;
    };
    const notes = candidates
        .filter(candidate => candidate.kind === 'note' && candidate.acoustics && !candidate.deleted)
        .sort((a, b) => a.startSeconds - b.startSeconds);
    for (let i = 0; i < notes.length; i++)
        for (let j = i + 1; j < notes.length && notes[j]!.startSeconds - notes[i]!.startSeconds <= 0.06; j++) {
            const a = notes[i]!,
                b = notes[j]!;
            if (
                a.kind !== 'note' ||
                b.kind !== 'note' ||
                a.source.inputRole === b.source.inputRole ||
                a.pitch !== b.pitch
            )
                continue;
            const overlap = Math.min(a.endSeconds, b.endSeconds) - Math.max(a.startSeconds, b.startSeconds);
            if (
                overlap / Math.min(a.endSeconds - a.startSeconds, b.endSeconds - b.startSeconds) < 0.65 ||
                timbreSimilarity(a, b) < 0.985 ||
                cosineSimilarity(a.acoustics!.chroma, b.acoustics!.chroma) < 0.98
            )
                continue;
            parent.set(root(b.id), root(a.id));
        }
    const grouped = new Map<string, MarkerCandidate[]>();
    for (const note of notes) {
        const id = root(note.id),
            list = grouped.get(id) ?? [];
        list.push(note);
        grouped.set(id, list);
    }
    return [...grouped.values()]
        .filter(list => list.length > 1)
        .map(list => {
            list.sort((a, b) => b.acoustics!.rms - a.acoustics!.rms || a.id.localeCompare(b.id));
            const strongest = list[0]!,
                second = list[1]!;
            const recommendedId =
                strongest.acoustics!.rms >= second.acoustics!.rms * 2 &&
                strongest.acoustics!.onset >= second.acoustics!.onset * 0.9 &&
                strongest.acoustics!.salience >= 0.24
                    ? strongest.id
                    : null;
            const candidateIds = list.map(candidate => candidate.id).sort();
            const id = `duplicate-${hashBytes(new TextEncoder().encode(JSON.stringify(candidateIds))).slice(0, 16)}`;
            const chosen = settings.duplicateSelections[id];
            return {
                id,
                candidateIds,
                recommendedId,
                selectedIds: chosen
                    ? chosen.filter(candidate => candidateIds.includes(candidate))
                    : recommendedId
                      ? [recommendedId]
                      : [],
                startSeconds: Math.min(...list.map(candidate => candidate.startSeconds)),
            };
        })
        .sort((a, b) => a.startSeconds - b.startSeconds);
}

function sameSourceDuplicates(candidates: MarkerCandidate[], excluded: Record<string, string>): void {
    const groups = new Map<string, MarkerCandidate[]>();
    for (const candidate of candidates) {
        const key = `${candidate.source.inputRole}:${candidate.instrument}:${candidateCategory(candidate)}`;
        const list = groups.get(key) ?? [];
        list.push(candidate);
        groups.set(key, list);
    }
    for (const list of groups.values()) {
        list.sort((a, b) => a.startSeconds - b.startSeconds || b.strength - a.strength);
        for (let i = 0; i < list.length; i++)
            for (let j = i + 1; j < list.length && list[j]!.startSeconds - list[i]!.startSeconds <= 0.055; j++) {
                const a = list[i]!,
                    b = list[j]!;
                if (excluded[a.id] || excluded[b.id] || timbreSimilarity(a, b) < 0.995) continue;
                const delta = b.startSeconds - a.startSeconds;
                if (delta === 0 && (a.kind === 'drum' || a.endSeconds === b.endSeconds))
                    excluded[b.id] = '同声音的重复候选';
                // A weak trailing observation can be folded only with both timbral
                // agreement and an independent attack in the retained observation.
                else if (
                    delta >= 0.03 &&
                    b.acoustics!.onset < 0.03 &&
                    a.acoustics!.onset >= 0.1 &&
                    Math.abs(a.acoustics!.onsetSeconds - b.acoustics!.onsetSeconds) <= 0.025
                )
                    excluded[b.id] = '相同声学起音的重复候选';
            }
    }
}

function principalMarkers(
    candidates: MarkerCandidate[],
    settings: ReviewSettings,
    thresholds: NoteThresholds,
): SoundMarker[] {
    const grouped = new Map<string, MarkerCandidate[]>();
    for (const candidate of candidates) {
        const key = soundGroup(candidate, settings).id;
        const list = grouped.get(key) ?? [];
        list.push(candidate);
        grouped.set(key, list);
    }
    const markers: SoundMarker[] = [];
    for (const [groupId, list] of grouped) {
        const group = soundGroup(list[0]!, settings);
        const byId = new Map(list.map(candidate => [candidate.id, candidate]));
        if (list[0]!.kind === 'drum') {
            const points = new Map<number, Array<{ candidate: MarkerCandidate; marker: SoundMarker }>>();
            for (const candidate of list) {
                const time = Math.round(candidate.startSeconds * 1e6),
                    bucket = points.get(time) ?? [];
                const same = bucket.find(
                    entry =>
                        timbreSimilarity(entry.candidate, candidate) >= 0.995 &&
                        Math.abs(entry.candidate.acoustics!.onsetSeconds - candidate.acoustics!.onsetSeconds) <= 1e-6,
                );
                if (same) {
                    same.marker.rawIds.push(candidate.id);
                    continue;
                }
                const marker: SoundMarker = {
                    id: `sound-${candidate.id}`,
                    groupId,
                    label: group.label,
                    instrument: group.instrument,
                    startSeconds: candidate.startSeconds,
                    endSeconds: candidate.startSeconds,
                    eventKind: 'point',
                    rawIds: [candidate.id],
                };
                markers.push(marker);
                bucket.push({ candidate, marker });
                points.set(time, bucket);
            }
            continue;
        }
        const ranges = list
            .flatMap(candidate =>
                candidate.acoustics!.activity.map(range => ({
                    start: Math.max(candidate.startSeconds, range.startSeconds),
                    end: Math.min(candidate.endSeconds, range.endSeconds),
                    candidate,
                    attack: candidate.acoustics!.onset >= PROFILES[settings.sensitivity].onset,
                    attackTime:
                        range.startSeconds > candidate.startSeconds + 0.07
                            ? range.startSeconds
                            : candidate.startSeconds,
                    attackAnchor:
                        range.startSeconds > candidate.startSeconds + 0.07
                            ? range.startSeconds
                            : candidate.acoustics!.onsetSeconds,
                })),
            )
            .filter(range => range.end > range.start)
            .sort((a, b) => a.start - b.start || b.end - a.end);
        let current: { start: number; end: number; ids: Set<string>; attack: number; anchor: number } | null = null;
        const finish = () => {
            if (!current || current.end <= current.start) return;
            const rawIds = [...current.ids]
                    .filter(id =>
                        byId
                            .get(id)!
                            .acoustics!.activity.some(
                                range => range.endSeconds > current!.start && range.startSeconds < current!.end,
                            ),
                    )
                    .sort(),
                startSeconds = current.start,
                endSeconds = current.end;
            const eventKind =
                endSeconds - startSeconds >= (thresholds[group.instrument as keyof NoteThresholds] ?? 300) / 1000
                    ? 'range'
                    : 'point';
            markers.push({
                id: `sound-${hashBytes(new TextEncoder().encode(JSON.stringify([groupId, rawIds, startSeconds, endSeconds]))).slice(0, 20)}`,
                groupId,
                label: group.label,
                instrument: group.instrument,
                startSeconds,
                endSeconds,
                eventKind,
                rawIds,
            });
        };
        for (const range of ranges) {
            if (!current || range.start > current.end + PROFILES[settings.sensitivity].gap) {
                finish();
                current = {
                    start: range.start,
                    end: range.end,
                    ids: new Set([range.candidate.id]),
                    attack: range.attackTime,
                    anchor: range.attackAnchor,
                };
                continue;
            }
            if (
                range.attack &&
                range.attackTime - current.attack > 0.025 &&
                range.start > current.start &&
                range.attackAnchor - current.anchor > (ACOUSTIC_CONFIG.hopSize / ACOUSTIC_CONFIG.sampleRate) * 0.75
            ) {
                const carry: number = current.end;
                current.end = Math.min(current.end, range.start);
                finish();
                current = {
                    start: range.start,
                    end: Math.max(carry, range.end),
                    ids: new Set(
                        [...current.ids]
                            .filter(id =>
                                byId.get(id)!.acoustics!.activity.some(activity => activity.endSeconds > range.start),
                            )
                            .concat(range.candidate.id),
                    ),
                    attack: range.attackTime,
                    anchor: range.attackAnchor,
                };
            } else {
                current.end = Math.max(current.end, range.end);
                current.ids.add(range.candidate.id);
            }
        }
        finish();
    }
    return markers.sort((a, b) => a.startSeconds - b.startSeconds || a.id.localeCompare(b.id));
}

export function deriveCandidateReview(
    result: TranscriptionResult,
    settings: ReviewSettings,
    thresholds: NoteThresholds,
): CandidateReview {
    validateReviewSettings(settings, result);
    const excluded: Record<string, string> = {};
    for (const candidate of result.candidates) {
        const reason = exclusion(candidate, settings.sensitivity);
        if (reason) excluded[candidate.id] = reason;
    }
    sameSourceDuplicates(
        result.candidates.filter(candidate => !excluded[candidate.id]),
        excluded,
    );
    const duplicates = duplicateGroups(result.candidates, settings);
    for (const group of duplicates)
        for (const id of group.candidateIds)
            if (!group.selectedIds.includes(id)) excluded[id] ??= '跨来源疑似重复，尚未选中';
    const selected = result.candidates.filter(candidate => !excluded[candidate.id]);
    const markers =
        settings.view === 'timbres'
            ? principalMarkers(selected, settings, thresholds)
            : selected.map(candidate => ({
                  id: candidate.id,
                  groupId: `${soundGroup(candidate, settings).id}:${candidateCategory(candidate)}`,
                  label: soundGroup(candidate, settings).label,
                  instrument: candidate.instrument,
                  startSeconds: candidate.startSeconds,
                  endSeconds: candidate.endSeconds,
                  eventKind: candidateEventKind(candidate, thresholds),
                  rawIds: [candidate.id],
              }));
    const groups = new Map<string, ReviewedSoundGroup>();
    for (const candidate of result.candidates) {
        const group = soundGroup(candidate, settings),
            entry = groups.get(group.id) ?? { ...group, rawCount: 0, selectedCount: 0 };
        entry.rawCount++;
        if (!excluded[candidate.id]) entry.selectedCount++;
        groups.set(group.id, entry);
    }
    return {
        markers,
        selectedIds: selected.map(candidate => candidate.id),
        excluded,
        duplicateGroups: duplicates,
        groups: [...groups.values()],
    };
}

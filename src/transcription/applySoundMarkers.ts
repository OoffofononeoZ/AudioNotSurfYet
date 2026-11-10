import { normalizeEditorSeconds, validateEditorProjectV2 } from '../editor/projectCodec';
import type { EditorProjectV2, EditorLaneV1, PointEventV1, RangeEventV1 } from '../editor/types';
import { ProcessingError } from '../processing/modelManifest';
import { validateCandidates } from './candidates';
import { resultAlreadyApplied, resultApplyPrefix } from './applyCandidates';
import { INSTRUMENT_LABELS } from './candidateTypes';
import type { TranscriptionResult } from './candidateTypes';
import type { CandidateReview, SoundMarker } from './candidateReview';

export function applySoundMarkers(
    project: EditorProjectV2,
    result: TranscriptionResult,
    review: CandidateReview,
): EditorProjectV2 {
    validateCandidates(result);
    if (
        project.track.contentHash !== result.identity.contentHash ||
        Math.abs(project.track.durationSeconds - result.identity.durationSeconds) > 1e-6
    )
        throw new ProcessingError('source-identity-mismatch', '声音候选不属于当前歌曲。');
    if (resultAlreadyApplied(project, result))
        throw new ProcessingError('result-already-applied', '本批结果已经应用；不会重复添加标记轨。');
    if (!review.markers.length) throw new ProcessingError('invalid-request', '没有通过筛选并完成复核的声音标记。');
    const ids = new Set(result.candidates.map(candidate => candidate.id));
    const selected = new Set(review.selectedIds);
    const lanes = new Map<string, SoundMarker[]>();
    for (const marker of review.markers) {
        if (
            !marker.rawIds.length ||
            marker.rawIds.some(id => !ids.has(id) || !selected.has(id)) ||
            !Number.isFinite(marker.startSeconds) ||
            !Number.isFinite(marker.endSeconds) ||
            marker.startSeconds < 0 ||
            marker.endSeconds < marker.startSeconds ||
            marker.endSeconds > project.track.durationSeconds ||
            !['point', 'range'].includes(marker.eventKind) ||
            !marker.groupId ||
            !marker.label.trim()
        )
            throw new ProcessingError('result-invalid', '派生声音标记或其原始来源无效。');
        const key = `${marker.instrument}-${marker.eventKind}`,
            list = lanes.get(key) ?? [];
        list.push(marker);
        lanes.set(key, list);
    }
    const added: EditorLaneV1[] = [];
    for (const [key, markers] of lanes) {
        const laneId = resultApplyPrefix(result) + key,
            first = markers[0]!;
        const groups = new Map(markers.map(marker => [marker.groupId, marker.label]));
        const common = {
            id: laneId,
            name: `${INSTRUMENT_LABELS[first.instrument]} · ${first.eventKind === 'point' ? '击打与短音' : '声音活动'}（自动）`,
            innerClasses: [...groups].map(([id, label]) => ({ id: `${laneId}-group-${id}`, label })),
        };
        if (first.eventKind === 'point') {
            const events: PointEventV1[] = markers.map(marker => ({
                id: `${laneId}-${marker.id}`,
                innerClassId: `${laneId}-group-${marker.groupId}`,
                atSeconds: normalizeEditorSeconds(marker.startSeconds),
            }));
            added.push({ ...common, eventKind: 'point', events });
        } else {
            const events: RangeEventV1[] = markers.map(marker => ({
                id: `${laneId}-${marker.id}`,
                innerClassId: `${laneId}-group-${marker.groupId}`,
                startSeconds: normalizeEditorSeconds(marker.startSeconds),
                endSeconds: normalizeEditorSeconds(marker.endSeconds),
            }));
            added.push({ ...common, eventKind: 'range', events });
        }
    }
    try {
        return validateEditorProjectV2({
            ...project,
            updatedAt: new Date().toISOString(),
            lanes: [...project.lanes, ...added],
        });
    } catch (error) {
        throw new ProcessingError(
            'candidate-conflict',
            `声音标记存在冲突，原工程未改变：${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

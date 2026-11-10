import { normalizeEditorSeconds, validateEditorProjectV2 } from '../../editor/projectCodec';
import type { EditorProjectV2, EditorLaneV1 } from '../../editor/types';
import { ProcessingError } from '../../processing/modelManifest';
import { exampleHash, queryIdentity, validateExampleProfile } from './types';
import type { ExampleProfile } from './types';

/** Stable attack origins survive query changes and manual edits to applied geometry. */
export function applyExampleMatches(project: EditorProjectV2, profile: ExampleProfile) {
    validateExampleProfile(profile);
    if (
        project.track.contentHash !== profile.songHash ||
        Math.abs(project.track.durationSeconds - profile.durationSeconds) > 1e-6
    )
        throw new ProcessingError('source-identity-mismatch', '检索候选不属于当前歌曲。');
    if (profile.queryHash !== queryIdentity(profile))
        throw new ProcessingError('result-invalid', '示例或设置已改变，请重新检索。');
    const selected = profile.matches.filter(m => m.selected);
    if (!selected.length) throw new ProcessingError('invalid-request', '请先试听并勾选要应用的检索候选。');
    const existing = new Set(project.lanes.flatMap(lane => lane.events.map(event => event.id))),
        lanes = [...project.lanes];
    let added = 0,
        skipped = 0;
    for (const kind of ['point', 'range'] as const) {
        const laneId = `sound-example-${exampleHash([profile.sourceKey, profile.id, kind])}`,
            previous = lanes.find(lane => lane.id === laneId),
            innerClassId = `${laneId}-sound`;
        if (previous && (previous.eventKind !== kind || !previous.innerClasses.some(c => c.id === innerClassId)))
            throw new ProcessingError('candidate-conflict', '示例标记轨结构已改变，请先处理轨道冲突。');
        const candidates = selected.filter(
            m =>
                m.kind === kind &&
                !existing.has(m.id) &&
                !profile.examples.some(
                    e =>
                        e.markerId &&
                        existing.has(e.markerId) &&
                        e.polarity === 'positive' &&
                        e.kind === kind &&
                        (kind === 'point'
                            ? Math.abs(e.startSeconds - m.startSeconds) <= 0.07
                            : Math.min(e.endSeconds, m.endSeconds) - Math.max(e.startSeconds, m.startSeconds) >
                              0.5 * Math.min(e.endSeconds - e.startSeconds, m.endSeconds - m.startSeconds)),
                ),
        );
        const unique = candidates.filter(
            m =>
                kind === 'point' ||
                !previous?.events.some(
                    event =>
                        'startSeconds' in event &&
                        Math.min(event.endSeconds, m.endSeconds) - Math.max(event.startSeconds, m.startSeconds) >
                            0.5 * Math.min(event.endSeconds - event.startSeconds, m.endSeconds - m.startSeconds),
                ),
        );
        skipped += selected.filter(m => m.kind === kind).length - unique.length;
        if (!unique.length) continue;
        const common = {
            id: laneId,
            name: previous?.name ?? `${profile.label}（示例检索）`,
            innerClasses: previous?.innerClasses ?? [{ id: innerClassId, label: profile.label }],
        };
        let next: EditorLaneV1;
        if (kind === 'point')
            next = {
                ...common,
                eventKind: 'point',
                events: [
                    ...(previous?.eventKind === 'point' ? previous.events : []),
                    ...unique.map(m => ({ id: m.id, innerClassId, atSeconds: normalizeEditorSeconds(m.startSeconds) })),
                ].sort((a, b) => a.atSeconds - b.atSeconds),
            };
        else
            next = {
                ...common,
                eventKind: 'range',
                events: [
                    ...(previous?.eventKind === 'range' ? previous.events : []),
                    ...unique.map(m => ({
                        id: m.id,
                        innerClassId,
                        startSeconds: normalizeEditorSeconds(m.startSeconds),
                        endSeconds: normalizeEditorSeconds(m.endSeconds),
                    })),
                ].sort((a, b) => a.startSeconds - b.startSeconds),
            };
        const at = lanes.findIndex(lane => lane.id === laneId);
        if (at >= 0) lanes[at] = next;
        else lanes.push(next);
        added += unique.length;
    }
    try {
        return {
            project: added
                ? validateEditorProjectV2({ ...project, updatedAt: new Date().toISOString(), lanes })
                : project,
            added,
            skipped,
        };
    } catch (error) {
        throw new ProcessingError(
            'candidate-conflict',
            `检索标记有冲突，原工程未改变：${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

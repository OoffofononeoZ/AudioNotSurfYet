import { inject, onBeforeUnmount, provide, ref, watch, type InjectionKey, type Ref } from 'vue';
import { DEFAULT_BEAT_SNAP, validateBeatSnap, type EditorBeatSnapSetting } from './beatSnap';
import { EditorDraftRepository } from './editorDraftRepository';
import { pointCellAtTime, movePointCell } from './pointAnnotations';
import { nextRangeCell } from './rangeAnnotations';
import { generateTempoGrid, snapEditorTime } from './tempoMap';
import type { EditorProjectV1, TempoSegmentV1 } from './types';
import type { PersistedTimelineViewport } from '../types/session';

interface EditorGridContext { setting: Ref<EditorBeatSnapSetting>; message: Ref<string>; set: (value: EditorBeatSnapSetting) => void }
const key: InjectionKey<EditorGridContext> = Symbol('editor-grid');
export function provideEditorGrid(hash: () => string | undefined): void {
    const repository = new EditorDraftRepository();
    const setting = ref<EditorBeatSnapSetting>({ ...DEFAULT_BEAT_SNAP }), message = ref('');
    let generation = 0, revision = 0;
    const context: EditorGridContext = { setting, message, set(value) {
        setting.value = validateBeatSnap(value); revision += 1;
        const contentHash = hash(), current = generation, requestedRevision = revision;
        if (contentHash) void repository.setBeatSnap(contentHash, value).then(() => {
            if (current === generation && requestedRevision === revision) message.value = '';
        }).catch(() => { if (current === generation && requestedRevision === revision) message.value = '细分偏好未保存，当前编辑可继续。'; });
    } };
    provide(key, context);
    watch(hash, async contentHash => {
        const current = ++generation, originalRevision = revision;
        setting.value = { ...DEFAULT_BEAT_SNAP }; message.value = '';
        if (!contentHash) return;
        try {
            const value = await repository.getBeatSnap(contentHash);
            if (current === generation && revision === originalRevision && value) setting.value = value;
        } catch { if (current === generation) message.value = '无法恢复细分偏好，请重新选择。'; }
    }, { immediate: true });
    onBeforeUnmount(() => { generation += 1; repository.close(); });
}
export function useEditorGrid() {
    const context = inject(key);
    if (!context) throw new Error('Editor grid context is unavailable.');
    type Project = Pick<EditorProjectV1, 'tempoMap' | 'track' | 'workspace'>;
    return { ...context,
        pointCellAtTime: (time: number, project: Project, width: number) => pointCellAtTime(time, project, width, context.setting.value),
        rangeCellAtTime: (time: number, project: Project, width: number) => pointCellAtTime(time, project, width, context.setting.value),
        movePointCell: (time: number, direction: -1 | 1, project: Project, width: number) => movePointCell(time, direction, project, width, context.setting.value),
        nextRangeCell: (time: number, project: Project, width: number) => nextRangeCell(time, project, width, context.setting.value),
        generateTempoGrid: (map: readonly TempoSegmentV1[], duration: number, viewport: PersistedTimelineViewport, width?: number) => generateTempoGrid(map, duration, viewport, context.setting.value, width),
        snapEditorTime: (time: number, map: readonly TempoSegmentV1[], viewport: PersistedTimelineViewport, width: number, duration: number) => snapEditorTime(time, map, viewport, width, duration, context.setting.value),
    };
}

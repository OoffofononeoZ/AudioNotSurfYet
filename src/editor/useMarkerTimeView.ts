import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { EditorDraftRepository } from './editorDraftRepository';
import { createMarkerTimeView, DEFAULT_MARKER_SPAN, normalizeMarkerSpan } from './markerTimeView';
import type { PlaybackSnapshot } from '../types/audio';

export function useMarkerTimeView(
    hash: () => string | undefined,
    duration: () => number,
    playback: () => PlaybackSnapshot,
) {
    const repository = new EditorDraftRepository();
    const span = ref(DEFAULT_MARKER_SPAN),
        message = ref('');
    let generation = 0,
        revision = 0;
    const view = computed(() =>
        createMarkerTimeView(
            playback().currentTimeSeconds,
            duration(),
            span.value,
            playback().state === 'playing' || playback().state === 'buffering',
        ),
    );
    watch(
        hash,
        async value => {
            const current = ++generation,
                requestedRevision = revision;
            span.value = DEFAULT_MARKER_SPAN;
            message.value = '';
            if (!value) return;
            try {
                const saved = await repository.getMarkerSpan(value);
                if (current === generation && requestedRevision === revision && saved !== null) span.value = saved;
            } catch {
                if (current === generation) message.value = '无法恢复轨道跨度，请重新缩放。';
            }
        },
        { immediate: true },
    );
    function zoom(delta: number) {
        if (!Number.isFinite(delta) || !delta) return;
        span.value = normalizeMarkerSpan(span.value * (delta > 0 ? 1.12 : 1 / 1.12));
        const contentHash = hash(),
            current = generation,
            request = ++revision;
        if (contentHash)
            void repository.setMarkerSpan(contentHash, span.value).catch(() => {
                if (current === generation && request === revision) message.value = '轨道跨度未保存，当前编辑可继续。';
            });
    }
    onBeforeUnmount(() => {
        generation += 1;
        repository.close();
    });
    return { view, span, message, zoom };
}

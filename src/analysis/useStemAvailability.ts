import { computed, onBeforeUnmount, shallowRef } from 'vue';
import { useEditorSeparationService } from '../processing/editorSeparationService';
import { useAudioSessionStore } from '../stores/audioSessionStore';

export function useStemAvailability() {
    const service = useEditorSeparationService(),
        store = useAudioSessionStore();
    const snapshot = shallowRef(service.getSnapshot());
    const unsubscribe = service.subscribe(value => {
        snapshot.value = value;
    });
    onBeforeUnmount(unsubscribe);
    const available = computed(
        () =>
            snapshot.value.status === 'ready' &&
            snapshot.value.trackId === store.currentTrackId &&
            !!snapshot.value.result &&
            snapshot.value.result.stems.length === 4,
    );
    return { available, snapshot };
}

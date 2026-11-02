import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useAudioSessionService } from '../audio/audioSessionService';
import { MarkerRulerScrubber } from './markerRulerScrubber';

/** DOM lifetime and pointer capture shared by the ruler and the locked waveform. */
export function useMarkerScrubbing(options: {
    active(): boolean;
    trackId(): string | null;
    span(): number;
    changed(dragging: boolean): void;
}) {
    const audio = useAudioSessionService();
    const available = computed(
        () => options.active() && Boolean(options.trackId()) && !audio.playbackPolicy.state.exportLocked,
    );
    const dragging = ref(false);
    const pointer = shallowRef<{ id: number; element: HTMLElement } | null>(null);
    const scrubber = new MarkerRulerScrubber({
        available: () => available.value && options.trackId() === audio.getPlaybackSnapshot().trackId,
        playback: () => audio.getPlaybackSnapshot(),
        seek: seconds => audio.seek(seconds),
        requestFrame: callback => requestAnimationFrame(callback),
        cancelFrame: id => cancelAnimationFrame(id),
        changed(value) {
            dragging.value = value;
            options.changed(value);
        },
    });
    function release() {
        const held = pointer.value;
        pointer.value = null;
        if (held?.element.hasPointerCapture(held.id)) held.element.releasePointerCapture(held.id);
    }
    function down(event: PointerEvent) {
        if (event.button !== 0 || pointer.value) return;
        const element = event.currentTarget as HTMLElement;
        if (!scrubber.begin(event.clientX, options.span(), element.getBoundingClientRect().width)) return;
        event.preventDefault();
        element.focus({ preventScroll: true });
        pointer.value = { id: event.pointerId, element };
        element.setPointerCapture(event.pointerId);
    }
    function move(event: PointerEvent) {
        if (event.pointerId === pointer.value?.id) scrubber.move(event.clientX);
    }
    function up(event: PointerEvent) {
        if (event.button !== 0 || event.pointerId !== pointer.value?.id) return;
        scrubber.end(event.clientX);
        release();
    }
    function cancel() {
        scrubber.cancel();
        release();
    }
    function lostCapture() {
        if (pointer.value) cancel();
    }
    function escape(event: KeyboardEvent) {
        if (event.key === 'Escape' && scrubber.hasGesture) {
            event.preventDefault();
            cancel();
        }
    }
    function visibility() {
        if (document.hidden) cancel();
    }
    watch([options.active, options.trackId, () => audio.playbackPolicy.state.exportLocked], cancel, { flush: 'sync' });
    let unsubscribePlayback = () => {},
        unsubscribeDiscontinuity = () => {};
    onMounted(() => {
        window.addEventListener('blur', cancel);
        window.addEventListener('keydown', escape);
        document.addEventListener('visibilitychange', visibility);
        unsubscribePlayback = audio.subscribePlayback(() => {
            scrubber.reconcile();
            if (!scrubber.hasGesture) release();
        });
        unsubscribeDiscontinuity = audio.subscribePlaybackDiscontinuity(() => {
            scrubber.discontinuity();
            if (!scrubber.hasGesture) release();
        });
    });
    onBeforeUnmount(() => {
        cancel();
        unsubscribePlayback();
        unsubscribeDiscontinuity();
        window.removeEventListener('blur', cancel);
        window.removeEventListener('keydown', escape);
        document.removeEventListener('visibilitychange', visibility);
    });
    return { available, dragging, down, move, up, cancel, lostCapture };
}

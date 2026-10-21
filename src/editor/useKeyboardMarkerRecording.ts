import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import type { AudioSessionService } from '../audio/audioSessionService';
import type { EditorBeatSnapSetting } from './beatSnap';
import {
    KeyboardMarkerRecorder,
    keyboardMarkerTargets,
    keyboardRecordingSignature,
    type KeyboardRangeRecording,
    type KeyboardRecordingHost,
} from './keyboardMarkerRecording';
import type { EditorProjectV2 } from './types';

const blockedSelector =
    'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="spinbutton"],[role="slider"],[role="menu"],dialog[open],[role="dialog"]';

export function keyboardRecordingBlocked(target: EventTarget | null): boolean {
    return (
        (target instanceof Element && Boolean(target.closest(blockedSelector))) ||
        Boolean(document.querySelector('dialog[open],[role="dialog"][aria-modal="true"],[role="menu"]'))
    );
}

export function useKeyboardMarkerRecording(options: {
    host: KeyboardRecordingHost;
    audio: AudioSessionService;
    project(): EditorProjectV2;
    active(): boolean;
    setting(): EditorBeatSnapSetting;
    report(message: string): void;
}) {
    const pending = shallowRef<readonly KeyboardRangeRecording[]>([]);
    const recorder = new KeyboardMarkerRecorder({
        ...options.host,
        active: options.active,
        playback: () => options.audio.getPlaybackSnapshot(),
        setting: options.setting,
        report: options.report,
        changed: value => (pending.value = value),
    });
    const targets = computed(() => keyboardMarkerTargets(options.project()));
    function down(event: KeyboardEvent) {
        if (event.key === 'Escape' && !event.defaultPrevented) {
            recorder.cancel();
            return;
        }
        if (
            event.defaultPrevented ||
            event.isComposing ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            event.shiftKey ||
            keyboardRecordingBlocked(event.target)
        )
            return;
        if (
            /^(Digit|Numpad)[0-9]$/.test(event.code) &&
            /^[0-9]$/.test(event.key) &&
            recorder.down(event.key, event.code, event.repeat)
        )
            event.preventDefault();
    }
    function up(event: KeyboardEvent) {
        if (recorder.up(event.code)) event.preventDefault();
    }
    const blur = () => recorder.cancel(true);
    const visibility = () => {
        if (document.hidden) blur();
    };
    const focus = (event: FocusEvent) => {
        if (keyboardRecordingBlocked(event.target)) recorder.cancel();
    };
    watch(
        () => [
            options.active(),
            keyboardRecordingSignature(
                { trackId: '', project: options.project(), revision: options.host.getContext()?.revision ?? 0 },
                options.setting(),
            ),
        ],
        () => recorder.reconcile(),
        { flush: 'sync' },
    );
    let unsubscribePlayback = () => {},
        unsubscribeDiscontinuity = () => {};
    let observer: MutationObserver | undefined;
    onMounted(() => {
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', blur);
        document.addEventListener('visibilitychange', visibility);
        document.addEventListener('focusin', focus);
        unsubscribePlayback = options.audio.subscribePlayback(value => recorder.playbackChanged(value));
        unsubscribeDiscontinuity = options.audio.subscribePlaybackDiscontinuity(() => recorder.cancel());
        observer = new MutationObserver(() => {
            if (pending.value.length && keyboardRecordingBlocked(document.activeElement)) recorder.cancel();
        });
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['open', 'aria-modal'],
        });
    });
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
        window.removeEventListener('blur', blur);
        document.removeEventListener('visibilitychange', visibility);
        document.removeEventListener('focusin', focus);
        unsubscribePlayback();
        unsubscribeDiscontinuity();
        observer?.disconnect();
        recorder.cancel(true);
    });
    return { pending, targets };
}

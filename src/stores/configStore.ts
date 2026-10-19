import { defineStore } from 'pinia';
import type { PlaybackMode } from '../audio/playbackPolicy';

interface ConfigState {
    volume: number;
    playbackRate: number;
    sidebarCollapsed: boolean;
    playbackMode: PlaybackMode;
    musicBarSettings: {
        style: number;
    };
}

export const useConfigstore = defineStore('config', {
    state: (): ConfigState => ({
        volume: 100,
        playbackRate: 1,
        sidebarCollapsed: false,
        playbackMode: 'sequence',
        musicBarSettings: {
            style: 0,
        },
    }),
    persist: {
        key: 'config',
        storage: localStorage,
    },
});

import { defineStore } from 'pinia';
import type { PlaybackMode } from '../audio/playbackPolicy';

interface ConfigState {
    homeDisplayMode: 'details' | 'visualizer';
    homeStyleId: string | null;
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
        homeDisplayMode: 'details',
        homeStyleId: null,
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

import { defineStore } from "pinia";
import type { PlaybackMode } from '../audio/playbackPolicy';

interface ConfigState {
    volume: number;
    sidebarCollapsed: boolean;
    playbackMode: PlaybackMode;
    musicBarSettings: {
        style: number;
    }
}

export const useConfigstore = defineStore('config', {
    state: (): ConfigState => ({
        volume: 100,
        sidebarCollapsed: false,
        playbackMode: 'sequence',
        musicBarSettings: {
            style: 0,
        }
    }),
    persist: {
        key: 'config',
        storage: localStorage,
    }
})

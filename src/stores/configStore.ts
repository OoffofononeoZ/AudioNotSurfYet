import { defineStore } from "pinia";

interface ConfigState {
    volume: number;
    sidebarCollapsed: boolean;
    musicBarSettings: {
        style: number;
    }
}

export const useConfigstore = defineStore('config', {
    state: (): ConfigState => ({
        volume: 100,
        sidebarCollapsed: false,
        musicBarSettings: {
            style: 0,
        }
    }),
    persist: {
        key: 'config',
        storage: localStorage,
    }
})

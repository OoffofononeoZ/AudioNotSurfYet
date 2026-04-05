import { defineStore } from "pinia";

interface ConfigState {
    volume: number;
    musicBarSettings: {
        style: number;
    }
}

export const useConfigstore = defineStore('config', {
    state: (): ConfigState => ({
        volume: 100,
        musicBarSettings: {
            style: 0,
        }
    }),
    persist: {
        key: 'config',
        storage: localStorage,
    }
})
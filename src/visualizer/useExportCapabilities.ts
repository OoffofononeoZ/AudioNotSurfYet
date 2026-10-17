import { onScopeDispose, shallowRef } from 'vue';
import { getVisualizerExportPreset, probeVisualizerExport } from './exportPresets';
import type { VisualizerExportCapability } from './exportTypes';
import type { VisualizerFrameRate, VisualizerResolution } from './types';

export function useExportCapabilities() {
    const capabilities = shallowRef<Partial<Record<string, VisualizerExportCapability>>>({});
    let disposed = false;
    for (const resolution of ['720p', '1080p'] as const) for (const frameRate of [30, 60] as const) {
        void probeVisualizerExport(getVisualizerExportPreset(resolution, frameRate)).then(value => {
            if (!disposed) capabilities.value = { ...capabilities.value, [`${resolution}-${frameRate}`]: value };
        });
    }
    onScopeDispose(() => { disposed = true; });
    return (resolution: VisualizerResolution, fps: VisualizerFrameRate) => capabilities.value[`${resolution}-${fps}`];
}

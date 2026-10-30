import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { validateResourceSnapshot } from '../../src/visualizer/resourceCodec';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import type { ResourceSnapshot } from '../../src/visualizer/resourceTypes';
import { OUTPUT_SYNC_EVENTS, OUTPUT_SYNC_FLASH_SECONDS } from '../support/visualizer-output-sync';

export { getVisualizerExportPreset } from '../../src/visualizer/exportPresets';

/** Reuse the production authoring functions; no alternative project schema. */
export function createSyncProject(
    base: VisualizerProjectV6,
    resources: ResourceSnapshot,
    options: { events?: readonly number[]; nativeMotion?: boolean } = {},
): VisualizerProjectV6 {
    elementRegistry.replace(validateResourceSnapshot(resources));
    const background = elementRegistry.create('solid', base.track.durationSeconds, 0);
    background.bindings.find(binding => binding.parameterId === 'color')!.source = {
        kind: 'constant',
        value: '#000000',
    };
    const motion = options.nativeMotion ? elementRegistry.create('wireform', base.track.durationSeconds, 1) : null;
    if (motion)
        for (const binding of motion.bindings) {
            if (binding.parameterId === 'spectrum') binding.source = { kind: 'native', featureId: 'frequency' };
            if (binding.parameterId === 'x' || binding.parameterId === 'y')
                binding.source = { kind: 'constant', value: 0.15 };
            if (binding.parameterId === 'size') binding.source = { kind: 'constant', value: 0.03 };
        }
    const flashes = (options.events ?? OUTPUT_SYNC_EVENTS).map((time, index) => {
        const flash = elementRegistry.create('solid', base.track.durationSeconds, index + (motion ? 2 : 1));
        flash.bindings.find(binding => binding.parameterId === 'color')!.source = {
            kind: 'constant',
            value: '#ffffff',
        };
        flash.timing = { kind: 'manual', startSeconds: time, endSeconds: time + OUTPUT_SYNC_FLASH_SECONDS };
        return flash;
    });
    return appendStandaloneElements(base, [background, ...(motion ? [motion] : []), ...flashes]);
}

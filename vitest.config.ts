import { defineConfig } from 'vitest/config';
import { assetsAvailable } from './tests/support/visualizer-assets.mjs';

// Resource-independent suites still run on machines without the external library.
const externalResourceSuites = [
    'tests/analysis/wallpaper-spectrum.test.ts',
    ...[
        'algorithm-parity',
        'analysis-input',
        'composition-model',
        'composition-presets',
        'composition-rendering',
        'composition-session',
        'geometric-elements',
        'number-editing',
        'native-input',
        'radial-spectrum',
        'resources-v5',
    ].map(name => `tests/visualizer/${name}.test.ts`),
];
if (!assetsAvailable)
    console.warn('External Visualizer resource suites excluded: configure VISUALIZER_ASSETS_DIR to run them.');

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['tests/setup-visualizer-resources.ts'],
        include: ['tests/**/*.test.ts'],
        exclude: ['tests/harness/intentional-failure.test.ts', ...(!assetsAvailable ? externalResourceSuites : [])],
        testTimeout: 10_000,
    },
});

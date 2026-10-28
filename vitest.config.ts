import { defineConfig } from 'vitest/config';
import { assetsAvailable } from './tests/support/visualizer-assets.mjs';

// Resource-independent suites still run on machines without the external library.
const externalResourceSuites = [
    'tests/analysis/wallpaper-spectrum.test.ts',
    ...[
        'algorithm-parity',
        'algorithm-editing',
        'analysis-input',
        'composition-model',
        'composition-presets',
        'composition-rendering',
        'composition-session',
        'circular-particles',
        'lyric-motion',
        'geometric-elements',
        'number-editing',
        'point-lines',
        'native-input',
        'preset-export',
        'radial-spectrum',
        'resources-v5',
        'seed-capabilities',
        'seed-migration',
    ].map(name => `tests/visualizer/${name}.test.ts`),
];
if (!assetsAvailable)
    console.warn('External Visualizer resource suites excluded: configure VISUALIZER_ASSETS_DIR to run them.');

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['tests/setup-visualizer-resources.ts', 'tests/setup-analysis-scheduler.ts'],
        include: ['tests/**/*.test.ts'],
        exclude: ['tests/harness/intentional-failure.test.ts', ...(!assetsAvailable ? externalResourceSuites : [])],
        testTimeout: 10_000,
    },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        exclude: ['tests/harness/intentional-failure.test.ts'],
        testTimeout: 10_000,
    },
});

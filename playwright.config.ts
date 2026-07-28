import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    outputDir: 'test-results',
    fullyParallel: false,
    retries: 0,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
        timeout: 120_000,
    },
    projects: [
        {
            name: 'chrome',
            use: {
                ...devices['Desktop Chrome'],
                channel: 'chrome',
            },
        },
        {
            name: 'edge',
            use: {
                ...devices['Desktop Edge'],
                channel: 'msedge',
            },
        },
    ],
});

import { defineConfig, devices } from '@playwright/test';

const serverPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const serverUrl = `http://127.0.0.1:${serverPort}`;

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
        baseURL: serverUrl,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${serverPort}`,
        url: serverUrl,
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

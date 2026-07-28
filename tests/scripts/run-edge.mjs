import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const edgePaths = {
    darwin: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    win32: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
};
const edgePath = edgePaths[process.platform];

if (!edgePath || !existsSync(edgePath)) {
    console.error('BLOCKED: Microsoft Edge is not installed; Edge evidence remains open.');
    process.exit(2);
}

const result = spawnSync(
    process.execPath,
    ['./node_modules/@playwright/test/cli.js', 'test', '--project=edge'],
    {
        cwd: process.cwd(),
        stdio: 'inherit',
    },
);
process.exit(result.status ?? 1);

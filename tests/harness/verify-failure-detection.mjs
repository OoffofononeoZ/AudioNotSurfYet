import { spawnSync } from 'node:child_process';

const result = spawnSync(
    process.execPath,
    ['./node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.failure.config.ts'],
    {
        cwd: process.cwd(),
        encoding: 'utf8',
    },
);

if (result.status === 0) {
    console.error('Harness verification failed: intentional failure exited with code 0.');
    process.exit(1);
}

if (!`${result.stdout}\n${result.stderr}`.includes('intentional failure proves the gate is fail-closed')) {
    console.error('Harness verification failed: expected intentional test was not executed.');
    process.exit(1);
}

console.log(`Harness correctly detected the deliberate failure (child exit ${result.status}).`);

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const provisional = process.argv.includes('--provisional');
const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const run = (command, args) => spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
});
const commandOutput = (command, args) => {
    const result = run(command, args);
    if (result.status === 0) return result.stdout.trim();
    if (result.status === null && result.error?.code === 'ENOENT') return 'not-installed';
    return `unavailable (${result.status})`;
};
const sanitizedHardware = () => commandOutput(
    'system_profiler',
    ['SPHardwareDataType'],
).split('\n').map((line) => line.trim()).filter((line) => [
    'Model Name:',
    'Model Identifier:',
    'Chip:',
    'Total Number of Cores:',
    'Memory:',
].some((prefix) => line.startsWith(prefix))).join('\n');

const initialStatus = commandOutput('git', ['status', '--porcelain']);
if (!provisional && initialStatus !== '') {
    console.error('Canonical V2 eval requires a clean committed worktree.');
    process.exit(2);
}

const commit = commandOutput('git', ['rev-parse', 'HEAD']);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `V2-${timestamp}-${commit.slice(0, 8)}`
    + (provisional ? '-provisional' : '');
const artifactDirectory = path.join(repositoryRoot, 'artifacts/evals', runId);
await mkdir(artifactDirectory, { recursive: true });

const steps = [
    ['V2 golden', 'npm', ['run', 'fixtures:v2:golden']],
    ['V2 binding unit', 'npm', ['run', 'test:v2:unit']],
    ['V2 binding integration', 'npm', ['run', 'test:v2:integration']],
    ['V2 Chrome', 'npm', ['run', 'test:e2e:v2:chrome']],
    ['V2 Edge', 'npm', ['run', 'test:e2e:v2:edge']],
    ['V1 golden', 'npm', ['run', 'fixtures:v1:golden']],
    ['V1 project unit', 'npm', ['run', 'test:v1:unit']],
    ['V1 foundation integration', 'npm', ['run', 'test:v1:integration']],
    ['V1 Chrome', 'npm', ['run', 'test:e2e:v1:chrome']],
    ['V1 Edge', 'npm', ['run', 'test:e2e:v1:edge']],
    ['M3 Chrome smoke', 'npm', ['run', 'test:e2e:m3']],
    ['M4 engine and session regression', 'npm', ['exec', '--', 'vitest', 'run', 'tests/audio/audio-engine.test.ts', 'tests/audio/audio-session-service.test.ts']],
    ['M4 Chrome regression', 'npm', ['run', 'test:e2e:m4']],
    ['M5 repository and recovery regression', 'npm', ['exec', '--', 'vitest', 'run', 'tests/persistence/session-repository.test.ts', 'tests/audio/audio-session-recovery.test.ts']],
    ['Editor E1 project unit', 'npm', ['run', 'test:e1:unit']],
    ['Editor E1 integration', 'npm', ['run', 'test:e1:integration']],
    ['Editor E1 Chrome', 'npm', ['run', 'test:e2e:e1']],
    ['Editor E7 unit', 'npm', ['run', 'test:e7:unit']],
    ['Editor E7 integration', 'npm', ['run', 'test:e7:integration']],
    ['M11 Chrome resource regression', 'npm', ['run', 'test:e2e:m11:chrome']],
    ['M11 Edge resource regression', 'npm', ['run', 'test:e2e:m11:edge']],
    ['docs', 'npm', ['run', 'test:docs']],
    ['deliberate failure', 'npm', ['run', 'test:harness']],
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['build', 'npm', ['run', 'build']],
    ['diff check', 'git', ['diff', '--check']],
];

if (steps.length !== 26) {
    throw new Error(`V2 canonical must have 26 steps, got ${steps.length}.`);
}

const results = [];
const browserMetrics = [];
for (const [name, command, args] of steps) {
    console.log(`\n[${name}] ${command} ${args.join(' ')}`);
    const result = run(command, args);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    process.stdout.write(output);
    for (const line of output.split('\n')) {
        const candidate = line.trim();
        if (!candidate.startsWith('{"metric":"')) continue;
        try {
            browserMetrics.push(JSON.parse(candidate));
        } catch {
            // Step log remains authoritative when reporter decoration is present.
        }
    }
    const fileName = `${String(results.length + 1).padStart(2, '0')}-`
        + `${name.replaceAll(' ', '-')}.log`;
    const logPath = path.join(artifactDirectory, fileName);
    await writeFile(logPath, output, 'utf8');
    results.push({
        name,
        command: [command, ...args].join(' '),
        status: result.status,
        log: path.relative(repositoryRoot, logPath),
    });
}

const chromeExecutable = process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgeExecutable = process.platform === 'darwin'
    ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const environment = {
    runId,
    provisional,
    commit,
    dirtyAtStart: initialStatus !== '',
    platform: process.platform,
    architecture: process.arch,
    os: commandOutput('sw_vers', []),
    hardware: sanitizedHardware(),
    node: process.version,
    npm: commandOutput('npm', ['--version']),
    chrome: commandOutput(chromeExecutable, ['--version']),
    edge: commandOutput(edgeExecutable, ['--version']),
    meyda: JSON.parse(await readFile(
        path.join(repositoryRoot, 'node_modules/meyda/package.json'),
        'utf8',
    )).version,
    vitest: commandOutput('npm', ['exec', '--', 'vitest', '--version']),
    playwright: commandOutput('npm', ['exec', '--', 'playwright', '--version']),
};
const finalStatus = commandOutput('git', ['status', '--porcelain']);
const finalCommit = commandOutput('git', ['rev-parse', 'HEAD']);
const stepsPassed = results.every((result) => result.status === 0);
const repositoryIdentityPassed = finalCommit === commit
    && (provisional || finalStatus === '');
const summary = {
    ...environment,
    commitAtEnd: finalCommit,
    dirtyAtEnd: finalStatus !== '',
    result: stepsPassed && repositoryIdentityPassed ? 'pass' : 'fail',
    browserMetrics,
    steps: results,
};
const summaryPath = path.join(artifactDirectory, 'summary.json');
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
const summaryHash = createHash('sha256')
    .update(await readFile(summaryPath))
    .digest('hex');
await writeFile(
    `${summaryPath}.sha256`,
    `${summaryHash}  summary.json\n`,
    'utf8',
);

console.log(`\nV2 ${provisional ? 'provisional' : 'canonical'} result: ${summary.result}`);
console.log(`Artifacts: ${path.relative(repositoryRoot, artifactDirectory)}`);
console.log(`Summary SHA-256: ${summaryHash}`);
process.exit(summary.result === 'pass' ? 0 : 1);

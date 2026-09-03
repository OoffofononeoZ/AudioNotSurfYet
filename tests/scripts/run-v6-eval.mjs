import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const provisional = process.argv.includes('--provisional');
const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const commandOutput = (command, args) => {
    const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim();
    if (result.status === null && result.error?.code === 'ENOENT') return 'not-installed';
    return `unavailable (${result.status})`;
};
const sanitizedHardware = () => commandOutput('system_profiler', ['SPHardwareDataType'])
    .split('\n').map((line) => line.trim()).filter((line) => [
        'Model Name:', 'Model Identifier:', 'Chip:', 'Total Number of Cores:', 'Memory:',
    ].some((prefix) => line.startsWith(prefix))).join('\n');

const initialStatus = commandOutput('git', ['status', '--porcelain']);
if (!provisional && initialStatus !== '') {
    console.error('Canonical V6 eval requires a clean committed worktree.');
    process.exit(2);
}
const commit = commandOutput('git', ['rev-parse', 'HEAD']);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `V6-${timestamp}-${commit.slice(0, 8)}${provisional ? '-provisional' : ''}`;
const artifactDirectory = path.join(repositoryRoot, 'artifacts/evals', runId);
const mediaDirectory = path.join(artifactDirectory, 'media');
const v5MediaDirectory = path.join(mediaDirectory, 'v5-baseline');
await mkdir(mediaDirectory, { recursive: true });

const run = (command, args, environment = {}) => spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
        ...process.env,
        VISUALIZER_V6_ARTIFACT_DIR: mediaDirectory,
        VISUALIZER_V5_ARTIFACT_DIR: v5MediaDirectory,
        ...environment,
    },
});

const v6Steps = [
    ['V6 golden', 'npm', ['run', 'fixtures:v6:golden']],
    ['V6 unit', 'npm', ['run', 'test:v6:unit']],
    ['V6 integration', 'npm', ['run', 'test:v6:integration']],
    ['V6 Chrome', 'npm', ['run', 'test:e2e:v6:chrome']],
    ['V6 Edge', 'npm', ['run', 'test:e2e:v6:edge']],
    ['V6 media', 'npm', ['run', 'test:v6:media']],
];
const v5BaselineSteps = [
    ['V5 golden', 'npm', ['run', 'fixtures:v5:golden']],
    ['V5 recording unit', 'npm', ['run', 'test:v5:unit']],
    ['V5 recording integration', 'npm', ['run', 'test:v5:integration']],
    ['V5 Chrome', 'npm', ['run', 'test:e2e:v5:chrome']],
    ['V5 Edge', 'npm', ['run', 'test:e2e:v5:edge']],
    ['V5 media verification', 'npm', ['run', 'test:v5:media']],
    ['V4 golden', 'npm', ['run', 'fixtures:v4:golden']],
    ['V4 scene unit', 'npm', ['run', 'test:v4:unit']],
    ['V4 renderer integration', 'npm', ['run', 'test:v4:integration']],
    ['V4 Chrome', 'npm', ['run', 'test:e2e:v4']],
    ['V3 golden', 'npm', ['run', 'fixtures:v3:golden']],
    ['V3 scene unit', 'npm', ['run', 'test:v3:unit']],
    ['V3 renderer integration', 'npm', ['run', 'test:v3:integration']],
    ['V3 Chrome', 'npm', ['run', 'test:e2e:v3']],
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
const explicitRegressions = [
    ['M6 unit explicit regression', 'npm', ['run', 'test:m6:unit']],
    ['M6 worker explicit regression', 'npm', ['run', 'test:m6:worker']],
    ['M6 integration explicit regression', 'npm', ['run', 'test:m6:integration']],
    ['M6 Chrome explicit regression', 'npm', ['run', 'test:e2e:m6']],
    ['M14 unit explicit regression', 'npm', ['run', 'test:m14:unit']],
    ['M14 integration explicit regression', 'npm', ['run', 'test:m14:integration']],
    ['M14 Chrome explicit regression', 'npm', ['run', 'test:e2e:m14:chrome']],
    ['M14 Edge explicit regression', 'npm', ['run', 'test:e2e:m14:edge']],
];
const steps = [...v6Steps, ...v5BaselineSteps, ...explicitRegressions];
if (
    v6Steps.length !== 6
    || v5BaselineSteps.length !== 40
    || explicitRegressions.length !== 8
    || steps.length !== 54
) throw new Error(`V6 canonical must contain exactly 54 steps; got ${steps.length}.`);

const results = [];
const browserMetrics = [];
let e2ePortOffset = 0;
for (const [name, command, args] of steps) {
    console.log(`\n[${name}] ${command} ${args.join(' ')}`);
    const isE2eStep = args.some((argument) => argument.includes('test:e2e'));
    const environment = isE2eStep
        ? { PLAYWRIGHT_PORT: String(4500 + e2ePortOffset++) }
        : {};
    const result = run(command, args, environment);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    process.stdout.write(output);
    for (const line of output.split('\n')) {
        const candidate = line.trim();
        if (!candidate.startsWith('{"metric":"')) continue;
        try {
            browserMetrics.push(JSON.parse(candidate));
        } catch {
            // The complete decorated output remains in the step log.
        }
    }
    const fileName = `${String(results.length + 1).padStart(2, '0')}-${name.replaceAll(' ', '-')}.log`;
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
let mediaEvidence = null;
try {
    mediaEvidence = JSON.parse(await readFile(
        path.join(mediaDirectory, 'v6-media-report.json'),
        'utf8',
    ));
} catch {
    // A failed media step remains auditable through its log.
}
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
    ffmpeg: commandOutput('ffmpeg', ['-version']).split('\n')[0],
    ffprobe: commandOutput('ffprobe', ['-version']).split('\n')[0],
    three: JSON.parse(await readFile(
        path.join(repositoryRoot, 'node_modules/three/package.json'),
        'utf8',
    )).version,
    vitest: commandOutput('npm', ['exec', '--', 'vitest', '--version']),
    playwright: commandOutput('npm', ['exec', '--', 'playwright', '--version']),
};
const finalStatus = commandOutput('git', ['status', '--porcelain']);
const finalCommit = commandOutput('git', ['rev-parse', 'HEAD']);
const stepsPassed = results.every((result) => result.status === 0);
const repositoryIdentityPassed = finalCommit === commit && (provisional || finalStatus === '');
const summary = {
    ...environment,
    commitAtEnd: finalCommit,
    dirtyAtEnd: finalStatus !== '',
    result: stepsPassed && repositoryIdentityPassed ? 'pass' : 'fail',
    browserMetrics,
    mediaEvidence,
    stepCount: results.length,
    steps: results,
};
const summaryPath = path.join(artifactDirectory, 'summary.json');
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
const summaryHash = createHash('sha256').update(await readFile(summaryPath)).digest('hex');
await writeFile(`${summaryPath}.sha256`, `${summaryHash}  summary.json\n`, 'utf8');
console.log(`\nV6 ${provisional ? 'provisional' : 'canonical'} result: ${summary.result}`);
console.log(`Artifacts: ${path.relative(repositoryRoot, artifactDirectory)}`);
console.log(`Summary SHA-256: ${summaryHash}`);
process.exit(summary.result === 'pass' ? 0 : 1);

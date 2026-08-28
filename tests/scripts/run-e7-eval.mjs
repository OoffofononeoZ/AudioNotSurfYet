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
    console.error('Canonical E7 eval requires a clean committed worktree.');
    process.exit(2);
}

const commit = commandOutput('git', ['rev-parse', 'HEAD']);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `E7-${timestamp}-${commit.slice(0, 8)}`
    + (provisional ? '-provisional' : '');
const artifactDirectory = path.join(repositoryRoot, 'artifacts/evals', runId);
await mkdir(artifactDirectory, { recursive: true });

const steps = [
    ['E7 Chrome compact workbench', 'npm', ['run', 'test:e2e:e7:chrome']],
    ['E7 Edge compact workbench', 'npm', ['run', 'test:e2e:e7:edge']],
    ['M12 masonry unit regression', 'npm', ['run', 'test:m12:unit']],
    ['M12 dual-browser regression', 'npm', ['run', 'test:e2e:m12']],
    ['E6 hardening unit', 'npm', ['run', 'test:e6:unit']],
    ['E6 hardening integration', 'npm', ['run', 'test:e6:integration']],
    ['E6 Chrome', 'npm', ['run', 'test:e2e:e6:chrome']],
    ['E6 Edge', 'npm', ['run', 'test:e2e:e6:edge']],
    ['M3-M11 Edge critical regression', 'npm', ['run', 'test:e2e:m11:edge']],
    ['E5 range golden', 'npm', ['run', 'fixtures:e5:golden']],
    ['E5 range unit', 'npm', ['run', 'test:e5:unit']],
    ['E5 range integration', 'npm', ['run', 'test:e5:integration']],
    ['E5 Chrome regression', 'npm', ['run', 'test:e2e:e5']],
    ['E4 overlay golden regression', 'npm', ['run', 'fixtures:e4:golden']],
    ['E4 overlay unit regression', 'npm', ['run', 'test:e4:unit']],
    ['E4 overlay integration regression', 'npm', ['run', 'test:e4:integration']],
    ['E3 point golden regression', 'npm', ['run', 'fixtures:e3:golden']],
    ['E3 point unit regression', 'npm', ['run', 'test:e3:unit']],
    ['E3 point integration regression', 'npm', ['run', 'test:e3:integration']],
    ['E2 tempo golden regression', 'npm', ['run', 'fixtures:e2:golden']],
    ['E2 timeline unit regression', 'npm', ['run', 'test:e2:unit']],
    ['E2 timeline integration regression', 'npm', ['run', 'test:e2:integration']],
    ['E1 project unit regression', 'npm', ['run', 'test:e1:unit']],
    ['E1 foundation integration regression', 'npm', ['run', 'test:e1:integration']],
    ['M6 Worker regression', 'npm', ['run', 'test:m6:worker']],
    ['M6 coordinator regression', 'npm', ['run', 'test:m6:integration']],
    ['M7 renderer unit regression', 'npm', ['run', 'test:m7:unit']],
    ['M8 renderer unit regression', 'npm', ['run', 'test:m8:unit']],
    ['M9 renderer unit regression', 'npm', ['run', 'test:m9:unit']],
    ['M10 renderer unit regression', 'npm', ['run', 'test:m10:unit']],
    ['docs', 'npm', ['run', 'test:docs']],
    ['deliberate failure', 'npm', ['run', 'test:harness']],
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['E4 Chrome regression', 'npm', ['run', 'test:e2e:e4']],
    ['E3 Chrome regression', 'npm', ['run', 'test:e2e:e3']],
    ['E2 Chrome regression', 'npm', ['run', 'test:e2e:e2']],
    ['E1 Chrome regression', 'npm', ['run', 'test:e2e:e1']],
    ['M7 Chrome renderer regression', 'npm', ['run', 'test:e2e:m7']],
    ['M8 Chrome renderer regression', 'npm', ['run', 'test:e2e:m8']],
    ['M9 Chrome renderer regression', 'npm', ['run', 'test:e2e:m9']],
    ['M10 Chrome renderer regression', 'npm', ['run', 'test:e2e:m10']],
    ['M11 Chrome resource regression', 'npm', ['run', 'test:e2e:m11:chrome']],
    ['build', 'npm', ['run', 'build']],
    ['diff check', 'git', ['diff', '--check']],
];

if (steps.length !== 44) throw new Error(`E7 canonical must have 44 steps, got ${steps.length}.`);

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
            // Raw step logs remain authoritative if reporter output decorates JSON.
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

console.log(`\nE7 ${provisional ? 'provisional' : 'canonical'} result: ${summary.result}`);
console.log(`Artifacts: ${path.relative(repositoryRoot, artifactDirectory)}`);
console.log(`Summary SHA-256: ${summaryHash}`);
process.exit(summary.result === 'pass' ? 0 : 1);

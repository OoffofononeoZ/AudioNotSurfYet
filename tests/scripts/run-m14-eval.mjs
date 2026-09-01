import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
    mkdir,
    readFile,
    writeFile,
} from 'node:fs/promises';
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
    if (result.status === null && result.error?.code === 'ENOENT') {
        return 'not-installed';
    }
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
    console.error('Canonical M14 eval requires a clean committed worktree.');
    process.exit(2);
}

const commit = commandOutput('git', ['rev-parse', 'HEAD']);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `M14-${timestamp}-${commit.slice(0, 8)}`
    + (provisional ? '-provisional' : '');
const artifactDirectory = path.join(repositoryRoot, 'artifacts/evals', runId);
await mkdir(artifactDirectory, { recursive: true });

const steps = [
    ['M14 order and regression unit', 'npm', ['run', 'test:m14:unit']],
    ['M14 workspace and persistence integration', 'npm', ['run', 'test:m14:integration']],
    ['docs', 'npm', ['run', 'test:docs']],
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['M7 Analyzer Chrome regression', 'npm', ['run', 'test:e2e:m7']],
    ['M8 Analyzer Chrome regression', 'npm', ['run', 'test:e2e:m8']],
    ['M9 Analyzer Chrome regression', 'npm', ['run', 'test:e2e:m9']],
    ['M10 Analyzer Chrome regression', 'npm', ['run', 'test:e2e:m10']],
    ['M11 Chrome hardening regression', 'npm', ['run', 'test:e2e:m11:chrome']],
    ['M12 Chrome masonry regression', 'npm', ['run', 'test:e2e:m12:chrome']],
    ['M12 Edge masonry regression', 'npm', ['run', 'test:e2e:m12:edge']],
    ['M13 Chrome FIFO regression', 'npm', ['run', 'test:e2e:m13:chrome']],
    ['M13 Edge FIFO regression', 'npm', ['run', 'test:e2e:m13:edge']],
    ['M14 Chrome reordering', 'npm', ['run', 'test:e2e:m14:chrome']],
    ['M14 Edge reordering', 'npm', ['run', 'test:e2e:m14:edge']],
    ['E7 lease/renderer unit regression', 'npm', ['run', 'test:e7:unit']],
    ['E7 lease/renderer integration regression', 'npm', ['run', 'test:e7:integration']],
    ['build', 'npm', ['run', 'build']],
    ['diff check', 'git', ['diff', '--check']],
];

if (steps.length !== 19) {
    throw new Error(`M14 canonical must have 19 steps, got ${steps.length}.`);
}

const results = [];
const browserMetrics = [];
for (const [name, command, args] of steps) {
    console.log(`\n[${name}] ${command} ${args.join(' ')}`);
    const result = run(command, args);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    process.stdout.write(output);
    if (name.includes('Chrome') || name.includes('Edge')) {
        for (const line of output.split('\n')) {
            const candidate = line.trim();
            if (!candidate.startsWith('{"metric":"')) continue;
            try {
                browserMetrics.push(JSON.parse(candidate));
            } catch {
                // Raw logs remain authoritative if reporter output is decorated.
            }
        }
    }
    const stepSlug = name
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const fileName = `${String(results.length + 1).padStart(2, '0')}-`
        + `${stepSlug}.log`;
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
const finalStatus = commandOutput('git', ['status', '--porcelain']);
const finalCommit = commandOutput('git', ['rev-parse', 'HEAD']);
const stepsPassed = results.every((result) => result.status === 0);
const repositoryIdentityPassed = finalCommit === commit
    && (provisional || finalStatus === '');
const summary = {
    runId,
    provisional,
    commit,
    commitAtEnd: finalCommit,
    dirtyAtStart: initialStatus !== '',
    dirtyAtEnd: finalStatus !== '',
    platform: process.platform,
    architecture: process.arch,
    os: commandOutput('sw_vers', []),
    hardware: sanitizedHardware(),
    node: process.version,
    npm: commandOutput('npm', ['--version']),
    chrome: commandOutput(chromeExecutable, ['--version']),
    edge: commandOutput(edgeExecutable, ['--version']),
    playwright: commandOutput('npm', ['exec', '--', 'playwright', '--version']),
    result: stepsPassed && repositoryIdentityPassed ? 'pass' : 'fail',
    browserMetrics,
    results,
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

console.log(
    `\nM14 ${provisional ? 'provisional' : 'canonical'}`
    + ` result: ${summary.result}`,
);
console.log(`Artifacts: ${path.relative(repositoryRoot, artifactDirectory)}`);
console.log(`Summary SHA-256: ${summaryHash}`);
process.exit(summary.result === 'pass' ? 0 : 1);

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

const initialStatus = commandOutput('git', ['status', '--porcelain']);
if (!provisional && initialStatus !== '') {
    console.error('Canonical M10 eval requires a clean committed worktree.');
    process.exit(2);
}

const commit = commandOutput('git', ['rev-parse', 'HEAD']);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `M10-${timestamp}-${commit.slice(0, 8)}`
    + (provisional ? '-provisional' : '');
const artifactDirectory = path.join(repositoryRoot, 'artifacts/evals', runId);
await mkdir(artifactDirectory, { recursive: true });

const steps = [
    ['fixture hashes', 'npm', ['run', 'test:fixtures']],
    ['M3 unit regression', 'npm', ['run', 'test:unit']],
    ['M3 worker regression', 'npm', ['run', 'test:worker']],
    ['M3 analysis regression', 'npm', ['run', 'test:analysis']],
    ['M4 AudioEngine unit', 'npm', ['run', 'test:m4:unit']],
    ['M4 session integration', 'npm', ['run', 'test:m4:integration']],
    ['M5 repository unit', 'npm', ['run', 'test:m5:unit']],
    ['M5 recovery integration', 'npm', ['run', 'test:m5:integration']],
    ['M6 platform unit', 'npm', ['run', 'test:m6:unit']],
    ['M6 Worker and golden', 'npm', ['run', 'test:m6:worker']],
    ['M6 coordinator integration', 'npm', ['run', 'test:m6:integration']],
    ['M7 workspace and learning unit', 'npm', ['run', 'test:m7:unit']],
    ['M7 workspace integration', 'npm', ['run', 'test:m7:integration']],
    ['M7 golden identity', 'npm', ['run', 'fixtures:m7:golden']],
    ['M8 scalar unit and golden', 'npm', ['run', 'test:m8:unit']],
    ['M8 Worker and workspace integration', 'npm', ['run', 'test:m8:integration']],
    ['M8 golden identity', 'npm', ['run', 'fixtures:m8:golden']],
    ['M9 vector and waveform unit', 'npm', ['run', 'test:m9:unit']],
    ['M9 Worker and workspace integration', 'npm', ['run', 'test:m9:integration']],
    ['M9 golden identity', 'npm', ['run', 'fixtures:m9:golden']],
    ['M10 structure unit and golden', 'npm', ['run', 'test:m10:unit']],
    ['M10 Worker and workspace integration', 'npm', ['run', 'test:m10:integration']],
    ['M10 golden identity', 'npm', ['run', 'fixtures:m10:golden']],
    ['docs', 'npm', ['run', 'test:docs']],
    ['deliberate failure', 'npm', ['run', 'test:harness']],
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['M3 Chrome regression', 'npm', ['run', 'test:e2e:m3']],
    ['M4 Chrome regression', 'npm', ['run', 'test:e2e:m4']],
    ['M5 Chrome regression', 'npm', ['run', 'test:e2e:m5']],
    ['M6 Chrome regression', 'npm', ['run', 'test:e2e:m6']],
    ['M7 Chrome regression', 'npm', ['run', 'test:e2e:m7']],
    ['M8 Chrome regression', 'npm', ['run', 'test:e2e:m8']],
    ['M9 Chrome regression', 'npm', ['run', 'test:e2e:m9']],
    ['M10 Chrome e2e', 'npm', ['run', 'test:e2e:m10']],
    ['build', 'npm', ['run', 'build']],
    ['diff check', 'git', ['diff', '--check']],
];

const results = [];
const browserMetrics = [];
for (const [name, command, args] of steps) {
    console.log(`\n[${name}] ${command} ${args.join(' ')}`);
    const result = run(command, args);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    process.stdout.write(output);
    if (name.includes('Chrome')) {
        for (const line of output.split('\n')) {
            const candidate = line.trim();
            if (!candidate.startsWith('{"metric":"m')) continue;
            try {
                browserMetrics.push(JSON.parse(candidate));
            } catch {
                // Raw logs remain authoritative if a reporter decorates output.
            }
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

const environment = {
    runId,
    provisional,
    commit,
    dirtyAtStart: initialStatus !== '',
    platform: process.platform,
    architecture: process.arch,
    os: commandOutput('sw_vers', []),
    hardware: commandOutput('system_profiler', ['SPHardwareDataType']),
    node: process.version,
    npm: commandOutput('npm', ['--version']),
    chrome: commandOutput(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ['--version'],
    ),
    edge: commandOutput(
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ['--version'],
    ),
    ffmpeg: commandOutput('ffmpeg', ['-version']).split('\n')[0],
    meyda: JSON.parse(
        await readFile(
            path.join(repositoryRoot, 'node_modules/meyda/package.json'),
            'utf8',
        ),
    ).version,
    vitest: commandOutput('npm', ['exec', '--', 'vitest', '--version']),
    playwright: commandOutput(
        'npm',
        ['exec', '--', 'playwright', '--version'],
    ),
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

console.log(
    `\nM10 ${provisional ? 'provisional' : 'canonical'}`
    + ` result: ${summary.result}`,
);
console.log(`Artifacts: ${path.relative(repositoryRoot, artifactDirectory)}`);
console.log(`Summary SHA-256: ${summaryHash}`);
process.exit(summary.result === 'pass' ? 0 : 1);

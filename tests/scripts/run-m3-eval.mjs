import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const provisional = process.argv.includes('--provisional');
const repositoryRoot = path.resolve(import.meta.dirname, '../..');

function run(command, args) {
    return spawnSync(command, args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
    });
}

function commandOutput(command, args) {
    const result = run(command, args);
    if (result.status === 0) {
        return result.stdout.trim();
    }
    if (result.status === null && result.error?.code === 'ENOENT') {
        return 'not-installed';
    }
    return `unavailable (${result.status})`;
}

const initialStatus = commandOutput('git', ['status', '--porcelain']);
if (!provisional && initialStatus !== '') {
    console.error('Canonical M3 eval requires a clean committed worktree.');
    process.exit(2);
}

const commit = commandOutput('git', ['rev-parse', 'HEAD']);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `M3-${timestamp}-${commit.slice(0, 8)}${provisional ? '-provisional' : ''}`;
const artifactDirectory = path.join(repositoryRoot, 'artifacts/evals', runId);
await mkdir(artifactDirectory, { recursive: true });

const steps = [
    ['fixture hashes', 'npm', ['run', 'test:fixtures']],
    ['unit', 'npm', ['run', 'test:unit']],
    ['worker', 'npm', ['run', 'test:worker']],
    ['analysis', 'npm', ['run', 'test:analysis']],
    ['docs', 'npm', ['run', 'test:docs']],
    ['deliberate failure', 'npm', ['run', 'test:harness']],
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['chrome e2e', 'npm', ['run', 'test:e2e:m3']],
    ['build', 'npm', ['run', 'build']],
    ['diff check', 'git', ['diff', '--check']],
];

const results = [];
for (const [name, command, args] of steps) {
    console.log(`\n[${name}] ${command} ${args.join(' ')}`);
    const result = run(command, args);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    process.stdout.write(output);
    const logPath = path.join(artifactDirectory, `${String(results.length + 1).padStart(2, '0')}-${name.replaceAll(' ', '-')}.log`);
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
        await readFile(path.join(repositoryRoot, 'node_modules/meyda/package.json'), 'utf8'),
    ).version,
    vitest: commandOutput('npm', ['exec', '--', 'vitest', '--version']),
    playwright: commandOutput('npm', ['exec', '--', 'playwright', '--version']),
};
const summary = {
    ...environment,
    result: results.every((result) => result.status === 0) ? 'pass' : 'fail',
    steps: results,
};
const summaryPath = path.join(artifactDirectory, 'summary.json');
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
const summaryHash = createHash('sha256').update(await readFile(summaryPath)).digest('hex');
await writeFile(`${summaryPath}.sha256`, `${summaryHash}  summary.json\n`, 'utf8');

console.log(`\nM3 ${provisional ? 'provisional' : 'canonical'} result: ${summary.result}`);
console.log(`Artifacts: ${path.relative(repositoryRoot, artifactDirectory)}`);
console.log(`Summary SHA-256: ${summaryHash}`);
process.exit(summary.result === 'pass' ? 0 : 1);

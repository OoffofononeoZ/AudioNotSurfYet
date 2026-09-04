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

const initialStatus = commandOutput('git', ['status', '--porcelain']);
if (!provisional && initialStatus !== '') {
    console.error('Canonical E10 eval requires a clean committed worktree.');
    process.exit(2);
}

const commit = commandOutput('git', ['rev-parse', 'HEAD']);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runId = `E10-${timestamp}-${commit.slice(0, 8)}`
    + (provisional ? '-provisional' : '');
const artifactDirectory = path.join(repositoryRoot, 'artifacts/evals', runId);
await mkdir(artifactDirectory, { recursive: true });

const steps = [
    ['E8 usability unit baseline', 'npm', ['run', 'test:e8:unit']],
    ['E8 recovery integration baseline', 'npm', ['run', 'test:e8:integration']],
    ['E8 Chrome usability baseline', 'npm', ['run', 'test:e2e:e8:chrome']],
    ['E8 Edge usability baseline', 'npm', ['run', 'test:e2e:e8:edge']],
    ['E7 overlay unit regression', 'npm', ['run', 'test:e7:unit']],
    ['E7 overlay integration regression', 'npm', ['run', 'test:e7:integration']],
    ['E7 Chrome workbench regression', 'npm', ['run', 'test:e2e:e7:chrome']],
    ['E7 Edge workbench regression', 'npm', ['run', 'test:e2e:e7:edge']],
    ['E3 point golden regression', 'npm', ['run', 'fixtures:e3:golden']],
    ['E3 point unit regression', 'npm', ['run', 'test:e3:unit']],
    ['E3 point integration regression', 'npm', ['run', 'test:e3:integration']],
    ['E3 Chrome point regression', 'npm', ['run', 'test:e2e:e3']],
    ['E2 tempo golden regression', 'npm', ['run', 'fixtures:e2:golden']],
    ['E2 timeline unit regression', 'npm', ['run', 'test:e2:unit']],
    ['E2 timeline integration regression', 'npm', ['run', 'test:e2:integration']],
    ['E2 Chrome timeline regression', 'npm', ['run', 'test:e2e:e2']],
    ['E1 project unit regression', 'npm', ['run', 'test:e1:unit']],
    ['E1 foundation integration regression', 'npm', ['run', 'test:e1:integration']],
    ['E1 Chrome route regression', 'npm', ['run', 'test:e2e:e1']],
    ['M5 recovery regression', 'npm', ['run', 'test:e2e:m5']],
    ['docs', 'npm', ['run', 'test:docs']],
    ['deliberate failure', 'npm', ['run', 'test:harness']],
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['build', 'npm', ['run', 'build']],
    ['diff check', 'git', ['diff', '--check']],
    ['E9 tempo lane unit', 'npm', ['run', 'test:e9:unit']],
    ['E9 persistence integration', 'npm', ['run', 'test:e9:integration']],
    ['E9 Chrome tempo lane', 'npm', ['run', 'test:e2e:e9:chrome']],
    ['E9 Edge tempo lane', 'npm', ['run', 'test:e2e:e9:edge']],
    ['E10 marker block unit', 'npm', ['run', 'test:e10:unit']],
    ['E10 marker block integration', 'npm', ['run', 'test:e10:integration']],
    ['E10 Chrome block editing', 'npm', ['run', 'test:e2e:e10:chrome']],
    ['E10 Edge block editing', 'npm', ['run', 'test:e2e:e10:edge']],
];

if (steps.length !== 33) {
    throw new Error(`E10 canonical must have 33 steps, got ${steps.length}.`);
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
            // Raw logs remain authoritative if a reporter decorates JSON.
        }
    }
    const isBrowserStep = /Chrome|Edge|browser/i.test(name)
        || args.some((arg) => arg.startsWith('test:e2e:'));
    const environmentBlocked = isBrowserStep
        && result.status !== 0
        && /listen EPERM|browser.*not found|executable.*doesn.t exist/i.test(output);
    const fileName = `${String(results.length + 1).padStart(2, '0')}-`
        + `${name.replaceAll(' ', '-')}.log`;
    const logPath = path.join(artifactDirectory, fileName);
    await writeFile(logPath, output, 'utf8');
    results.push({
        name,
        command: [command, ...args].join(' '),
        status: result.status,
        verification: environmentBlocked ? 'unverified / owner-review' : undefined,
        log: path.relative(repositoryRoot, logPath),
    });
}

const finalStatus = commandOutput('git', ['status', '--porcelain']);
const finalCommit = commandOutput('git', ['rev-parse', 'HEAD']);
const stepsPassed = results.every((result) => result.status === 0);
const repositoryIdentityPassed = finalCommit === commit
    && (provisional || finalStatus === '');
const summary = {
    runId,
    milestone: 'E10',
    expectedSteps: 33,
    provisional,
    commit,
    commitAtEnd: finalCommit,
    dirtyAtStart: initialStatus !== '',
    dirtyAtEnd: finalStatus !== '',
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    npm: commandOutput('npm', ['--version']),
    chrome: commandOutput(
        process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        ['--version'],
    ),
    edge: commandOutput(
        process.platform === 'darwin'
            ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
            : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        ['--version'],
    ),
    result: stepsPassed && repositoryIdentityPassed ? 'pass' : 'fail',
    browserMetrics,
    steps: results,
};
const summaryPath = path.join(artifactDirectory, 'summary.json');
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
const summaryHash = createHash('sha256')
    .update(await readFile(summaryPath))
    .digest('hex');
await writeFile(`${summaryPath}.sha256`, `${summaryHash}  summary.json\n`, 'utf8');

console.log(`\nE10 ${provisional ? 'provisional' : 'canonical'} result: ${summary.result}`);
console.log(`Artifacts: ${path.relative(repositoryRoot, artifactDirectory)}`);
console.log(`Summary SHA-256: ${summaryHash}`);
process.exit(summary.result === 'pass' ? 0 : 1);

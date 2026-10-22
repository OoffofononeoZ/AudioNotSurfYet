import { spawnSync } from 'node:child_process';
import { visualizerSkillFile, visualizerSkillPath } from './lib/visualizer-skill-path.mjs';

try {
    const result = spawnSync(process.execPath, [visualizerSkillFile('scripts/test.mjs')], {
        cwd: visualizerSkillPath(),
        stdio: 'inherit',
        windowsHide: true,
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}

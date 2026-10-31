import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { visualizerSkillPath } from './lib/visualizer-skill-path.mjs';

try {
    const repository = resolve(visualizerSkillPath(), '../..');
    const entry = resolve(repository, 'scripts/test.mjs');
    if (!existsSync(entry))
        throw Error(
            '外部资源仓库测试入口缺失：' +
                entry +
                '。测试仅在 WheresYourElements 仓库根目录维护，不随独立 skill 分发。',
        );
    const result = spawnSync(process.execPath, [entry], {
        cwd: repository,
        stdio: 'inherit',
        windowsHide: true,
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} catch (error) {
    process.stderr.write(String(error.message) + '\n');
    process.exitCode = 1;
}

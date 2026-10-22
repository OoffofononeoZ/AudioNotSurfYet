import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const visualizerSkillPath = () =>
    resolve(
        process.env.VISUALIZER_SKILL_DIR ??
            resolve(import.meta.dirname, '../../../WheresYourElements/skill/visualizer-content-generator'),
    );

export function visualizerSkillFile(relativePath) {
    const file = resolve(visualizerSkillPath(), relativePath);
    if (!existsSync(file))
        throw Error(
            `External Visualizer skill file missing: ${file}. Configure VISUALIZER_SKILL_DIR to use the external skill.`,
        );
    return file;
}

export const loadVisualizerLibraryTool = () =>
    import(pathToFileURL(visualizerSkillFile('scripts/resource-library.mjs')).href);

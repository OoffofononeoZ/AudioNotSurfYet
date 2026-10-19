import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { visualizerAssetsPath } from '../../scripts/lib/visualizer-assets-path.mjs';
export const assetsRoot = visualizerAssetsPath();
export const assetsAvailable = existsSync(join(assetsRoot, 'elements')) && existsSync(join(assetsRoot, 'presets'));
export function resourceRows() {
    if (!assetsAvailable)
        throw Error('External visualizer assets missing; set VISUALIZER_ASSETS_DIR to the assets folder.');
    return ['elements', 'presets'].flatMap(category =>
        readdirSync(join(assetsRoot, category)).map(id => {
            const dir = join(assetsRoot, category, id),
                info = JSON.parse(readFileSync(join(dir, 'resource-info.json'), 'utf8'));
            return { dir, info, pack: JSON.parse(readFileSync(join(dir, info.packagePath), 'utf8')) };
        }),
    );
}
export const resourcePack = path => {
    const id = path.replace(/^(elements|presets)\//, '').replace(/\.json$/, '');
    const row = resourceRows().find(r => r.info.resource.id === id);
    if (!row) throw Error('Missing external resource: ' + id);
    return row.pack;
};
export const sourceModule = (id, path) => pathToFileURL(join(assetsRoot, 'elements', id, 'source', path)).href;

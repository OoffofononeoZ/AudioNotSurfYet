import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resourceRows } from '../support/visualizer-assets.mjs';
import { copyVerifiedBytes } from '../../scripts/lib/desktop-native-runtime.mjs';

/** Copy only the existing package, source and cover fixtures; never write to the external library. */
export async function copyResourceLibrary(library) {
    const originalFiles = [],
        rows = resourceRows();
    for (const row of rows) {
        const sourceRoot = await fs.realpath(row.dir);
        const destination = path.join(
            library,
            row.info.kind === 'preset' ? 'presets' : 'elements',
            row.info.resource.id,
        );
        const images = (await fs.readdir(row.dir, { withFileTypes: true }))
            .filter(entry => entry.isFile() && /\.(png|jpe?g|webp|svg)$/i.test(entry.name))
            .map(entry => entry.name);
        const files = new Set(['resource-info.json', row.info.packagePath, row.info.sourceEntry, ...images]);
        if (row.info.previewPath && (await fs.stat(path.join(row.dir, row.info.previewPath)).catch(() => null)))
            files.add(row.info.previewPath);
        for (const relative of files) {
            const source = await fs.realpath(path.join(row.dir, relative));
            const inside = path.relative(sourceRoot, source);
            assert(
                inside && !inside.startsWith('..') && !path.isAbsolute(inside),
                'Resource input escaped its package',
            );
            const target = path.join(destination, relative);
            assert(!path.relative(destination, target).startsWith('..'), 'Resource destination escaped its package');
            await fs.mkdir(path.dirname(target), { recursive: true });
            originalFiles.push({ path: target, sha256: await copyVerifiedBytes(source, target) });
        }
    }
    const presetRoot = path.join(library, 'presets');
    return { originalFiles, rows, presetRoot, originalPresets: new Set(await fs.readdir(presetRoot)) };
}

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function canonical(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    return (
        '{' +
        Object.keys(value)
            .sort()
            .map(key => JSON.stringify(key) + ':' + canonical(value[key]))
            .join(',') +
        '}'
    );
}
export function sealPackage(input) {
    const pack = structuredClone(input);
    if (
        pack?.format !== 'audiosurf-visualizer-resource' ||
        pack.schemaVersion !== 1 ||
        !Array.isArray(pack.elements) ||
        !Array.isArray(pack.presets)
    )
        throw Error('Expected a VisualizerResourcePackageV1 JSON file.');
    const seal = definition => {
        delete definition.hash;
        definition.hash = createHash('sha256').update(canonical(definition)).digest('hex');
    };
    for (const definition of pack.elements) seal(definition);
    for (const preset of pack.presets) {
        for (const child of preset.elements) {
            const definition = pack.elements.find(
                e => e.id === child.element.id && e.version === child.element.version,
            );
            if (definition) child.element = { id: definition.id, version: definition.version, hash: definition.hash };
        }
        seal(preset);
    }
    return pack;
}
function main(args) {
    const check = args[0] === '--check';
    const files = check ? args.slice(1) : args;
    if (!files.length)
        throw Error('Usage: node scripts/visualizer-resource-package.mjs [--check] <package.json> [...]');
    for (const file of files) {
        const raw = JSON.parse(readFileSync(file, 'utf8')),
            sealed = sealPackage(raw);
        if (check) {
            if (canonical(raw) !== canonical(sealed)) throw Error(`Stale resource hash: ${file}`);
        } else writeFileSync(file, JSON.stringify(sealed, null, 2) + '\n');
        process.stdout.write(`${check ? 'Checked' : 'Sealed'} ${file}\n`);
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}

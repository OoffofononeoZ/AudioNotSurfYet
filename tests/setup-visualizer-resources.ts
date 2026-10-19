import { readFileSync } from 'node:fs';
import { elementRegistry } from '../src/visualizer/elementRegistry';
import { mergeResources, validateResourcePackage, validateResourceSnapshot } from '../src/visualizer/resourceCodec';

const root = new URL('../public/visualizer-resources/v2/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('catalog.json', root), 'utf8')) as { packages: string[] };
const raw = index.packages.map(path => JSON.parse(readFileSync(new URL(path, root), 'utf8')));
const snapshot = validateResourceSnapshot({
    algorithms: raw.flatMap(p => p.algorithms),
    elements: raw.flatMap(p => p.elements),
    presets: raw.flatMap(p => p.presets),
});
elementRegistry.replace(mergeResources(...raw.map(pack => validateResourcePackage(pack, snapshot))));

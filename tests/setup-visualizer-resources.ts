import { assetsAvailable, resourceRows } from './support/visualizer-assets.mjs';
import { elementRegistry } from '../src/visualizer/elementRegistry';
import { mergeResources, validateResourcePackage, validateResourceSnapshot } from '../src/visualizer/resourceCodec';

const raw = assetsAvailable ? resourceRows().map(row => row.pack) : [];
const snapshot = validateResourceSnapshot({
    algorithms: raw.flatMap(p => p.algorithms),
    elements: raw.flatMap(p => p.elements),
    presets: raw.flatMap(p => p.presets),
});
elementRegistry.replace(mergeResources(...raw.map(pack => validateResourcePackage(pack, snapshot))));

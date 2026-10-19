import { createHash } from 'node:crypto';
import ts from 'typescript';

export function canonical(value) {
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
const seal = value => {
    delete value.hash;
    value.hash = createHash('sha256').update(canonical(value)).digest('hex');
};
const ref = ({ id, version, hash }) => ({ id, version, hash });
const key = value => value.id + '@' + value.version;
export function sealExecutablePackages(input) {
    const packs = structuredClone(input);
    for (const pack of packs)
        if (
            pack.format !== 'audiosurf-visualizer-resource' ||
            pack.schemaVersion !== 2 ||
            !Array.isArray(pack.algorithms) ||
            !Array.isArray(pack.elements) ||
            !Array.isArray(pack.presets)
        )
            throw Error('Expected a VisualizerResourcePackageV2 JSON file.');
    const algorithms = new Map(),
        elements = new Map();
    const register = (map, value) => {
        const prior = map.get(key(value));
        if (prior && prior.hash !== value.hash) throw Error('Conflicting resource: ' + key(value));
        map.set(key(value), value);
    };
    for (const pack of packs)
        for (const algorithm of pack.algorithms) {
            seal(algorithm);
            register(algorithms, algorithm);
        }
    for (const pack of packs)
        for (const element of pack.elements) {
            const algorithm = algorithms.get(key(element.algorithm));
            if (!algorithm) throw Error('Missing algorithm: ' + key(element.algorithm));
            element.algorithm = ref(algorithm);
            seal(element);
            register(elements, element);
        }
    for (const pack of packs)
        for (const preset of pack.presets) {
            for (const child of preset.elements) {
                const element = elements.get(key(child.element));
                if (!element) throw Error('Missing element: ' + key(child.element));
                child.element = ref(element);
            }
            seal(preset);
        }
    return packs;
}
export function moduleSource(source, filename) {
    const file = ts.createSourceFile(filename, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
    if (file.parseDiagnostics.length) throw Error('Invalid algorithm source: ' + filename);
    const visit = node => {
        if (
            ts.isImportDeclaration(node) ||
            (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
            (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
        )
            throw Error('Algorithm modules must be self-contained: ' + filename);
        ts.forEachChild(node, visit);
    };
    visit(file);
    return source;
}

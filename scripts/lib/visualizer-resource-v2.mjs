import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
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
function contained(root, path) {
    const absolute = resolve(root, path),
        rel = relative(root, absolute);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\'))
        throw Error('Resource source escapes its root: ' + path);
    return absolute;
}
function moduleSource(source, filename) {
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
/** Author files remain readable; only the generated package embeds executable text. */
export function compileExecutableCatalog(root, output, check = false) {
    root = resolve(root);
    output = resolve(output);
    const index = JSON.parse(readFileSync(contained(root, 'catalog.json'), 'utf8'));
    if (
        !Array.isArray(index.packages) ||
        index.packages.some(p => typeof p !== 'string' || !/^[a-z0-9._-]+\.json$/.test(p))
    )
        throw Error('Invalid authoring catalog.');
    const raw = index.packages.map(path => {
        const pack = JSON.parse(readFileSync(contained(root, path), 'utf8'));
        for (const algorithm of pack.algorithms) {
            const filename = contained(root, algorithm.entry);
            algorithm.source = moduleSource(
                [
                    ...(algorithm.includes ?? []).map(p => readFileSync(contained(root, p), 'utf8')),
                    readFileSync(filename, 'utf8'),
                ].join('\n'),
                filename,
            );
            delete algorithm.includes;
            delete algorithm.entry;
            for (const program of Object.values(algorithm.programs)) {
                program.vertex = readFileSync(contained(root, program.vertexFile), 'utf8');
                program.fragment = readFileSync(contained(root, program.fragmentFile), 'utf8');
                delete program.vertexFile;
                delete program.fragmentFile;
            }
        }
        return pack;
    });
    const packs = sealExecutablePackages(raw);
    const catalog = { format: 'audiosurf-visualizer-catalog', schemaVersion: 2, packages: index.packages };
    const entries = [...packs.map((p, i) => [index.packages[i], p]), ['catalog.json', catalog]];
    if (!check) mkdirSync(output, { recursive: true });
    for (const [path, value] of entries) {
        const expected = JSON.stringify(value, null, 2) + '\n',
            file = contained(output, path);
        if (check) {
            if (readFileSync(file, 'utf8') !== expected) throw Error('Stale executable resource: ' + path);
        } else writeFileSync(file, expected);
    }
    return packs;
}

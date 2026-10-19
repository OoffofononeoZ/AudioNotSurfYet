import { readFileSync, writeFileSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, sealExecutablePackages, moduleSource } from './lib/package-core.mjs';
import { validateResourcePackage, validateResourceSnapshot } from './lib/resource-codec.generated.mjs';

export function contained(root, path, allowNewFile = false) {
    if (
        typeof path !== 'string' ||
        !path ||
        /[\\:%?#\x00-\x1f]/.test(path) ||
        path.split('/').some(p => !p || p === '.' || p === '..')
    )
        throw Error('Invalid relative resource path: ' + path);
    const target = resolve(root, path);
    const file =
            allowNewFile && !existsSync(target)
                ? resolve(realpathSync(dirname(target)), basename(target))
                : realpathSync(target),
        base = realpathSync(root),
        rel = relative(base, file);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\'))
        throw Error('Resource path escapes root: ' + path);
    return file;
}
function authorPackage(root, info) {
    const pack = JSON.parse(readFileSync(contained(root, info.sourceEntry), 'utf8'));
    for (const a of pack.algorithms) {
        const paths = [...(a.includes ?? []), a.entry];
        if (paths.some(p => !p.startsWith('source/'))) throw Error('Algorithm source must stay in source/');
        a.source = moduleSource(paths.map(p => readFileSync(contained(root, p), 'utf8')).join('\n'), a.entry);
        delete a.includes;
        delete a.entry;
        for (const program of Object.values(a.programs)) {
            for (const field of ['vertex', 'fragment']) {
                const path = program[field + 'File'];
                if (!path?.startsWith('source/')) throw Error('Shader must stay in source/');
                program[field] = readFileSync(contained(root, path), 'utf8');
                delete program[field + 'File'];
            }
        }
    }
    return pack;
}
function shape(pack, info, category) {
    if (category === 'presets') {
        if (info.kind !== 'preset' || pack.algorithms.length || pack.elements.length || pack.presets.length !== 1)
            throw Error('Preset package must only contain one preset');
        return pack.presets[0];
    }
    if (
        !['visual', 'modifier', 'transition'].includes(info.kind) ||
        pack.presets.length ||
        pack.elements.length !== 1 ||
        pack.algorithms.length !== 1
    )
        throw Error('Element package must contain one element and its algorithm');
    return pack.elements[0];
}
export function buildLibrary(root, check = false) {
    root = resolve(root);
    const rows = [];
    for (const category of ['elements', 'presets']) {
        for (const entry of readdirSync(contained(root, category), { withFileTypes: true }).sort((a, b) =>
            a.name.localeCompare(b.name),
        )) {
            if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9._-]*$/.test(entry.name))
                throw Error('Invalid resource directory: ' + entry.name);
            const dir = contained(root, category + '/' + entry.name),
                infoFile = contained(dir, 'resource-info.json');
            const info = JSON.parse(readFileSync(infoFile, 'utf8'));
            if (
                info.schemaVersion !== 1 ||
                info.resource?.id !== entry.name ||
                !Number.isSafeInteger(info.order) ||
                info.order < 0 ||
                !['title', 'description', 'creator', 'createdAt', 'previewPath', 'sourceEntry', 'packagePath'].every(
                    k => typeof info[k] === 'string' && info[k].trim(),
                ) ||
                !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(info.createdAt) ||
                !Number.isFinite(Date.parse(info.createdAt)) ||
                !info.sourceEntry.startsWith('source/') ||
                !Array.isArray(info.dependencies)
            )
                throw Error('Invalid resource-info: ' + dir);
            const svg = readFileSync(contained(dir, info.previewPath), 'utf8');
            if (!/<svg[\s>]/i.test(svg) || /<\s*(?:script|foreignObject)|\bon\w+\s*=|(?:href|url)\s*[=(]/i.test(svg))
                throw Error('Preview must be a standalone SVG');
            // Verify the output exists inside the resource before any overwrite.
            const output = contained(dir, info.packagePath, !check);
            rows.push({ dir, info, infoFile, output, category, pack: authorPackage(dir, info) });
        }
    }
    const packs = sealExecutablePackages(rows.map(r => r.pack));
    const snapshot = validateResourceSnapshot({
        algorithms: packs.flatMap(p => p.algorithms),
        elements: packs.flatMap(p => p.elements),
        presets: packs.flatMap(p => p.presets),
    });
    const identities = new Set();
    rows.forEach((r, i) => {
        const pack = validateResourcePackage(packs[i], snapshot),
            resource = shape(pack, r.info, r.category);
        if (
            resource.id !== r.info.resource.id ||
            resource.title !== r.info.title ||
            (r.category === 'elements' && resource.kind !== r.info.kind)
        )
            throw Error('Resource info identity mismatch');
        if (identities.has(resource.id)) throw Error('Duplicate resource ID');
        identities.add(resource.id);
        const deps =
            r.category === 'presets'
                ? [...new Map(resource.elements.map(e => [canonical(e.element), e.element])).values()]
                : [];
        const info = {
            ...r.info,
            resource: { id: resource.id, version: resource.version, hash: resource.hash },
            dependencies: deps,
        };
        r.expected = { pack, info };
        if (
            check &&
            (canonical(JSON.parse(readFileSync(r.output, 'utf8'))) !== canonical(pack) ||
                canonical(r.info) !== canonical(info))
        )
            throw Error('Stale resource: ' + resource.id);
    });
    // Validate the whole candidate before writing any resource.
    if (!check)
        for (const r of rows) {
            writeFileSync(r.output, JSON.stringify(r.expected.pack, null, 2) + '\n');
            writeFileSync(r.infoFile, JSON.stringify(r.expected.info, null, 2) + '\n');
        }
    return rows.map(r => r.expected);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        if (!['--build', '--check'].includes(process.argv[2]) || process.argv.length !== 4)
            throw Error('Usage: resource-library.mjs --build|--check <assets>');
        const rows = buildLibrary(process.argv[3], process.argv[2] === '--check');
        process.stdout.write(`Validated ${rows.length} external resources\n`);
    } catch (error) {
        process.stderr.write(error.message + '\n');
        process.exitCode = 1;
    }
}

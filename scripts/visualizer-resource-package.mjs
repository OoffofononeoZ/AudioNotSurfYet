import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileExecutableCatalog, canonical, sealExecutablePackages } from './lib/visualizer-resource-v2.mjs';

export function sealPackage(input) {
    return sealExecutablePackages([input])[0];
}
function main(args) {
    if (args[0] === '--build' || args[0] === '--check-build') {
        const check = args[0] === '--check-build';
        compileExecutableCatalog(args[1] ?? 'resources/visualizer', args[2] ?? 'public/visualizer-resources/v2', check);
        process.stdout.write(`${check ? 'Checked' : 'Built'} executable visualizer resources\n`);
        return;
    }
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

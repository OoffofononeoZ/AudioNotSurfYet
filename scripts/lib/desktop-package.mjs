import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// The installer smoke uses this same configuration with isolated staging/output.
export function desktopPackageConfig(root, metadata, appRoot, output) {
    return {
        appId: 'local.audionotsurfyet.desktop',
        productName: 'AudioNotSurfYet',
        electronVersion: metadata.devDependencies.electron,
        electronDist: path.dirname(require('electron')),
        directories: { app: appRoot, output, buildResources: path.join(root, 'electron/assets') },
        files: ['host/**', 'renderer/**', 'package.json', 'THIRD_PARTY_NOTICES.md', '!node_modules/**'],
        asar: true,
        npmRebuild: false,
        win: {
            icon: path.join(root, 'electron/assets/icon.svg'),
            signExecutable: false,
            requestedExecutionLevel: 'asInvoker',
        },
        nsis: { oneClick: true, perMachine: false, deleteAppDataOnUninstall: false, runAfterFinish: false },
    };
}

export async function writePackageChecksums(artifacts) {
    for (const artifact of artifacts.filter(file => file.endsWith('.exe'))) {
        const checksum = createHash('sha256');
        for await (const chunk of createReadStream(artifact)) checksum.update(chunk);
        await fs.writeFile(`${artifact}.sha256`, `${checksum.digest('hex')}  ${path.basename(artifact)}\n`, 'utf8');
    }
}

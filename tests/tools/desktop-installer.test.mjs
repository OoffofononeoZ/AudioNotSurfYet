import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
    containedPath,
    copyVerifiedBytes,
    hashFile,
    runInstaller,
    snapshot,
    verifyRetained,
} from '../desktop/install-support.mjs';
import { writePackageChecksums } from '../../scripts/lib/desktop-package.mjs';

async function temporary(run) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'audiosurf-installer-'));
    try {
        await run(await fs.realpath(root));
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

test('installer backup preserves nested files and empty directories without touching external files', async () => {
    await temporary(async root => {
        const data = path.join(root, 'data');
        const backup = path.join(root, 'backup');
        await fs.mkdir(path.join(data, 'empty'), { recursive: true });
        await fs.writeFile(path.join(data, 'state'), Buffer.from([0, 255, 8]));
        const before = await snapshot(data, backup);
        assert.deepEqual(await snapshot(backup), before);
        await fs.writeFile(path.join(data, 'new-user-file'), 'preserve me');
        assert.deepEqual(await verifyRetained(data, before), { files: 1, bytes: 3 });
        assert.equal(await fs.readFile(path.join(data, 'new-user-file'), 'utf8'), 'preserve me');
        await fs.writeFile(path.join(data, 'state'), 'changed');
        await assert.rejects(verifyRetained(data, before), /Existing user data changed/);
        assert.deepEqual(await fs.readFile(path.join(backup, 'state')), Buffer.from([0, 255, 8]));
    });
});

test('installer snapshot refuses directory redirection instead of backing up its target', async () => {
    await temporary(async root => {
        const data = path.join(root, 'data');
        const external = path.join(root, 'external');
        await fs.mkdir(data);
        await fs.mkdir(external);
        await fs.writeFile(path.join(external, 'secret'), 'outside');
        await fs.symlink(external, path.join(data, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(snapshot(data), /Refusing linked user data/);
        assert.equal(await fs.readFile(path.join(external, 'secret'), 'utf8'), 'outside');
    });
});

test('installer destination must be a descendant rather than a sibling or the workspace itself', () => {
    const root = path.resolve('workspace');
    assert.equal(containedPath(root, path.join(root, 'artifacts/app')), path.join(root, 'artifacts/app'));
    assert.throws(() => containedPath(root, root));
    assert.throws(() => containedPath(root, path.resolve('workspace-other/app')));
    assert.throws(() => containedPath(root, path.join(root, '../elsewhere')));
});

test('packaging emits independently verifiable EXE checksums without rewriting other artifacts', async () => {
    await temporary(async root => {
        const exe = path.join(root, 'Application Setup.exe');
        const blockmap = `${exe}.blockmap`;
        await fs.writeFile(exe, Buffer.alloc(2 ** 20 + 17, 83));
        await fs.writeFile(blockmap, 'untouched');
        await writePackageChecksums([exe, blockmap]);
        assert.equal(await fs.readFile(`${exe}.sha256`, 'utf8'), `${await hashFile(exe)}  Application Setup.exe\n`);
        assert.equal(await fs.readFile(blockmap, 'utf8'), 'untouched');
        await assert.rejects(fs.stat(`${blockmap}.sha256`), { code: 'ENOENT' });
    });
});

test(
    'Windows installer runner observes the actual child exit code',
    { skip: process.platform !== 'win32' },
    async () => {
        await assert.rejects(runInstaller(process.env.ComSpec, ['/d', '/c', 'exit', '37']), /failed with 37/);
        await runInstaller(process.env.ComSpec, ['/d', '/c', 'exit', '0']);
    },
);

test('native launch copy preserves bytes and refuses to overwrite a pre-existing file', async () => {
    await temporary(async root => {
        const source = path.join(root, 'build.exe');
        const destination = path.join(root, 'distribution.exe');
        const bytes = Buffer.from([0, 10, 255, 0, 64]);
        await fs.writeFile(source, bytes);
        await copyVerifiedBytes(source, destination);
        assert.deepEqual(await fs.readFile(destination), bytes);
        await fs.writeFile(source, 'new build');
        await assert.rejects(copyVerifiedBytes(source, destination), { code: 'EEXIST' });
        assert.deepEqual(await fs.readFile(destination), bytes);
    });
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';

async function temporary(run) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audiosurf-runtime-'));
    const root = await fs.realpath(directory);
    try {
        await run(root);
    } finally {
        assert.equal(await fs.realpath(directory), root, 'Temporary test directory was redirected');
        await fs.rm(root, { recursive: true, force: true });
    }
}

async function fixture(root) {
    const source = path.join(root, 'source');
    const destination = path.join(root, 'runtime');
    await fs.mkdir(path.join(source, 'empty'), { recursive: true });
    await fs.writeFile(path.join(source, 'application.exe'), Buffer.from([0, 255, 64, 12]));
    return { source, destination };
}

test('native execution copy checks bytes, preserves empty directories, and removes only its owned copy', async () => {
    await temporary(async root => {
        const { source, destination } = await fixture(root);
        const owned = await copyNativeTree(source, destination);
        assert.deepEqual(await fs.readFile(path.join(destination, 'application.exe')), Buffer.from([0, 255, 64, 12]));
        assert((await fs.stat(path.join(destination, 'empty'))).isDirectory());
        await cleanupNativeTree(owned);
        await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
        assert.deepEqual(await fs.readFile(path.join(source, 'application.exe')), Buffer.from([0, 255, 64, 12]));
    });
});

test('native copy refuses pre-existing destinations and redirected source entries', async () => {
    await temporary(async root => {
        const { source, destination } = await fixture(root);
        await fs.mkdir(destination);
        await fs.writeFile(path.join(destination, 'user-file'), 'untouched');
        await assert.rejects(copyNativeTree(source, destination), { code: 'EEXIST' });
        assert.equal(await fs.readFile(path.join(destination, 'user-file'), 'utf8'), 'untouched');
        await fs.symlink(destination, path.join(source, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(copyNativeTree(source, path.join(root, 'another')), /must not contain links/);
        await assert.rejects(fs.stat(path.join(root, 'another')), { code: 'ENOENT' });
    });
});

test('cleanup retains all files when a foreign or same-size changed file is found', async () => {
    await temporary(async root => {
        const { source, destination } = await fixture(root);
        const owned = await copyNativeTree(source, destination);
        const foreign = path.join(destination, 'user-file');
        const binary = path.join(destination, 'application.exe');
        await fs.writeFile(foreign, 'preserve');
        await assert.rejects(cleanupNativeTree(owned), /file set changed/);
        assert.equal(await fs.readFile(foreign, 'utf8'), 'preserve');
        await fs.unlink(foreign);
        await fs.writeFile(binary, 'abcd');
        await assert.rejects(cleanupNativeTree(owned), /Native file changed/);
        assert.equal(await fs.readFile(binary, 'utf8'), 'abcd');
        await fs.copyFile(path.join(source, 'application.exe'), binary);
        await cleanupNativeTree(owned);
    });
});

test('cleanup refuses a replaced directory junction and preserves its external target', async () => {
    await temporary(async root => {
        const { source, destination } = await fixture(root);
        const owned = await copyNativeTree(source, destination);
        const external = path.join(root, 'external');
        await fs.mkdir(external);
        await fs.writeFile(path.join(external, 'keep'), 'untouched');
        const replaced = path.join(destination, 'empty');
        await fs.rmdir(replaced);
        await fs.symlink(external, replaced, process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(cleanupNativeTree(owned), /must not contain links/);
        assert.equal(await fs.readFile(path.join(external, 'keep'), 'utf8'), 'untouched');
        await fs.unlink(replaced);
        await fs.mkdir(replaced);
        await cleanupNativeTree(owned);
    });
});

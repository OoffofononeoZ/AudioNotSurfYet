import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

export async function hashFile(file) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

// A new file inherits its ordinary destination directory's security. Never copy
// workspace ACLs/labels, relabel the project, or disable Electron's sandbox.
export async function copyVerifiedBytes(source, destination) {
    const expected = await hashFile(source);
    await pipeline(createReadStream(source), createWriteStream(destination, { flags: 'wx' }));
    assert.equal(await hashFile(destination), expected, 'Native distribution copy changed');
    assert.equal(await hashFile(source), expected, 'Source changed while copying');
    return expected;
}

export async function createNativeRun(purpose) {
    assert.equal(process.platform, 'win32', 'Native execution currently supports Windows only');
    assert(/^[a-z0-9-]+$/.test(purpose), 'Invalid native execution purpose');
    const local = await fs.realpath(process.env.LOCALAPPDATA);
    const base = path.join(local, 'AudioNotSurfYet-LocalRuntime');
    await fs.mkdir(base, { recursive: true });
    assert.equal(await fs.realpath(base), base, 'Native execution directory was redirected');
    const directory = path.join(base, `${purpose}-${randomUUID()}`);
    await fs.mkdir(directory);
    assert.equal(await fs.realpath(directory), directory);
    const temp = path.join(directory, 'temp');
    const profile = path.join(directory, 'profile');
    await fs.mkdir(temp);
    await fs.mkdir(profile);
    return { directory, temp, profile };
}

async function entries(root) {
    assert.equal(await fs.realpath(root), path.resolve(root), 'Native tree was redirected');
    const files = [];
    const directories = [];
    async function visit(relative) {
        const file = path.join(root, relative);
        const stat = await fs.lstat(file);
        assert(!stat.isSymbolicLink(), 'Native runtime must not contain links');
        if (stat.isDirectory()) {
            directories.push(relative);
            for (const name of (await fs.readdir(file)).sort()) await visit(path.join(relative, name));
        } else {
            assert(stat.isFile(), 'Native runtime must not contain special files');
            files.push({ relative, bytes: stat.size });
        }
    }
    await visit('');
    return { files, directories };
}

export async function copyNativeTree(source, destination) {
    const original = await entries(source);
    await fs.mkdir(destination); // Exclusive ownership: an existing tree is never overwritten.
    const root = await fs.realpath(destination);
    assert.equal(root, path.resolve(destination), 'Native copy destination was redirected');
    const files = [];
    for (const relative of original.directories.filter(Boolean)) await fs.mkdir(path.join(root, relative));
    for (const entry of original.files) {
        const sha256 = await copyVerifiedBytes(path.join(source, entry.relative), path.join(root, entry.relative));
        files.push({ ...entry, sha256 });
    }
    return { root, files, directories: original.directories };
}

export async function cleanupNativeTree(owned) {
    // Validate the complete ownership set before removing anything. Foreign or
    // changed files are retained for investigation; never recursively delete.
    const current = await entries(owned.root);
    assert.deepEqual(current.directories, owned.directories, 'Native directory set changed; copy retained');
    assert.deepEqual(
        current.files,
        owned.files.map(({ relative, bytes }) => ({ relative, bytes })),
        'Native file set changed; copy retained',
    );
    for (const file of owned.files) {
        assert.equal(
            await hashFile(path.join(owned.root, file.relative)),
            file.sha256,
            'Native file changed; copy retained',
        );
    }
    for (const file of owned.files) {
        const target = path.join(owned.root, file.relative);
        assert.equal(await fs.realpath(target), target, 'Native file was redirected');
        await fs.unlink(target);
    }
    for (const relative of [...owned.directories].reverse()) {
        const target = path.join(owned.root, relative);
        assert.equal(await fs.realpath(target), target, 'Native directory was redirected');
        await fs.rmdir(target);
    }
}

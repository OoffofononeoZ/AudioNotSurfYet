import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build, Platform, Arch } from 'electron-builder';
import { extractAll, extractFile } from '@electron/asar';
import { _electron } from '@playwright/test';
import { desktopPackageConfig, writePackageChecksums } from '../../scripts/lib/desktop-package.mjs';
import {
    containedPath,
    copyVerifiedBytes,
    exists,
    hashFile,
    powershell,
    psLiteral,
    runInstaller,
    snapshot,
    verifyRetained,
    windowsState,
} from './install-support.mjs';

assert.equal(process.platform, 'win32', 'This smoke performs a real per-user Windows installation');
const root = await fs.realpath(fileURLToPath(new URL('../../', import.meta.url)));
const artifacts = path.join(root, 'artifacts/desktop');
const id = randomUUID();
const run = containedPath(root, path.join(artifacts, 'install-verification', id));
const localAppData = await fs.realpath(process.env.LOCALAPPDATA);
const nativeRun = containedPath(localAppData, path.join(localAppData, 'AudioNotSurfYet-GoalSmoke', id));
const installDirectory = containedPath(nativeRun, path.join(nativeRun, 'installed app'));
const product = 'AudioNotSurfYet';
const executable = path.join(installDirectory, `${product}.exe`);
const uninstaller = path.join(installDirectory, `Uninstall ${product}.exe`);
const userData = path.join(process.env.APPDATA, product);
const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const installer = path.join(artifacts, 'packages', `${product} Setup ${metadata.version}.exe`);
const baseArchive = path.join(artifacts, 'packages/win-unpacked/resources/app.asar');
const fixture = path.join(run, 'upgrade-app');
const fixtureOutput = path.join(run, 'upgrade-packages');
const upgrade = metadata.version.split('.').map(Number);
assert(upgrade.length === 3 && upgrade.every(Number.isSafeInteger), 'Use a plain development semver');
upgrade[2] += 1;
const upgradeVersion = upgrade.join('.');
const result = { baseVersion: metadata.version, upgradeVersion, steps: {}, startup: { status: 'not-run' } };
let dataExisted;
let baseline;
let marked;
const markerName = `.audiosurf-installer-retention-${randomUUID()}`;
result.markerName = markerName;
const marker = path.join(userData, markerName);
const markerValue = Buffer.from(randomUUID());
const external = path.join(run, 'external-user-file.txt');

function verifyNoInstallation(state) {
    assert.equal(state.processes.length, 0, 'Close the existing application before this smoke');
    assert.equal(state.entries.length, 0, 'An existing installation must not be replaced by this smoke');
    assert.equal(state.shortcuts.length, 0, 'Existing product shortcuts must not be replaced');
}

function verifyInstallation(state, version) {
    assert.equal(state.processes.length, 0, 'Installer unexpectedly launched the application');
    assert(state.entries.length > 0, 'Uninstall registration missing');
    for (const entry of state.entries) {
        assert.equal(entry.hive, 'CurrentUser', 'Installation must not be machine-wide');
        assert.equal(path.resolve(entry.location), installDirectory, 'Unexpected installation directory');
        assert.equal(entry.version, version);
    }
    assert(state.shortcuts.length >= 2, 'Desktop or Start menu shortcut missing');
    for (const shortcut of state.shortcuts) assert.equal(path.resolve(shortcut.target), executable);
}

async function retained() {
    const counts = await verifyRetained(userData, marked);
    assert.deepEqual(await fs.readFile(external), markerValue, 'External user file changed');
    return counts;
}

async function verifyPayload(version, expectedHash) {
    const archive = path.join(installDirectory, 'resources/app.asar');
    const packageJson = JSON.parse(extractFile(archive, 'package.json').toString('utf8'));
    assert.equal(packageJson.version, version);
    assert.equal(await hashFile(archive), expectedHash, 'Installed payload differs from the packaged payload');
    assert(await exists(uninstaller), 'Uninstaller missing');
    const identity = JSON.parse(
        await powershell(`
$file = Get-Item -LiteralPath ${psLiteral(executable)}
@{ product = $file.VersionInfo.ProductName; version = $file.VersionInfo.ProductVersion;
    signature = (Get-AuthenticodeSignature -LiteralPath ${psLiteral(executable)}).Status.ToString()
} | ConvertTo-Json -Compress
`),
    );
    assert.equal(identity.product, product);
    assert.equal(identity.version, `${version}.0`);
    assert.equal(identity.signature, 'NotSigned');
}

async function testStartup() {
    const profile = path.join(nativeRun, 'startup-profile');
    await fs.mkdir(profile);
    const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: profile };
    delete env.ELECTRON_RUN_AS_NODE;
    let app;
    try {
        app = await _electron.launch({
            executablePath: executable,
            args: [`--user-data-dir=${profile}`],
            cwd: root,
            env,
            timeout: 20_000,
        });
        const page = await app.firstWindow({ timeout: 20_000 });
        await page.waitForSelector('#main-layout', { timeout: 30_000 });
        const security = await app.evaluate(({ BrowserWindow }) => {
            const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
            return {
                sandbox: preferences.sandbox,
                contextIsolation: preferences.contextIsolation,
                nodeIntegration: preferences.nodeIntegration,
            };
        });
        assert.deepEqual(security, { sandbox: true, contextIsolation: true, nodeIntegration: false });
        await page.screenshot({ path: path.join(run, 'installed-startup.png') });
        result.startup = { status: 'passed', security };
    } catch (error) {
        result.startup = { status: 'failed', error: String(error) };
    } finally {
        if (app) await app.close();
    }
}

async function writeResult() {
    await fs.writeFile(path.join(run, 'result.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
}

// Preflight before building or touching installed state. Keep every test run and backup separate.
verifyNoInstallation(await windowsState());
assert(await exists(installer), 'Run desktop:package first');
assert(!(await exists(run)), 'Verification directory already exists');
await fs.mkdir(run, { recursive: true });
assert.equal(await fs.realpath(run), run, 'Verification root must not be redirected');
process.env.TEMP = path.join(artifacts, 'build-temp');
process.env.TMP = process.env.TEMP;
await fs.mkdir(process.env.TEMP, { recursive: true });
console.log(`Installer verification: ${path.relative(root, run)}`);

try {
    const installerHash = await hashFile(installer);
    const checksum = await fs.readFile(`${installer}.sha256`, 'utf8');
    assert.equal(checksum, `${installerHash}  ${path.basename(installer)}\n`);
    result.installer = { bytes: (await fs.stat(installer)).size, sha256: installerHash };
    const basePackage = JSON.parse(extractFile(baseArchive, 'package.json').toString('utf8'));
    assert.equal(basePackage.version, metadata.version);
    const baseHash = await hashFile(baseArchive);

    // Only the ignored fixture's version changes; use the production packaging configuration.
    extractAll(baseArchive, fixture);
    const fixtureMetadata = JSON.parse(await fs.readFile(path.join(fixture, 'package.json'), 'utf8'));
    assert.equal(fixtureMetadata.version, metadata.version, 'Staging does not match the base package');
    fixtureMetadata.version = upgradeVersion;
    await fs.writeFile(path.join(fixture, 'package.json'), JSON.stringify(fixtureMetadata, null, 4) + '\n', 'utf8');
    const built = await build({
        targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
        publish: 'never',
        config: desktopPackageConfig(root, metadata, fixture, fixtureOutput),
    });
    await writePackageChecksums(built);
    const nextInstaller = path.join(fixtureOutput, `${product} Setup ${upgradeVersion}.exe`);
    assert(built.includes(nextInstaller), 'Upgrade fixture installer missing');
    const upgradeHash = await hashFile(path.join(fixtureOutput, 'win-unpacked/resources/app.asar'));
    result.upgradeInstaller = { bytes: (await fs.stat(nextInstaller)).size, sha256: await hashFile(nextInstaller) };

    // This managed workspace has inherited Low Integrity labels. Launching its
    // EXEs gives them Low Integrity even from Explorer. A normal per-user copy
    // inherits its destination security; do not modify the workspace's labels.
    assert(!(await exists(nativeRun)), 'Native verification directory already exists');
    await fs.mkdir(nativeRun, { recursive: true });
    assert.equal(await fs.realpath(nativeRun), nativeRun, 'Native verification root was redirected');
    const nativeInstaller = path.join(nativeRun, path.basename(installer));
    const nativeUpgrade = path.join(nativeRun, path.basename(nextInstaller));
    await copyVerifiedBytes(installer, nativeInstaller);
    await copyVerifiedBytes(nextInstaller, nativeUpgrade);
    process.env.TEMP = path.join(nativeRun, 'temp');
    process.env.TMP = process.env.TEMP;
    await fs.mkdir(process.env.TEMP);
    result.nativeDirectory = nativeRun;

    verifyNoInstallation(await windowsState());
    dataExisted = await exists(userData);
    baseline = await snapshot(userData, path.join(run, 'user-data-backup'));
    await fs.writeFile(path.join(run, 'private-baseline.json'), JSON.stringify(baseline, null, 4) + '\n', 'utf8');
    // Validate the backup once more against the live baseline before the first mutation.
    await verifyRetained(userData, baseline);
    await fs.mkdir(userData, { recursive: true });
    await fs.writeFile(marker, markerValue, { flag: 'wx' });
    await fs.writeFile(external, markerValue, { flag: 'wx' });
    marked = await snapshot(userData);
    result.backup = { files: baseline.files.length, bytes: baseline.files.reduce((sum, file) => sum + file.bytes, 0) };
    await writeResult();

    console.log(`Installing ${metadata.version} (per-user, silent, no automatic launch)`);
    // /D must be the last NSIS argument; NSIS accepts the remaining path including spaces.
    await runInstaller(nativeInstaller, ['/S', `/D=${installDirectory}`]);
    verifyInstallation(await windowsState(), metadata.version);
    assert.equal(await fs.realpath(installDirectory), installDirectory);
    await verifyPayload(metadata.version, baseHash);
    result.steps.install = { status: 'passed', retained: await retained() };
    await writeResult();

    await testStartup();
    await writeResult();
    console.log(`Installed application startup: ${result.startup.status}`);
    assert.equal((await windowsState()).processes.length, 0, 'Owned startup process is still running');

    console.log(`Upgrading ${metadata.version} -> ${upgradeVersion}`);
    await runInstaller(nativeUpgrade, ['/S', `/D=${installDirectory}`]);
    verifyInstallation(await windowsState(), upgradeVersion);
    await verifyPayload(upgradeVersion, upgradeHash);
    result.steps.upgrade = { status: 'passed', retained: await retained() };
    await writeResult();
} catch (error) {
    result.failure = String(error);
    process.exitCode = 1;
    console.error(error);
} finally {
    // Uninstall only the exact per-user verification installation owned by this run.
    // Leave an unexpected installation untouched for investigation.
    try {
        const state = await windowsState();
        const owned =
            state.entries.length > 0 &&
            state.entries.every(
                entry => entry.hive === 'CurrentUser' && path.resolve(entry.location) === installDirectory,
            );
        if (owned && state.processes.length === 0 && (await exists(uninstaller))) {
            assert.equal(await fs.realpath(installDirectory), installDirectory);
            console.log('Uninstalling the owned verification installation');
            await runInstaller(uninstaller, ['/S']);
            verifyNoInstallation(await windowsState());
            assert(!(await exists(installDirectory)), 'Application directory remains after uninstall');
            result.steps.uninstall = { status: 'passed', retained: await retained() };
        } else if (state.entries.length > 0) {
            throw Error('Cleanup needs investigation: installation ownership or process state changed');
        }
        if (marked) {
            await retained();
            assert.deepEqual(await fs.readFile(marker), markerValue);
            await fs.unlink(marker);
            if (!dataExisted) await fs.rmdir(userData); // Only succeeds if still empty; never recursively remove user data.
            await verifyRetained(userData, baseline);
            result.markerCleanup = 'passed';
        }
    } catch (error) {
        result.cleanupFailure = String(error);
        process.exitCode = 1;
        console.error(error);
    }
    await writeResult();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.failure || result.cleanupFailure || result.startup.status === 'failed' ? 1 : 0;
}
process.exit(process.exitCode ?? 0);

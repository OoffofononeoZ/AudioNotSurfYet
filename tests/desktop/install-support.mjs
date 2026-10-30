import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { hashFile } from '../../scripts/lib/desktop-native-runtime.mjs';
export { hashFile, copyVerifiedBytes } from '../../scripts/lib/desktop-native-runtime.mjs';

export const psLiteral = value => `'${value.replaceAll("'", "''")}'`;

export function powershell(source) {
    return new Promise((resolve, reject) => {
        const script = `$ErrorActionPreference = 'Stop'\n[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\n${source}`;
        const child = spawn(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
            { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8').on('data', value => (stdout += value));
        child.stderr.setEncoding('utf8').on('data', value => (stderr += value));
        child.once('error', reject);
        child.once('exit', code => {
            if (code !== 0) reject(Error(`PowerShell exited ${code}: ${stderr.trim()}`));
            else resolve(stdout.trim());
        });
    });
}

export async function windowsState() {
    return JSON.parse(
        await powershell(`
$entries = @()
foreach ($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryHive]::LocalMachine)) {
    foreach ($view in @([Microsoft.Win32.RegistryView]::Registry32, [Microsoft.Win32.RegistryView]::Registry64)) {
        $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
        try {
            $uninstall = $base.OpenSubKey('Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall')
            if ($null -eq $uninstall) { continue }
            try {
                foreach ($name in $uninstall.GetSubKeyNames()) {
                    $key = $uninstall.OpenSubKey($name)
                    if ($null -eq $key) { continue }
                    try {
                        if ($key.GetValue('DisplayName') -like 'AudioNotSurfYet*') {
                            $install = $base.OpenSubKey("Software\\$name")
                            try {
                                $entries += @{ hive = "$hive"; view = "$view"; key = $name;
                                    version = $key.GetValue('DisplayVersion');
                                    location = $(if ($install) { $install.GetValue('InstallLocation') } else { $null }) }
                            } finally { if ($install) { $install.Dispose() } }
                        }
                    } finally { $key.Dispose() }
                }
            } finally { $uninstall.Dispose() }
        } finally { $base.Dispose() }
    }
}
$shortcuts = @()
$shell = New-Object -ComObject WScript.Shell
$folders = @('Desktop', 'Programs', 'CommonDesktopDirectory', 'CommonPrograms')
foreach ($folder in $folders) {
    $directory = [Environment]::GetFolderPath($folder)
    if (!$directory) { continue }
    $file = Join-Path $directory 'AudioNotSurfYet.lnk'
    if (Test-Path -LiteralPath $file) {
        $shortcuts += @{ path = $file; target = $shell.CreateShortcut($file).TargetPath }
    }
}
@{ entries = @($entries); shortcuts = @($shortcuts);
    processes = @(Get-Process -Name 'AudioNotSurfYet' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
} | ConvertTo-Json -Depth 4 -Compress
`),
    );
}

export async function runInstaller(file, args) {
    const response = await powershell(`
# -Wait includes the uninstaller's relocated child, not just the short-lived launcher.
$process = Start-Process -FilePath ${psLiteral(file)} -ArgumentList ${psLiteral(args.join(' '))} -WindowStyle Hidden -Wait -PassThru
$process.ExitCode
`);
    assert(/^\d+$/.test(response), 'Installer process did not return an exit code');
    const code = Number(response);
    assert.equal(code, 0, `${path.basename(file)} failed with ${code}`);
}

export function containedPath(root, candidate) {
    const relative = path.relative(root, path.resolve(candidate));
    assert(relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
    return path.resolve(candidate);
}

export async function exists(file) {
    try {
        await fs.lstat(file);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
}

// Private names and hashes stay in ignored local artifacts; refuse links or special files.
export async function snapshot(directory, backup) {
    const result = { directories: [], files: [] };
    if (!(await exists(directory))) return result;
    assert.equal(await fs.realpath(directory), path.resolve(directory), 'Data root must be canonical');
    async function visit(relative) {
        const current = path.join(directory, relative);
        const stat = await fs.lstat(current);
        assert(!stat.isSymbolicLink(), 'Refusing linked user data');
        if (stat.isDirectory()) {
            result.directories.push(relative);
            if (backup) await fs.mkdir(path.join(backup, relative), { recursive: true });
            for (const name of (await fs.readdir(current)).sort()) await visit(path.join(relative, name));
        } else {
            assert(stat.isFile(), 'Refusing special user data');
            const hash = await hashFile(current);
            result.files.push({ relative, bytes: stat.size, hash });
            if (backup) {
                const copy = path.join(backup, relative);
                await fs.copyFile(current, copy, fs.constants.COPYFILE_EXCL);
                assert((await hashFile(copy)) === hash, 'Backup changed during capture');
            }
        }
    }
    await visit('');
    return result;
}

export async function verifyRetained(directory, baseline) {
    const actual = await snapshot(directory);
    const files = new Map(actual.files.map(file => [file.relative, file]));
    for (const expected of baseline.files) {
        const file = files.get(expected.relative);
        assert(
            file && file.bytes === expected.bytes && file.hash === expected.hash,
            'Existing user data changed; keep the private backup',
        );
    }
    for (const expected of baseline.directories) {
        assert(actual.directories.includes(expected), 'Existing user data directory disappeared');
    }
    return { files: baseline.files.length, bytes: baseline.files.reduce((sum, file) => sum + file.bytes, 0) };
}

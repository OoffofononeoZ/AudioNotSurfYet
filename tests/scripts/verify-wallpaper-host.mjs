import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Optional native smoke check. It opens one named, offscreen preview and closes only that preview.
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node tests/scripts/verify-wallpaper-host.mjs <wallpaper32.exe>');
const source = path.resolve('artifacts/visualizer-composition/wallpaper-chrome');
const reference = process.argv.includes('--reference');
const output = path.resolve(
    'artifacts/visualizer-composition/' + (reference ? 'wallpaper-native-reference' : 'wallpaper-native'),
);
await mkdir(output, { recursive: true });
for (const file of ['runtime.js', 'style-data.js', 'project.json', 'THIRD_PARTY_LICENSES.txt'])
    await copyFile(path.join(source, file), path.join(output, file));
const reports = [];
const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    try {
        if (url.pathname === '/status') reports.push(JSON.parse(url.searchParams.get('data')));
    } catch {}
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/gif' });
    response.end(Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const probe = `<script>
const probe={calls:0,registrations:0,peak:0,errors:[]};
window.addEventListener('error',e=>probe.errors.push(e.message));
window.addEventListener('unhandledrejection',e=>probe.errors.push(String(e.reason)));
const originalRegister=window.wallpaperRegisterAudioListener;
if(originalRegister)window.wallpaperRegisterAudioListener=function(callback){probe.registrations++;return originalRegister.call(window,function(values){probe.calls++;probe.peak=Math.max(probe.peak,...values);callback(values);});};
setInterval(()=>{const canvas=document.querySelector('canvas'),error=document.getElementById('error');new Image().src='http://127.0.0.1:${port}/status?data='+encodeURIComponent(JSON.stringify({...probe,api:!!originalRegister,state:canvas?.dataset.webglContextState,time:canvas?.dataset.frameTime,error:error?.hidden?'':error?.textContent}));},500);
</script>`;
const index = reference
    ? `<!doctype html><body><canvas></canvas><div id="error" hidden></div>${probe}<script>
window.wallpaperRegisterAudioListener=originalRegister;probe.registrations++;
window.wallpaperRegisterAudioListener(function(values){probe.calls++;probe.peak=Math.max(probe.peak,...values);});
setInterval(function(){const canvas=document.querySelector('canvas');canvas.dataset.webglContextState='ready';canvas.dataset.frameTime=String(performance.now()/1000);},100);
</script></body>`
    : await readFile(path.join(source, 'index.html'), 'utf8');
await writeFile(
    path.join(output, 'index.html'),
    index.replace('<script src="style-data.js">', probe + '<script src="style-data.js">'),
);
const name = 'AudioSurf-validation-' + randomUUID();
function command(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { windowsHide: true, stdio: 'ignore' });
        child.on('error', reject);
        child.on('exit', code => (code === 0 ? resolve() : reject(Error('Wallpaper CLI exited ' + code))));
    });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
    await command([
        '-control',
        'openWallpaper',
        '-file',
        path.join(output, 'project.json'),
        '-playInWindow',
        name,
        '-width',
        '960',
        '-height',
        '540',
        '-x',
        '-30000',
        '-y',
        '-30000',
    ]);
    for (let attempt = 0; attempt < 12 && !reports.some(report => report.state === 'ready'); attempt++)
        await delay(500);
    const fixture = path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav').replaceAll("'", "''");
    await new Promise((resolve, reject) => {
        const child = spawn(
            'powershell.exe',
            [
                '-NoProfile',
                '-Command',
                `$player = New-Object System.Media.SoundPlayer '${fixture}'; $player.PlaySync()`,
            ],
            { windowsHide: true, stdio: 'ignore' },
        );
        child.on('error', reject);
        child.on('exit', resolve);
    });
    await delay(1500);
    const result = {
        reports: reports.length,
        ready: reports.some(r => r.state === 'ready'),
        api: reports.some(r => r.api),
        registrations: Math.max(0, ...reports.map(r => r.registrations)),
        firstTime: reports[0]?.time,
        lastTime: reports.at(-1)?.time,
        audioCalls: Math.max(0, ...reports.map(r => r.calls)),
        audioPeak: Math.max(0, ...reports.map(r => r.peak)),
        errors: [...new Set(reports.flatMap(r => [...r.errors, ...(r.error ? [r.error] : [])]))],
    };
    await writeFile(path.join(output, 'native-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (!result.ready || result.audioCalls < 3 || result.audioPeak <= 0 || result.errors.length) process.exitCode = 1;
} finally {
    await command(['-control', 'closeWallpaper', '-location', name]).catch(error => console.error(error.message));
    server.close();
}

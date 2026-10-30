import { app, BrowserWindow, dialog, net, protocol, session, shell, screen } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NativeReadGrants } from './files/nativeGrants';
import { registerFileIpc } from './files/fileIpc';
import { NativeSaves } from './files/nativeSaves';
import { registerSaveIpc } from './files/saveIpc';
import { NativeBundles } from './files/nativeBundles';
import { NativeIpcTasks } from './files/nativeIpcTasks';
import { registerBundleIpc } from './files/bundleIpc';
import { nativeError } from './files/nativeErrors';
import { loadWindowState, windowPlacement, trackWindowState, WINDOW_MINIMUM } from './windowState';
import { ShutdownChannel } from './shutdownChannel';
import { registerShutdown } from './registerShutdown';
import { resolveNativeRead, type InitiatedFileRequest } from './files/nativeReadRequest';
import {
    APP_CSP,
    APP_ORIGIN,
    AppResourceError,
    isAppUrl,
    isDevelopmentUrl,
    resolveRendererResource,
} from './appResources';

app.setName('AudioNotSurfYet');
app.setAppUserModelId('local.audionotsurfyet.desktop');
const profile = process.env.AUDIOSURF_DESKTOP_TEST_PROFILE;
if (profile) app.setPath('userData', path.resolve(profile));

protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const devUrl = !app.isPackaged ? process.env.AUDIOSURF_DESKTOP_DEV_URL : undefined;
if (devUrl && !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(devUrl)) throw Error('Invalid desktop development URL');
const devOrigin = devUrl ? new URL(devUrl).origin : null;
const trustedUrl = (value: string) => (devOrigin ? isDevelopmentUrl(value, devOrigin) : isAppUrl(value));
let window: BrowserWindow | null = null;

async function openExternal(value: string) {
    try {
        const url = new URL(value);
        if (url.protocol === 'https:' && !url.username && !url.password) await shell.openExternal(url.href);
    } catch {
        // Malformed or unsupported external destinations are not opened.
    }
}

async function createWindow() {
    const ownerOrigin = devOrigin ?? APP_ORIGIN;
    const grants = new NativeReadGrants(path.join(app.getPath('userData'), 'native-read-grants.json'));
    const fileTasks = new NativeIpcTasks();
    const unregisterFiles = registerFileIpc(() => window, ownerOrigin, grants, fileTasks);
    const saves = new NativeSaves();
    const unregisterSaves = registerSaveIpc(() => window, ownerOrigin, saves, fileTasks);
    const bundles = new NativeBundles();
    const unregisterBundles = registerBundleIpc(() => window, ownerOrigin, grants, bundles, fileTasks);
    app.once('will-quit', unregisterBundles);
    app.once('will-quit', unregisterSaves);
    app.once('will-quit', unregisterFiles);
    const desktopSession = session.fromPartition('persist:audiosurf-desktop');
    desktopSession.setPermissionRequestHandler((contents, permission, callback, details) => {
        const ownPage = contents === window?.webContents && details.isMainFrame && trustedUrl(details.requestingUrl);
        callback(!!ownPage && ['fullscreen', 'clipboard-sanitized-write', 'persistent-storage'].includes(permission));
    });
    desktopSession.setPermissionCheckHandler((contents, permission, origin) => {
        return (
            contents === window?.webContents &&
            trustedUrl(origin) &&
            ['fullscreen', 'clipboard-sanitized-write', 'persistent-storage'].includes(permission)
        );
    });
    desktopSession.protocol.handle('app', async request => {
        if (new URL(request.url).pathname.startsWith('/native-files/')) {
            if (!fileTasks.accepting) return new Response('File unavailable', { status: 403 });
            try {
                const file = await resolveNativeRead(request as InitiatedFileRequest, grants, ownerOrigin);
                const response = await net.fetch(pathToFileURL(file).href, { method: request.method });
                const headers = new Headers(response.headers);
                headers.set('Access-Control-Allow-Origin', ownerOrigin);
                headers.set('Content-Type', 'application/octet-stream');
                headers.set('X-Content-Type-Options', 'nosniff');
                headers.set('Cache-Control', 'no-store');
                return new Response(response.body, { status: response.status, headers });
            } catch (error) {
                const code = nativeError(error).code;
                return new Response('File unavailable', { status: code === 'file-missing' ? 404 : 403 });
            }
        }
        try {
            const file = await resolveRendererResource(
                path.join(__dirname, '../renderer'),
                request.url,
                request.method,
            );
            const response = await net.fetch(pathToFileURL(file).href, { method: request.method });
            const headers = new Headers(response.headers);
            headers.set('Content-Security-Policy', APP_CSP);
            headers.set('X-Content-Type-Options', 'nosniff');
            return new Response(response.body, { status: response.status, headers });
        } catch (error) {
            return new Response('Resource unavailable', {
                status: error instanceof AppResourceError ? error.status : 500,
            });
        }
    });
    const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');
    const placement = windowPlacement(
        loadWindowState(windowStateFile),
        screen.getPrimaryDisplay().workArea,
        screen.getAllDisplays().map(display => display.workArea),
    );
    window = new BrowserWindow({
        title: 'AudioNotSurfYet',
        ...placement.bounds,
        minWidth: WINDOW_MINIMUM.width,
        minHeight: WINDOW_MINIMUM.height,
        show: false,
        backgroundColor: '#0d1711',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            session: desktopSession,
            nodeIntegration: false,
            nodeIntegrationInSubFrames: false,
            nodeIntegrationInWorker: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            backgroundThrottling: false,
        },
    });
    trackWindowState(window, windowStateFile);
    const shutdownChannel = new ShutdownChannel(() => window, ownerOrigin);
    registerShutdown(window, shutdownChannel, { tasks: fileTasks, saves, bundles, grants }, desktopSession);
    window.webContents.setWindowOpenHandler(({ url }) => {
        void openExternal(url);
        return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, url) => {
        if (!trustedUrl(url)) {
            event.preventDefault();
            void openExternal(url);
        }
    });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    const abortSaves = () => {
        fileTasks.invalidate();
        void saves.abortAll().catch(error => console.error('Native save cleanup failed', nativeError(error).code));
        void bundles
            .abortAll()
            .catch(error => console.error('Native directory cleanup failed', nativeError(error).code));
    };
    window.webContents.on('render-process-gone', abortSaves);
    window.webContents.on('render-process-gone', () => shutdownChannel.invalidate());
    window.webContents.on('render-process-gone', () => grants.clearTransientFiles());
    window.webContents.on('did-start-navigation', (_event, _url, sameDocument, isMainFrame) => {
        if (isMainFrame) {
            if (!sameDocument) shutdownChannel.invalidate();
            abortSaves();
            grants.clearTransientFiles();
        }
    });
    window.once('closed', abortSaves);
    window.webContents.on('will-prevent-unload', event => {
        if (!window) return;
        const result = dialog.showMessageBoxSync(window, {
            type: 'question',
            title: '退出 AudioNotSurfYet',
            message: '当前页面有未完成的工作，确认退出？',
            buttons: ['继续工作', '退出'],
            defaultId: 0,
            cancelId: 0,
        });
        if (result === 1) event.preventDefault();
    });
    window.on('closed', () => {
        window = null;
    });
    if (!profile)
        window.once('ready-to-show', () => {
            if (placement.maximized) window?.maximize();
            window?.show();
        });
    await window.loadURL(devUrl ?? `${APP_ORIGIN}/`);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
    app.on('second-instance', () => {
        if (window?.isMinimized()) window.restore();
        window?.show();
        window?.focus();
    });
    app.on('window-all-closed', () => app.quit());
    void app
        .whenReady()
        .then(createWindow)
        .catch(error => {
            console.error('Desktop startup failed:', error);
            app.exit(1);
        });
}

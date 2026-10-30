import { createApp } from 'vue';
import { createPinia } from 'pinia';
import persistedstate from 'pinia-plugin-persistedstate';
import App from '../../src/App.vue';
import router from '../../src/router';
import '../../src/style.css';
import 'element-plus/dist/index.css';
import { createPlatformPorts, platformPortsKey } from '../../src/platform/platformPorts';
import { DesktopLifecycle } from '../../src/platform/desktopLifecycle';
import type { ClosePhase, CloseReply, CloseRequest } from '../../src/platform/lifecycleContracts';

// Real shared app and IndexedDB, with only the Electron close transport replaced by a test driver.
let listener: ((request: CloseRequest) => void) | null = null;
let blockWrites = false;
const waiting = new Map<string, (reply: CloseReply) => void>();
const host = {
    ready: false,
    failWrites(value: boolean) {
        blockWrites = value;
    },
    request(phase: ClosePhase): Promise<CloseReply> {
        if (!listener) return Promise.reject(Error('Shutdown participant is not registered'));
        const id = crypto.randomUUID();
        return new Promise(resolve => {
            waiting.set(id, resolve);
            listener!({ id, phase });
        });
    },
};
const originalPut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
    if (blockWrites && this.transaction.db.name === 'audionotsurfyet-editor')
        throw new DOMException('Test write failure', 'QuotaExceededError');
    return arguments.length === 1 ? originalPut.call(this, value) : originalPut.call(this, value, key!);
};
const lifecycle = new DesktopLifecycle({
    onRequest: callback => {
        listener = callback;
        return () => {
            listener = null;
        };
    },
    ready: async () => {
        host.ready = true;
        return { ok: true, value: undefined };
    },
    reply: async (id, reply) => {
        waiting.get(id)!(reply);
        waiting.delete(id);
        return { ok: true, value: undefined };
    },
});
(window as typeof window & { __shutdownHost?: typeof host }).__shutdownHost = host;
history.replaceState({}, '', '/');
const pinia = createPinia();
pinia.use(persistedstate);
const app = createApp(App);
app.provide(platformPortsKey, { ...createPlatformPorts(), lifecycle });
app.use(pinia);
await router.replace('/');
app.use(router);
await router.isReady();
app.mount('#app');

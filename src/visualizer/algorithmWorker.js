// Trusted worker bootstrap. Resource modules run only in this opaque-origin worker.
const send = globalThis.postMessage.bind(globalThis);
const listen = globalThis.addEventListener.bind(globalThis);
const makeUrl = URL.createObjectURL.bind(URL);
const revokeUrl = URL.revokeObjectURL.bind(URL);
const SafeBlob = Blob;
// Only the trusted bootstrap owns the transport. Modules receive per-instance input closures.
for (let target = globalThis; target; target = Object.getPrototypeOf(target)) {
    for (const name of [
        'postMessage',
        'addEventListener',
        'removeEventListener',
        'dispatchEvent',
        'onmessage',
        'onmessageerror',
    ]) {
        const descriptor = Object.getOwnPropertyDescriptor(target, name);
        if (descriptor?.configurable)
            Object.defineProperty(target, name, { value: undefined, configurable: false, writable: false });
    }
}
for (const name of ['Worker', 'SharedWorker', 'OffscreenCanvas', 'BroadcastChannel']) {
    Object.defineProperty(globalThis, name, { value: undefined, configurable: false, writable: false });
}
const instances = new Map();
const reads = new Map();
let readSequence = 0;
let commands = Promise.resolve();
listen('message', ({ data }) => {
    if (data.kind === 'history-result' || data.kind === 'markers-result') {
        const pending = reads.get(data.readId);
        if (!pending) return;
        reads.delete(data.readId);
        if (data.error) pending.reject(Error(data.error));
        else pending.resolve(data.kind === 'history-result' ? data.samples : data.page);
        return;
    }
    const id = data.id;
    commands = commands.then(async () => {
        try {
            if (data.kind === 'initialize') {
                for (const instance of instances.values()) instance.dispose?.();
                instances.clear();
                const modules = new Map();
                for (const algorithm of data.algorithms) {
                    const url = makeUrl(new SafeBlob([algorithm.source], { type: 'text/javascript' }));
                    try {
                        const module = await import(url);
                        if (typeof module.create !== 'function') throw Error('算法必须导出 create 工厂。');
                        modules.set(algorithm.hash, module);
                    } finally {
                        revokeUrl(url);
                    }
                }
                for (const element of data.elements) {
                    const module = modules.get(element.hash);
                    if (!module) throw Error('算法依赖缺失。');
                    const instance = module.create();
                    if (!instance || typeof instance.prepareFrame !== 'function') throw Error('算法帧接口缺失。');
                    instances.set(element.id, instance);
                }
                send({ id, result: null });
            } else if (data.kind === 'frame') {
                const packets = [];
                for (const element of data.frames) {
                    const instance = instances.get(element.id);
                    if (!instance) throw Error('算法实例缺失。');
                    let active = true;
                    const read = (kind, request) => {
                        if (!active) return Promise.reject(Error('输入查询所属帧已结束。'));
                        const readId = ++readSequence;
                        const promise = new Promise((resolve, reject) => reads.set(readId, { resolve, reject }));
                        send({ kind, id, readId, elementId: element.id, request });
                        return promise;
                    };
                    let packet;
                    try {
                        if (element.frame.camera) {
                            for (const value of Object.values(element.frame.camera))
                                if (Array.isArray(value)) Object.freeze(value);
                            Object.freeze(element.frame.camera);
                        }
                        if (element.frame.lyrics) {
                            const freeze = value => {
                                if (value && typeof value === 'object') {
                                    for (const child of Object.values(value)) freeze(child);
                                    Object.freeze(value);
                                }
                            };
                            freeze(element.frame.lyrics);
                        }
                        packet = await instance.prepareFrame(element.frame, {
                            history: request => read('history', request),
                            markers: request => read('markers', request),
                        });
                    } finally {
                        active = false;
                    }
                    packets.push({ id: element.id, packet });
                }
                send({ id, result: packets });
            } else throw Error('未知算法运行命令。');
        } catch (error) {
            send({ id, error: error instanceof Error ? error.message : String(error) });
        }
    });
});

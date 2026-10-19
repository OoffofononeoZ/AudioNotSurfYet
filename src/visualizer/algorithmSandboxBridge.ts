/** Serialized into srcdoc; never interpolate resource text into this document. */
export function sandboxBridge() {
    const parentWindow = window.parent;
    let connected = false;
    window.addEventListener('message', event => {
        if (connected || event.source !== parentWindow || event.data?.kind !== 'connect' || !event.ports[0]) return;
        connected = true;
        const port = event.ports[0];
        const url = URL.createObjectURL(new Blob([event.data.worker], { type: 'text/javascript' }));
        const worker = new Worker(url);
        URL.revokeObjectURL(url);
        port.onmessage = message => {
            if (message.data?.kind === 'dispose') {
                worker.terminate();
                port.close();
                return;
            }
            worker.postMessage(message.data);
        };
        worker.onmessage = message => port.postMessage(message.data);
        worker.onerror = error => port.postMessage({ fatal: error.message || '隔离算法运行失败。' });
        port.start();
        port.postMessage({ connected: true });
    });
    parentWindow.postMessage({ kind: 'algorithm-sandbox-ready' }, '*');
}

import { nativeValue } from './desktopAudioFiles';
import type { CloseReply, DesktopLifecycleBridge, LifecycleAccess, ShutdownParticipant } from './lifecycleContracts';

export class DesktopLifecycle implements LifecycleAccess {
    private active = false;
    private readonly bridge: DesktopLifecycleBridge;
    constructor(bridge: DesktopLifecycleBridge) {
        this.bridge = bridge;
    }
    register(participant: ShutdownParticipant) {
        if (this.active) throw Error('退出处理器已注册。');
        this.active = true;
        let stopped = false,
            chain = Promise.resolve();
        const remove = this.bridge.onRequest(request => {
            chain = chain
                .then(async () => {
                    if (stopped) return;
                    let reply: CloseReply;
                    try {
                        if (request.phase === 'inspect') reply = { ok: true, summary: participant.inspect() };
                        else {
                            await participant[request.phase]();
                            reply = { ok: true };
                        }
                    } catch (error) {
                        reply = {
                            ok: false,
                            message: (error instanceof Error ? error.message : '退出准备失败。').slice(0, 500),
                        };
                    }
                    // Unmounting during dispose removes future listeners, but must still acknowledge this request.
                    nativeValue(await this.bridge.reply(request.id, reply));
                })
                .catch(() => {
                    console.error('Desktop shutdown response failed');
                });
        });
        void this.bridge
            .ready()
            .then(nativeValue)
            .catch(() => {
                console.error('Desktop shutdown registration failed');
            });
        return () => {
            if (stopped) return;
            stopped = true;
            this.active = false;
            remove();
        };
    }
}

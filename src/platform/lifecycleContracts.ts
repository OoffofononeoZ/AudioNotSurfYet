import type { NativeResult } from './fileContracts';

export type ClosePhase = 'inspect' | 'prepare' | 'dispose' | 'resume';
export interface CloseSummary {
    unsaved: boolean;
    tasks: boolean;
    output: boolean;
}
export interface CloseRequest {
    id: string;
    phase: ClosePhase;
}
export type CloseReply = { ok: true; summary?: CloseSummary } | { ok: false; message: string };
export interface ShutdownParticipant {
    inspect(): CloseSummary;
    prepare(): Promise<void>;
    dispose(): Promise<void>;
    resume(): void;
}
export interface LifecycleAccess {
    register(participant: ShutdownParticipant): () => void;
}
export interface DesktopLifecycleBridge {
    onRequest(listener: (request: CloseRequest) => void): () => void;
    ready(): Promise<NativeResult<void>>;
    reply(id: string, reply: CloseReply): Promise<NativeResult<void>>;
}
export function isCloseRequest(value: unknown): value is CloseRequest {
    const request = value as CloseRequest;
    return (
        !!request &&
        typeof request.id === 'string' &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(request.id) &&
        ['inspect', 'prepare', 'dispose', 'resume'].includes(request.phase)
    );
}

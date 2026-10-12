export interface AuditionSource {
    kind:'ft'|'auxiliary';
    resultId:string;
    trackId:string;
    label:string;
    sampleRate:number;
    frames:number;
    roles:readonly string[];
    mutedRoles:readonly string[];
    read(role:string,channel:0|1,start:number,length:number,signal:AbortSignal):Promise<Float32Array>;
    close():Promise<void>;
}
export interface AuditionTransportPort {
    setAuditionSource(source:AuditionSource|null,options?:{play?:boolean}):Promise<void>;
    setAuditionMuted(role:string,muted:boolean):void;
    subscribePlayback(listener:(snapshot:PlaybackSnapshot) => void):() => void;
    play():Promise<void>;
    pause():void;
}
export interface AuditionSnapshot {
    state:'paused'|'buffering'|'playing'|'ended'|'error';
    currentTimeSeconds:number;
    mutedRoles:string[];
    error?:string;
}
export const AUDITION_BLOCK_SECONDS = 4;
export const AUDITION_LOOKAHEAD_SECONDS = 8;
import type { PlaybackSnapshot } from '../types/audio';

import type { ExampleProfile, ExampleSearchResult, ExampleSource } from './types';
export type ExampleCommand =
    | { type: 'start'; jobId: string; source: ExampleSource; profile: ExampleProfile; cacheLimit: number }
    | { type: 'pcm'; jobId: string; requestId: number; samples?: Float32Array; error?: string };
export type ExampleEvent =
    | { type: 'read'; jobId: string; requestId: number; channel: number; start: number; length: number }
    | { type: 'progress'; jobId: string; phase: string; done: number; total: number }
    | { type: 'result'; jobId: string; sourceKey: string; queryHash: string; result: ExampleSearchResult }
    | { type: 'error'; jobId: string; code: string; message: string };

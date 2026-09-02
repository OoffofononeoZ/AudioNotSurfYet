import { validateVisualizerProjectV1 } from './projectCodec';
import type { VisualizerDraftEnvelopeV1 } from './types';

export const VISUALIZER_DATABASE_NAME = 'audionotsurfyet-visualizer';
export const VISUALIZER_DATABASE_VERSION = 1;
export const VISUALIZER_DRAFT_KEY = 'latest';
const DRAFT_STORE = 'draft';

interface StoredDraftRecord {
    key: typeof VISUALIZER_DRAFT_KEY;
    envelope: VisualizerDraftEnvelopeV1;
}

export interface VisualizerDraftRepositoryPort {
    restore(): Promise<VisualizerDraftEnvelopeV1 | null>;
    replace(envelope: VisualizerDraftEnvelopeV1): Promise<void>;
    clear(): Promise<void>;
    close(): void;
}

export class InvalidVisualizerDraftError extends Error {
    constructor(message = 'Visualizer draft is invalid.') {
        super(message);
        this.name = 'InvalidVisualizerDraftError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const validateVisualizerDraftEnvelope = (
    input: unknown,
): VisualizerDraftEnvelopeV1 => {
    if (!isRecord(input)) throw new InvalidVisualizerDraftError();
    const objectKeys = Object.keys(input);
    if (
        objectKeys.length !== 3
        || !objectKeys.includes('schemaVersion')
        || !objectKeys.includes('savedAt')
        || !objectKeys.includes('project')
        || input.schemaVersion !== 1
        || typeof input.savedAt !== 'string'
        || !Number.isFinite(Date.parse(input.savedAt))
    ) {
        throw new InvalidVisualizerDraftError();
    }
    try {
        return {
            schemaVersion: 1,
            savedAt: input.savedAt,
            project: validateVisualizerProjectV1(input.project),
        };
    } catch (error) {
        throw new InvalidVisualizerDraftError(
            error instanceof Error ? error.message : undefined,
        );
    }
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(
            request.error ?? new Error('IndexedDB request failed.'),
        );
    });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
    new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(
            transaction.error ?? new Error('IndexedDB transaction aborted.'),
        );
        transaction.onerror = () => reject(
            transaction.error ?? new Error('IndexedDB transaction failed.'),
        );
    });

export class VisualizerDraftRepository implements VisualizerDraftRepositoryPort {
    private readonly indexedDB: IDBFactory;
    private readonly databaseName: string;
    private databasePromise: Promise<IDBDatabase> | null = null;

    constructor(options: { indexedDB?: IDBFactory; databaseName?: string } = {}) {
        this.indexedDB = options.indexedDB ?? window.indexedDB;
        this.databaseName = options.databaseName ?? VISUALIZER_DATABASE_NAME;
    }

    async restore(): Promise<VisualizerDraftEnvelopeV1 | null> {
        const database = await this.open();
        const transaction = database.transaction(DRAFT_STORE, 'readonly');
        const stored = await requestResult(
            transaction.objectStore(DRAFT_STORE).get(VISUALIZER_DRAFT_KEY),
        ) as StoredDraftRecord | undefined;
        await transactionDone(transaction);
        return stored ? validateVisualizerDraftEnvelope(stored.envelope) : null;
    }

    async replace(envelope: VisualizerDraftEnvelopeV1): Promise<void> {
        const normalized = validateVisualizerDraftEnvelope(envelope);
        const database = await this.open();
        const transaction = database.transaction(DRAFT_STORE, 'readwrite');
        transaction.objectStore(DRAFT_STORE).put({
            key: VISUALIZER_DRAFT_KEY,
            envelope: normalized,
        } satisfies StoredDraftRecord);
        await transactionDone(transaction);
    }

    async clear(): Promise<void> {
        const database = await this.open();
        const transaction = database.transaction(DRAFT_STORE, 'readwrite');
        transaction.objectStore(DRAFT_STORE).delete(VISUALIZER_DRAFT_KEY);
        await transactionDone(transaction);
    }

    close(): void {
        void this.databasePromise?.then((database) => database.close());
        this.databasePromise = null;
    }

    private open(): Promise<IDBDatabase> {
        if (this.databasePromise) return this.databasePromise;
        const opening = new Promise<IDBDatabase>((resolve, reject) => {
            const request = this.indexedDB.open(
                this.databaseName,
                VISUALIZER_DATABASE_VERSION,
            );
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(DRAFT_STORE)) {
                    request.result.createObjectStore(DRAFT_STORE, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(
                request.error ?? new Error('Unable to open Visualizer database.'),
            );
            request.onblocked = () => reject(
                new Error('Visualizer database upgrade is blocked.'),
            );
        }).catch((error: unknown) => {
            this.databasePromise = null;
            throw error;
        });
        this.databasePromise = opening;
        return opening;
    }
}

import type {
    PersistedSessionV1,
    RestoredSessionBundle,
    StoredAnalysisCache,
    StoredCurrentBlob,
    StoredHandle,
} from '../types/session';

const DATABASE_NAME = 'audionotsurfyet-session';
const DATABASE_VERSION = 1;
const SESSION_KEY = 'latest';
const CURRENT_KEY = 'current';

const STORES = {
    session: 'session',
    handles: 'handles',
    currentBlob: 'current-blob',
    currentCache: 'current-analysis-cache',
} as const;

const FEATURE_IDS = new Set([
    'rms',
    'zcr',
    'energy',
    'amplitudeSpectrum',
    'powerSpectrum',
    'spectralCentroid',
    'spectralFlatness',
    'spectralFlux',
    'spectralSlope',
    'spectralRolloff',
    'spectralSpread',
    'spectralSkewness',
    'spectralKurtosis',
    'spectralCrest',
    'chroma',
    'loudness',
    'perceptualSpread',
    'perceptualSharpness',
    'mfcc',
    'complexSpectrum',
    'buffer',
]);

const RESTORE_STATES = new Set([
    'available',
    'permission-required',
    'permission-denied',
    'file-missing',
    'content-changed',
    'not-persisted',
    'decode-error',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isTrackRecord = (value: unknown): boolean => {
    if (!isRecord(value) || !isRecord(value.metadata)) return false;
    return typeof value.id === 'string'
        && typeof value.name === 'string'
        && typeof value.mimeType === 'string'
        && isFiniteNumber(value.byteSize)
        && isFiniteNumber(value.lastModified)
        && (value.durationSeconds === undefined
            || isFiniteNumber(value.durationSeconds))
        && (value.encodedSampleRate === undefined
            || isFiniteNumber(value.encodedSampleRate))
        && (value.trackHash === undefined
            || typeof value.trackHash === 'string')
        && (value.handleKey === undefined
            || typeof value.handleKey === 'string')
        && typeof value.restoreState === 'string'
        && RESTORE_STATES.has(value.restoreState);
};

const isAnalysisConfig = (value: unknown): boolean =>
    isRecord(value)
    && value.schemaVersion === 1
    && value.frameSize === 1024
    && value.hopSize === 512
    && value.windowingFunction === 'hanning'
    && value.numberOfMFCCCoefficients === 13
    && value.channelMode === 'average-mono';

export class UnsupportedSessionSchemaError extends Error {
    readonly schemaVersion: unknown;

    constructor(schemaVersion: unknown) {
        super(`Unsupported session schema: ${String(schemaVersion)}`);
        this.name = 'UnsupportedSessionSchemaError';
        this.schemaVersion = schemaVersion;
    }
}

export class InvalidPersistedSessionError extends Error {
    constructor(message = 'Persisted session is invalid.') {
        super(message);
        this.name = 'InvalidPersistedSessionError';
    }
}

export const validatePersistedSessionV1 = (
    value: unknown,
): PersistedSessionV1 => {
    if (!isRecord(value)) {
        throw new InvalidPersistedSessionError();
    }
    if (value.schemaVersion !== 1) {
        throw new UnsupportedSessionSchemaError(value.schemaVersion);
    }
    if (
        typeof value.savedAt !== 'string'
        || !Array.isArray(value.queue)
        || !value.queue.every(isTrackRecord)
        || (value.currentTrackId !== null
            && typeof value.currentTrackId !== 'string')
        || !Array.isArray(value.activeCards)
        || !value.activeCards.every((card) =>
            isRecord(card)
            && [0, 1, 2, 3].includes(card.slot as number)
            && typeof card.featureId === 'string'
            && FEATURE_IDS.has(card.featureId))
        || !isAnalysisConfig(value.analysisConfig)
        || (value.viewport !== null
            && (!isRecord(value.viewport)
                || !isFiniteNumber(value.viewport.startSeconds)
                || !isFiniteNumber(value.viewport.endSeconds)
                || !isFiniteNumber(value.viewport.zoom)))
        || !Array.isArray(value.handles)
        || !value.handles.every((entry) =>
            isRecord(entry)
            && typeof entry.trackId === 'string'
            && typeof entry.handleKey === 'string')
    ) {
        throw new InvalidPersistedSessionError();
    }
    if (
        value.currentBlob !== undefined
        && (!isRecord(value.currentBlob)
            || typeof value.currentBlob.trackId !== 'string'
            || typeof value.currentBlob.blobKey !== 'string'
            || typeof value.currentBlob.trackHash !== 'string')
    ) {
        throw new InvalidPersistedSessionError(
            'Persisted current Blob identity is invalid.',
        );
    }
    if (
        value.currentAnalysisCache !== undefined
        && (!isRecord(value.currentAnalysisCache)
            || typeof value.currentAnalysisCache.trackId !== 'string'
            || typeof value.currentAnalysisCache.trackHash !== 'string'
            || typeof value.currentAnalysisCache.configHash !== 'string'
            || !Array.isArray(value.currentAnalysisCache.featureIds)
            || !value.currentAnalysisCache.featureIds.every((featureId) =>
                typeof featureId === 'string'
                && FEATURE_IDS.has(featureId))
            || !Array.isArray(value.currentAnalysisCache.cacheKeys)
            || !value.currentAnalysisCache.cacheKeys.every(
                (cacheKey) => typeof cacheKey === 'string',
            ))
    ) {
        throw new InvalidPersistedSessionError(
            'Persisted analysis cache identity is invalid.',
        );
    }
    return value as unknown as PersistedSessionV1;
};

export interface PersistedQueueInput {
    session: PersistedSessionV1;
    handles: StoredHandle[];
}

export interface PersistedCurrentInput extends PersistedQueueInput {
    currentBlob?: StoredCurrentBlob;
    currentAnalysisCache?: StoredAnalysisCache;
}

export interface SessionRepositoryPort {
    restore(): Promise<RestoredSessionBundle | null>;
    saveQueue(input: PersistedQueueInput): Promise<void>;
    replaceCurrent(input: PersistedCurrentInput): Promise<void>;
    removeTrack(trackId: string): Promise<void>;
    clear(): Promise<void>;
}

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

export class SessionRepository implements SessionRepositoryPort {
    private readonly indexedDb: IDBFactory | undefined;
    private readonly databaseName: string;
    private readonly faultInjector?: (
        operation: 'saveQueue' | 'replaceCurrent' | 'removeTrack' | 'clear',
        transaction: IDBTransaction,
    ) => void;

    constructor(
        indexedDb?: IDBFactory,
        databaseName = DATABASE_NAME,
        faultInjector?: (
            operation: 'saveQueue' | 'replaceCurrent' | 'removeTrack' | 'clear',
            transaction: IDBTransaction,
        ) => void,
    ) {
        this.indexedDb = indexedDb ?? globalThis.indexedDB;
        this.databaseName = databaseName;
        this.faultInjector = faultInjector;
    }

    async restore(): Promise<RestoredSessionBundle | null> {
        const database = await this.open();
        try {
            const transaction = database.transaction(
                Object.values(STORES),
                'readonly',
            );
            const done = transactionDone(transaction);
            const sessionRequest = requestResult(
                transaction.objectStore(STORES.session).get(SESSION_KEY),
            );
            const handlesRequest = requestResult<StoredHandle[]>(
                transaction.objectStore(STORES.handles).getAll(),
            );
            const currentBlobRequest =
                requestResult<StoredCurrentBlob | undefined>(
                    transaction
                        .objectStore(STORES.currentBlob)
                        .get(CURRENT_KEY),
                );
            const currentCacheRequest =
                requestResult<StoredAnalysisCache | undefined>(
                    transaction
                        .objectStore(STORES.currentCache)
                        .get(CURRENT_KEY),
                );
            const [
                rawSession,
                handles,
                currentBlob,
                currentAnalysisCache,
            ] = await Promise.all([
                sessionRequest,
                handlesRequest,
                currentBlobRequest,
                currentCacheRequest,
            ]);
            await done;
            if (rawSession === undefined) {
                return null;
            }
            const session = validatePersistedSessionV1(rawSession);

            return {
                session,
                handles,
                currentBlob:
                    currentBlob
                    && session.currentBlob
                    && currentBlob.trackId === session.currentBlob.trackId
                    && currentBlob.trackHash === session.currentBlob.trackHash
                        ? currentBlob
                        : undefined,
                currentAnalysisCache:
                    currentAnalysisCache
                    && session.currentAnalysisCache
                    && currentAnalysisCache.manifest.trackId
                        === session.currentAnalysisCache.trackId
                    && currentAnalysisCache.manifest.trackHash
                        === session.currentAnalysisCache.trackHash
                    && currentAnalysisCache.manifest.configHash
                        === session.currentAnalysisCache.configHash
                        ? currentAnalysisCache
                        : undefined,
            };
        } finally {
            database.close();
        }
    }

    async saveQueue(input: PersistedQueueInput): Promise<void> {
        const database = await this.open();
        try {
            const transaction = database.transaction(
                [STORES.session, STORES.handles],
                'readwrite',
            );
            const done = transactionDone(transaction);
            this.writeSessionAndHandles(transaction, input);
            this.injectFault('saveQueue', transaction);
            await done;
        } finally {
            database.close();
        }
    }

    async replaceCurrent(input: PersistedCurrentInput): Promise<void> {
        const database = await this.open();
        try {
            const transaction = database.transaction(
                Object.values(STORES),
                'readwrite',
            );
            const done = transactionDone(transaction);
            this.writeSessionAndHandles(transaction, input);
            const blobStore = transaction.objectStore(STORES.currentBlob);
            const cacheStore = transaction.objectStore(STORES.currentCache);
            if (input.currentBlob) {
                blobStore.put(input.currentBlob, CURRENT_KEY);
            } else {
                blobStore.delete(CURRENT_KEY);
            }
            if (input.currentAnalysisCache) {
                cacheStore.put(input.currentAnalysisCache, CURRENT_KEY);
            } else {
                cacheStore.delete(CURRENT_KEY);
            }
            this.injectFault('replaceCurrent', transaction);
            await done;
        } finally {
            database.close();
        }
    }

    async removeTrack(trackId: string): Promise<void> {
        const database = await this.open();
        try {
            const transaction = database.transaction(
                [STORES.session, STORES.handles],
                'readwrite',
            );
            const done = transactionDone(transaction);
            const sessionStore = transaction.objectStore(STORES.session);
            const sessionRequest = sessionStore.get(SESSION_KEY);
            sessionRequest.onsuccess = () => {
                const rawSession = sessionRequest.result;
                if (isRecord(rawSession) && Array.isArray(rawSession.queue)) {
                    sessionStore.put({
                        ...rawSession,
                        savedAt: new Date().toISOString(),
                        queue: rawSession.queue.filter((entry) =>
                            !isRecord(entry) || entry.id !== trackId),
                        handles: Array.isArray(rawSession.handles)
                            ? rawSession.handles.filter((entry) =>
                                !isRecord(entry)
                                || entry.trackId !== trackId)
                            : [],
                    }, SESSION_KEY);
                }
            };
            sessionRequest.onerror = () => transaction.abort();
            transaction.objectStore(STORES.handles).delete(trackId);
            this.injectFault('removeTrack', transaction);
            await done;
        } finally {
            database.close();
        }
    }

    async clear(): Promise<void> {
        const database = await this.open();
        try {
            const transaction = database.transaction(
                Object.values(STORES),
                'readwrite',
            );
            const done = transactionDone(transaction);
            for (const storeName of Object.values(STORES)) {
                transaction.objectStore(storeName).clear();
            }
            this.injectFault('clear', transaction);
            await done;
        } finally {
            database.close();
        }
    }

    private writeSessionAndHandles(
        transaction: IDBTransaction,
        input: PersistedQueueInput,
    ) {
        transaction
            .objectStore(STORES.session)
            .put(input.session, SESSION_KEY);
        const handleStore = transaction.objectStore(STORES.handles);
        handleStore.clear();
        for (const handle of input.handles) {
            handleStore.put(handle, handle.trackId);
        }
    }

    private injectFault(
        operation: 'saveQueue' | 'replaceCurrent' | 'removeTrack' | 'clear',
        transaction: IDBTransaction,
    ) {
        if (!this.faultInjector) return;
        try {
            this.faultInjector(operation, transaction);
        } catch {
            transaction.abort();
        }
    }

    private open(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            if (!this.indexedDb) {
                reject(new Error('IndexedDB is unavailable.'));
                return;
            }
            const request = this.indexedDb.open(
                this.databaseName,
                DATABASE_VERSION,
            );
            request.onupgradeneeded = () => {
                const database = request.result;
                for (const storeName of Object.values(STORES)) {
                    if (!database.objectStoreNames.contains(storeName)) {
                        database.createObjectStore(storeName);
                    }
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(
                request.error ?? new Error('Unable to open IndexedDB.'),
            );
            request.onblocked = () => reject(
                new Error('IndexedDB upgrade is blocked.'),
            );
        });
    }
}

import { validateEditorProjectV1 } from './projectCodec';
import type {
    EditorDraftEnvelopeV1,
    EditorProjectV1,
} from './types';

export const EDITOR_DATABASE_NAME = 'audionotsurfyet-editor';
export const EDITOR_DATABASE_VERSION = 1;
export const EDITOR_DRAFT_KEY = 'latest';
export const EDITOR_LEAVE_WARNING_KEY = 'leave-warning';
export const EDITOR_OVERLAY_VISIBILITY_KEY = 'overlay-visibility';

const STORES = {
    draft: 'draft',
    preferences: 'preferences',
} as const;

interface StoredDraftRecord {
    key: typeof EDITOR_DRAFT_KEY;
    envelope: EditorDraftEnvelopeV1;
}

interface StoredLeaveWarningPreferenceRecord {
    key: typeof EDITOR_LEAVE_WARNING_KEY;
    value: boolean;
}

interface StoredOverlayVisibilityPreferenceRecord {
    key: typeof EDITOR_OVERLAY_VISIBILITY_KEY;
    value: {
        contentHash: string;
        enabled: boolean;
    };
}

export interface EditorDraftRepositoryPort {
    restore(): Promise<EditorDraftEnvelopeV1 | null>;
    replace(envelope: EditorDraftEnvelopeV1): Promise<void>;
    clear(): Promise<void>;
    getLeaveWarningEnabled(): Promise<boolean>;
    setLeaveWarningEnabled(enabled: boolean): Promise<void>;
    getOverlayVisibility(contentHash: string): Promise<boolean | null>;
    setOverlayVisibility(contentHash: string, enabled: boolean): Promise<void>;
    close(): void;
}

export class InvalidEditorDraftError extends Error {
    constructor(message = 'Editor draft is invalid.') {
        super(message);
        this.name = 'InvalidEditorDraftError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const validateDraftEnvelope = (value: unknown): EditorDraftEnvelopeV1 => {
    if (!isRecord(value)) throw new InvalidEditorDraftError();
    const keys = Object.keys(value);
    if (
        keys.length !== 3
        || !keys.includes('schemaVersion')
        || !keys.includes('savedAt')
        || !keys.includes('project')
        || value.schemaVersion !== 1
        || typeof value.savedAt !== 'string'
        || !Number.isFinite(Date.parse(value.savedAt))
    ) {
        throw new InvalidEditorDraftError();
    }
    let project: EditorProjectV1;
    try {
        project = validateEditorProjectV1(value.project);
    } catch (error) {
        throw new InvalidEditorDraftError(
            error instanceof Error ? error.message : undefined,
        );
    }
    return { schemaVersion: 1, savedAt: value.savedAt, project };
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

export interface EditorDraftRepositoryOptions {
    indexedDB?: IDBFactory;
    databaseName?: string;
}

export class EditorDraftRepository implements EditorDraftRepositoryPort {
    private readonly indexedDB: IDBFactory;
    private readonly databaseName: string;
    private databasePromise: Promise<IDBDatabase> | null = null;

    constructor(options: EditorDraftRepositoryOptions = {}) {
        this.indexedDB = options.indexedDB ?? window.indexedDB;
        this.databaseName = options.databaseName ?? EDITOR_DATABASE_NAME;
    }

    async restore(): Promise<EditorDraftEnvelopeV1 | null> {
        const database = await this.open();
        const transaction = database.transaction(STORES.draft, 'readonly');
        const record = await requestResult(
            transaction.objectStore(STORES.draft).get(EDITOR_DRAFT_KEY),
        ) as StoredDraftRecord | undefined;
        await transactionDone(transaction);
        return record ? validateDraftEnvelope(record.envelope) : null;
    }

    async replace(envelope: EditorDraftEnvelopeV1): Promise<void> {
        const normalized = validateDraftEnvelope(envelope);
        const database = await this.open();
        const transaction = database.transaction(STORES.draft, 'readwrite');
        transaction.objectStore(STORES.draft).put({
            key: EDITOR_DRAFT_KEY,
            envelope: normalized,
        } satisfies StoredDraftRecord);
        await transactionDone(transaction);
    }

    async clear(): Promise<void> {
        const database = await this.open();
        const transaction = database.transaction(STORES.draft, 'readwrite');
        transaction.objectStore(STORES.draft).delete(EDITOR_DRAFT_KEY);
        await transactionDone(transaction);
    }

    async getLeaveWarningEnabled(): Promise<boolean> {
        const database = await this.open();
        const transaction = database.transaction(STORES.preferences, 'readonly');
        const record = await requestResult(
            transaction.objectStore(STORES.preferences).get(
                EDITOR_LEAVE_WARNING_KEY,
            ),
        ) as StoredLeaveWarningPreferenceRecord | undefined;
        await transactionDone(transaction);
        return record?.value ?? true;
    }

    async setLeaveWarningEnabled(enabled: boolean): Promise<void> {
        const database = await this.open();
        const transaction = database.transaction(STORES.preferences, 'readwrite');
        transaction.objectStore(STORES.preferences).put({
            key: EDITOR_LEAVE_WARNING_KEY,
            value: enabled,
        } satisfies StoredLeaveWarningPreferenceRecord);
        await transactionDone(transaction);
    }

    async getOverlayVisibility(contentHash: string): Promise<boolean | null> {
        const database = await this.open();
        const transaction = database.transaction(STORES.preferences, 'readonly');
        const record = await requestResult(
            transaction.objectStore(STORES.preferences).get(
                EDITOR_OVERLAY_VISIBILITY_KEY,
            ),
        ) as StoredOverlayVisibilityPreferenceRecord | undefined;
        await transactionDone(transaction);
        if (
            !record
            || !record.value
            || record.value.contentHash !== contentHash
            || typeof record.value.enabled !== 'boolean'
        ) return null;
        return record.value.enabled;
    }

    async setOverlayVisibility(
        contentHash: string,
        enabled: boolean,
    ): Promise<void> {
        const database = await this.open();
        const transaction = database.transaction(STORES.preferences, 'readwrite');
        transaction.objectStore(STORES.preferences).put({
            key: EDITOR_OVERLAY_VISIBILITY_KEY,
            value: { contentHash, enabled },
        } satisfies StoredOverlayVisibilityPreferenceRecord);
        await transactionDone(transaction);
    }

    close(): void {
        void this.databasePromise?.then((database) => database.close());
        this.databasePromise = null;
    }

    private open(): Promise<IDBDatabase> {
        if (this.databasePromise) return this.databasePromise;
        this.databasePromise = new Promise((resolve, reject) => {
            const request = this.indexedDB.open(
                this.databaseName,
                EDITOR_DATABASE_VERSION,
            );
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORES.draft)) {
                    database.createObjectStore(STORES.draft, { keyPath: 'key' });
                }
                if (!database.objectStoreNames.contains(STORES.preferences)) {
                    database.createObjectStore(STORES.preferences, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(
                request.error ?? new Error('Unable to open Editor database.'),
            );
            request.onblocked = () => reject(
                new Error('Editor database upgrade is blocked.'),
            );
        });
        return this.databasePromise;
    }
}

export const createEditorDraftEnvelope = (
    project: EditorProjectV1,
    now: () => Date = () => new Date(),
): EditorDraftEnvelopeV1 => ({
    schemaVersion: 1,
    savedAt: now().toISOString(),
    project: validateEditorProjectV1(project),
});

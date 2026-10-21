import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { installDirectoryPickerStub, prepareResourceDirectory } from './resource-directory';
const resourcePages = new WeakSet<Page>();

interface PickerEntry {
    name: string;
    mimeType: string;
    base64: string;
}

export interface PickerDataEntry {
    name: string;
    mimeType: string;
    text: string;
}

interface SavedPickerEntry {
    name: string;
    mimeType: string;
    base64: string;
}

interface PickerOptions {
    suggestedName?: string;
    types?: { accept: Record<string, string[]> }[];
}

const mimeTypeFor = (filePath: string) => {
    switch (path.extname(filePath).toLowerCase()) {
        case '.mp3':
            return 'audio/mpeg';
        case '.flac':
            return 'audio/flac';
        case '.json':
            return 'application/json';
        default:
            return 'audio/wav';
    }
};

export async function installFilePickerStub(page: Page, options: { visualizerAssets?: boolean } = {}) {
    if (options.visualizerAssets) {
        resourcePages.add(page);
        await installDirectoryPickerStub(page);
    }
    const installer = () => {
        const pickerWindow = window as unknown as {
            __audioNotSurfYetPickerQueue?: FileSystemFileHandle[][];
            __audioNotSurfYetSavedPickerEntries?: SavedPickerEntry[];
            showOpenFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle[]>;
            showSaveFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle>;
        };
        pickerWindow.__audioNotSurfYetPickerQueue ??= [];
        pickerWindow.__audioNotSurfYetSavedPickerEntries ??= [];
        const validateOptions = (options?: PickerOptions) => {
            for (const type of options?.types ?? []) {
                for (const extension of Object.values(type.accept).flat()) {
                    if (extension.length > 16 || !/^\.[\p{L}\p{N}+]+$/u.test(extension)) {
                        throw new TypeError(`Invalid picker extension: ${extension}`);
                    }
                }
            }
        };
        pickerWindow.showOpenFilePicker = async options => {
            validateOptions(options);
            const next = pickerWindow.__audioNotSurfYetPickerQueue?.shift();
            if (!next) {
                throw new DOMException('Picker cancelled.', 'AbortError');
            }
            return next;
        };
        pickerWindow.showSaveFilePicker = async options => {
            validateOptions(options);
            const root = await navigator.storage.getDirectory();
            const directory = await root.getDirectoryHandle('editor-save-picker', { create: true });
            const name = options?.suggestedName ?? 'editor-project.json';
            const handle = await directory.getFileHandle(name, { create: true });
            const nativeCreateWritable = handle.createWritable.bind(handle);
            handle.createWritable = async () => {
                const writable = await nativeCreateWritable();
                const nativeClose = writable.close.bind(writable);
                writable.close = async () => {
                    await nativeClose();
                    const file = await handle.getFile();
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    let binary = '';
                    for (const byte of bytes) binary += String.fromCharCode(byte);
                    pickerWindow.__audioNotSurfYetSavedPickerEntries?.push({
                        name,
                        mimeType: file.type,
                        base64: btoa(binary),
                    });
                };
                return writable;
            };
            return handle;
        };
    };
    await page.addInitScript(installer);
    await page.evaluate(installer);
}

export async function queuePickerFiles(page: Page, filePaths: string[]) {
    const entries: PickerEntry[] = await Promise.all(
        filePaths.map(async filePath => ({
            name: path.basename(filePath),
            mimeType: mimeTypeFor(filePath),
            base64: (await readFile(filePath)).toString('base64'),
        })),
    );
    await page.evaluate(async pickerEntries => {
        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle(`picker-${crypto.randomUUID()}`, { create: true });
        const handles: FileSystemFileHandle[] = [];
        for (const entry of pickerEntries) {
            const handle = await directory.getFileHandle(entry.name, { create: true });
            const writable = await handle.createWritable();
            const binary = atob(entry.base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            await writable.write(new Blob([bytes], { type: entry.mimeType }));
            await writable.close();
            handles.push(handle);
        }
        const pickerWindow = window as unknown as {
            __audioNotSurfYetPickerQueue: FileSystemFileHandle[][];
        };
        pickerWindow.__audioNotSurfYetPickerQueue.push(handles);
    }, entries);
}

export async function queuePickerData(page: Page, entries: PickerDataEntry[]) {
    await page.evaluate(async pickerEntries => {
        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle(`picker-${crypto.randomUUID()}`, { create: true });
        const handles: FileSystemFileHandle[] = [];
        for (const entry of pickerEntries) {
            const handle = await directory.getFileHandle(entry.name, { create: true });
            const writable = await handle.createWritable();
            await writable.write(new Blob([entry.text], { type: entry.mimeType }));
            await writable.close();
            handles.push(handle);
        }
        const pickerWindow = window as unknown as {
            __audioNotSurfYetPickerQueue: FileSystemFileHandle[][];
        };
        pickerWindow.__audioNotSurfYetPickerQueue.push(handles);
    }, entries);
}

export async function chooseFiles(page: Page, filePaths: string[]) {
    if (resourcePages.has(page)) {
        await prepareResourceDirectory(page);
        resourcePages.delete(page);
    }
    await queuePickerFiles(page, filePaths);
    await page.getByTestId('import-audio').click();
}

export async function savedPickerEntries(page: Page): Promise<SavedPickerEntry[]> {
    return page.evaluate(() => {
        const pickerWindow = window as unknown as {
            __audioNotSurfYetSavedPickerEntries?: SavedPickerEntry[];
        };
        return structuredClone(pickerWindow.__audioNotSurfYetSavedPickerEntries ?? []);
    });
}

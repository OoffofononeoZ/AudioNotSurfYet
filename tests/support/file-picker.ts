import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

interface PickerEntry {
    name: string;
    mimeType: string;
    base64: string;
}

const mimeTypeFor = (filePath: string) => {
    switch (path.extname(filePath).toLowerCase()) {
        case '.mp3':
            return 'audio/mpeg';
        case '.flac':
            return 'audio/flac';
        default:
            return 'audio/wav';
    }
};

export async function installFilePickerStub(page: Page) {
    const installer = () => {
        const pickerWindow = window as unknown as {
            __audioNotSurfYetPickerQueue?: FileSystemFileHandle[][];
            showOpenFilePicker?: () => Promise<FileSystemFileHandle[]>;
        };
        pickerWindow.__audioNotSurfYetPickerQueue ??= [];
        pickerWindow.showOpenFilePicker = async () => {
            const next = pickerWindow.__audioNotSurfYetPickerQueue?.shift();
            if (!next) {
                throw new DOMException('Picker cancelled.', 'AbortError');
            }
            return next;
        };
    };
    await page.addInitScript(installer);
    await page.evaluate(installer);
}

export async function queuePickerFiles(
    page: Page,
    filePaths: string[],
) {
    const entries: PickerEntry[] = await Promise.all(
        filePaths.map(async (filePath) => ({
            name: path.basename(filePath),
            mimeType: mimeTypeFor(filePath),
            base64: (await readFile(filePath)).toString('base64'),
        })),
    );
    await page.evaluate(async (pickerEntries) => {
        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle(
            `picker-${crypto.randomUUID()}`,
            { create: true },
        );
        const handles: FileSystemFileHandle[] = [];
        for (const entry of pickerEntries) {
            const handle = await directory.getFileHandle(
                entry.name,
                { create: true },
            );
            const writable = await handle.createWritable();
            const binary = atob(entry.base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            await writable.write(new Blob(
                [bytes],
                { type: entry.mimeType },
            ));
            await writable.close();
            handles.push(handle);
        }
        const pickerWindow = window as unknown as {
            __audioNotSurfYetPickerQueue: FileSystemFileHandle[][];
        };
        pickerWindow.__audioNotSurfYetPickerQueue.push(handles);
    }, entries);
}

export async function chooseFiles(
    page: Page,
    filePaths: string[],
) {
    await queuePickerFiles(page, filePaths);
    await page.getByTestId('import-audio').click();
}

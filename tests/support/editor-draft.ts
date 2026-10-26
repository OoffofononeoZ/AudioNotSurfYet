import type { Page } from '@playwright/test';
import type { EditorProjectV2 } from '../../src/editor/types';

export async function readEditorDraft(page: Page): Promise<EditorProjectV2> {
    return page.evaluate(
        () =>
            new Promise((resolve, reject) => {
                const request = indexedDB.open('audionotsurfyet-editor');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    const get = db.transaction('draft').objectStore('draft').get('latest');
                    get.onerror = () => {
                        db.close();
                        reject(get.error);
                    };
                    get.onsuccess = () => {
                        db.close();
                        resolve(get.result?.envelope.project);
                    };
                };
            }),
    );
}

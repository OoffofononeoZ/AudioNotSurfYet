import type { NativeReadGrants } from './nativeGrants';
import { grantId, grantRelativePath } from './nativeGrants';
import { NativeFileError } from './nativeErrors';
import { isAppUrl } from '../appResources';

export interface InitiatedFileRequest {
    url: string;
    method: string;
    initiatorOrigin?: string;
}

/** The initiator comes from Electron, not renderer-controlled referrer/headers. */
export async function resolveNativeRead(request: InitiatedFileRequest, grants: NativeReadGrants, ownerOrigin: string) {
    if (
        !isAppUrl(request.url) ||
        request.initiatorOrigin !== ownerOrigin ||
        !['GET', 'HEAD'].includes(request.method)
    ) {
        throw new NativeFileError('permission-denied');
    }
    const url = new URL(request.url);
    const id = grantId(/^\/native-files\/([^/]+)$/.exec(url.pathname)?.[1]);
    if ([...url.searchParams.keys()].some(key => key !== 'path') || url.searchParams.getAll('path').length > 1) {
        throw new NativeFileError('invalid-request');
    }
    const relative = url.searchParams.get('path');
    if (relative !== null) {
        grantRelativePath(relative);
        return grants.resolveDirectoryFile(id, relative);
    }
    return grants.resolveFile(id);
}

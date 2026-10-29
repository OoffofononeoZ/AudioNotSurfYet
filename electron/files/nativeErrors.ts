import type { NativeFileErrorCode, NativeResult } from '../../src/platform/fileContracts';

const messages: Record<NativeFileErrorCode, string> = {
    'permission-denied': '未获得该文件或目录的访问权限，请重新选择。',
    'file-missing': '文件或目录已移动或删除，请重新选择。',
    'invalid-request': '文件访问请求无效。',
    'store-invalid': '已保存的文件授权记录无效，请检查应用数据。',
    'io-error': '无法完成本地文件操作。',
};

export class NativeFileError extends Error {
    readonly code: NativeFileErrorCode;
    constructor(code: NativeFileErrorCode) {
        super(messages[code]);
        this.code = code;
    }
}

export function nativeError(error: unknown): NativeFileError {
    if (error instanceof NativeFileError) return error;
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return new NativeFileError(
        code === 'ENOENT' || code === 'ENOTDIR'
            ? 'file-missing'
            : code === 'EACCES' || code === 'EPERM'
              ? 'permission-denied'
              : 'io-error',
    );
}

/** IPC errors must retain typed outcomes without exposing filesystem paths or stacks. */
export async function nativeResult<T>(operation: () => Promise<T>): Promise<NativeResult<T>> {
    try {
        return { ok: true, value: await operation() };
    } catch (error) {
        const safe = nativeError(error);
        return { ok: false, error: { code: safe.code, message: safe.message } };
    }
}

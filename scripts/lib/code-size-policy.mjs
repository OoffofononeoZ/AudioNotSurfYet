import path from 'node:path';
import { isHandwrittenCode } from './repository.mjs';

export const CODE_SIZE_LIMITS = Object.freeze({ recommended: 1000, warning: 1300, maximum: 2000 });

// Add an exact repository-relative path only after owner approval. Each value must
// contain { maxLines, reason, approval }, with approval identifying the decision.
// This workflow approval grants no individual file an exception.
export const CODE_SIZE_EXCEPTIONS = Object.freeze({});

function validException(entry) {
    return (
        entry !== null &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        Object.keys(entry).every(key => ['maxLines', 'reason', 'approval'].includes(key)) &&
        Number.isSafeInteger(entry.maxLines) &&
        entry.maxLines > CODE_SIZE_LIMITS.maximum &&
        typeof entry.reason === 'string' &&
        Boolean(entry.reason.trim()) &&
        typeof entry.approval === 'string' &&
        Boolean(entry.approval.trim())
    );
}

export function validateCodeSizeExceptions(exceptions = CODE_SIZE_EXCEPTIONS) {
    if (!exceptions || typeof exceptions !== 'object' || Array.isArray(exceptions)) {
        return ['代码规模例外必须是按具体仓库路径登记的对象。'];
    }
    const errors = [];
    for (const [file, entry] of Object.entries(exceptions)) {
        if (
            path.posix.isAbsolute(file) ||
            path.win32.isAbsolute(file) ||
            file.includes('\\') ||
            /[*?\[\]{}]/.test(file) ||
            file.startsWith('../') ||
            path.posix.normalize(file) !== file ||
            !isHandwrittenCode(file)
        ) {
            errors.push(`代码规模例外路径无效：${file}；只能登记具体手写代码文件，不接受通配符或排除路径。`);
        }
        if (!validException(entry)) {
            errors.push(
                `代码规模例外 ${file} 必须记录大于 ${CODE_SIZE_LIMITS.maximum} 的整数 maxLines、原因 reason 和 owner 批准来源 approval。`,
            );
        }
    }
    return errors;
}

export function inspectCodeSize(file, lines, exceptions = CODE_SIZE_EXCEPTIONS) {
    const errors = [],
        warnings = [];
    if (!isHandwrittenCode(file)) return { errors, warnings };
    const entry = exceptions && Object.hasOwn(exceptions, file) ? exceptions[file] : undefined;
    const approved = validException(entry);
    const maximum = approved ? entry.maxLines : CODE_SIZE_LIMITS.maximum;
    if (lines > maximum) {
        errors.push(
            approved
                ? `${file}：${lines} 行，超过 owner 已批准的 ${maximum} 行例外上限；须拆分或重新取得具体批准。`
                : `${file}：${lines} 行，超过 ${CODE_SIZE_LIMITS.maximum} 行上限；须正常排版后按职责拆分，极端特殊情况需 owner 明确批准具体文件。`,
        );
    } else if (lines > CODE_SIZE_LIMITS.warning) {
        warnings.push(
            `${file}：${lines} 行，超过 ${CODE_SIZE_LIMITS.warning} 行警告阈值，推荐不超过 ${CODE_SIZE_LIMITS.recommended} 行；请审阅职责，勿通过压行规避。` +
                (approved && lines > CODE_SIZE_LIMITS.maximum
                    ? ` 已获 ${entry.maxLines} 行例外：${entry.reason}（${entry.approval}）。`
                    : ''),
        );
    }
    return { errors, warnings };
}

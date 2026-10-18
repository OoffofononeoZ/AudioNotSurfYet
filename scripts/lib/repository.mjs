import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SOURCE_EXTENSIONS = /\.(?:vue|[cm]?js|[jt]sx?|ps1)$/i;
export const AREAS = [
    { id: 'audio', title: '音频播放与会话', prefix: 'src/audio/' },
    { id: 'analysis', title: '特征分析与 Worker', prefix: 'src/analysis/' },
    { id: 'editor', title: 'Editor 领域与工程', prefix: 'src/editor/' },
    { id: 'processing', title: 'FT 分离与处理', prefix: 'src/processing/' },
    { id: 'visualizer', title: 'Visualizer、场景与录制', prefix: 'src/visualizer/' },
    { id: 'ui', title: '页面、布局与组件' },
    { id: 'shared', title: '应用入口、状态与共享模块' },
    { id: 'tooling', title: '仓库工具' },
    { id: 'tests', title: '验证' },
];
const EXCLUDED =
    /(?:^|\/)(?:trash|node_modules|vendor|third_party|__generated__|dist|build|release|\.git|\.agents|artifacts|test-results|playwright-report)(?:\/|$)|\.generated\.|(?:^|\/)(?:auto-imports|components)\.d\.ts$/i;
export const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const normalize = value => value.replaceAll('\\', '/');

export function git(root, args) {
    return execFileSync('git', ['-c', `safe.directory=${normalize(path.resolve(root))}`, '-C', root, ...args], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

// Reject forbidden paths before inspecting them, and never follow descendant links.
export function contained(root, relative) {
    const base = path.resolve(root);
    const result = path.resolve(base, relative);
    const distance = path.relative(base, result);
    if (distance === '..' || distance.startsWith(`..${path.sep}`) || path.isAbsolute(distance)) {
        throw new Error(`路径超出仓库：${relative}`);
    }
    const segments = distance.split(path.sep).filter(Boolean);
    if (segments.some(part => part.toLowerCase() === 'trash')) throw new Error('禁止访问 trash/');
    let current = base;
    for (const part of segments) {
        current = path.join(current, part);
        try {
            if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`拒绝跟随仓库内链接：${relative}`);
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') break;
            throw error;
        }
    }
    return result;
}

export function readText(root, file) {
    const bytes = fs.readFileSync(contained(root, file));
    return new TextDecoder('utf-8', { fatal: true })
        .decode(bytes)
        .replace(/^\uFEFF/, '')
        .replaceAll('\r\n', '\n');
}

export function listFiles(root) {
    const files = git(root, [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '-z',
        '--',
        '.',
        ':(exclude)trash',
        ':(exclude)**/trash/**',
    ]).split('\0');
    return [...new Set(files.filter(Boolean).map(normalize))]
        .filter(file => {
            if (EXCLUDED.test(file)) return false;
            const target = contained(root, file);
            return fs.existsSync(target) && fs.lstatSync(target).isFile();
        })
        .sort(byText);
}

export function areaOf(file) {
    if (!SOURCE_EXTENSIONS.test(file) || EXCLUDED.test(file)) return null;
    if (file.startsWith('scripts/') || /^skills\/[^/]+\/scripts\//.test(file)) return 'tooling';
    if (file.startsWith('tests/')) return 'tests';
    const domain = AREAS.find(area => area.prefix && file.startsWith(area.prefix));
    if (domain) return domain.id;
    if (/^src\/(?:components|views|layouts)\//.test(file)) return 'ui';
    return file.startsWith('src/') ? 'shared' : null;
}

export function isHandwrittenCode(file) {
    return !EXCLUDED.test(file) && (SOURCE_EXTENSIONS.test(file) || /\.(?:css|scss|less|html)$/i.test(file));
}

export function lineCount(text) {
    const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    return normalized ? normalized.split('\n').length - (normalized.endsWith('\n') ? 1 : 0) : 0;
}

export function markdownLink(from, target, label = target) {
    const relative = path.posix.relative(path.posix.dirname(from), target);
    const url = relative.split('/').map(encodeURIComponent).join('/');
    return `[${label.replaceAll('|', '\\|').replaceAll('[', '\\[').replaceAll(']', '\\]')}](${url})`;
}

// Required scalar fields only; supported optional metadata stays in its source.
export function skillMetadata(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!match) throw new Error('缺少有效的 YAML frontmatter');
    const result = {};
    for (const line of match[1].split('\n')) {
        const field = line.match(/^(name|description):\s*(.+)$/);
        if (!field) continue;
        if (Object.hasOwn(result, field[1])) throw new Error(`重复元数据：${field[1]}`);
        const raw = field[2].trim();
        if (raw.startsWith('"')) result[field[1]] = JSON.parse(raw);
        else if (raw.startsWith("'") && raw.endsWith("'")) result[field[1]] = raw.slice(1, -1).replaceAll("''", "'");
        else {
            if (/^[>|!&*\[{]/.test(raw) || /:\s/.test(raw)) throw new Error('必填元数据请使用单行字符串');
            result[field[1]] = raw;
        }
        if (typeof result[field[1]] !== 'string') throw new Error('元数据必须是字符串');
    }
    if (!result.name?.trim() || !result.description?.trim()) throw new Error('name 和 description 不能为空');
    return result;
}

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    ROOT,
    isHandwrittenCode,
    contained,
    lineCount,
    listFiles,
    readText,
    skillMetadata,
} from './lib/repository.mjs';
import { CODE_SIZE_EXCEPTIONS, inspectCodeSize, validateCodeSizeExceptions } from './lib/code-size-policy.mjs';
import { MARKER as MAP_MARKER, staleMaps } from './codemap.mjs';
import { installProjectSkills } from './install-project-skills.mjs';

export const DOCUMENT_SIZE_LIMITS = Object.freeze({ recommended: 500, prohibited: 800 });

export function inspectDocumentSize(file, text) {
    const errors = [],
        warnings = [];
    const generatedMap =
        (file === 'docs/CODEMAP.md' || /^docs\/codemap\/[^/]+\.md$/.test(file)) && text.startsWith(MAP_MARKER);
    if (generatedMap) return { errors, warnings };
    const lines = lineCount(text);
    if (lines >= DOCUMENT_SIZE_LIMITS.prohibited) {
        errors.push(
            `${file}：${lines} 行，达到 ${DOCUMENT_SIZE_LIMITS.prohibited} 行禁止提交阈值；须精简文字，不能通过压行规避。若可能丢失关键信息，须汇报并停止提交。`,
        );
    } else if (lines > DOCUMENT_SIZE_LIMITS.recommended) {
        warnings.push(
            `${file}：${lines} 行，超过 ${DOCUMENT_SIZE_LIMITS.recommended} 行建议值；请审阅冗余并精简文字，保留关键信息与正常排版。`,
        );
    }
    return { errors, warnings };
}

function prose(text) {
    const output = [];
    let fence;
    for (const line of text.split('\n')) {
        const marker = line.match(/^\s*(`{3,}|~{3,})/);
        if (marker) {
            if (!fence) fence = marker[1];
            else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
            continue;
        }
        if (!fence) output.push(line.replace(/`+[^`]*`+/g, ''));
    }
    return output.join('\n');
}

export function localLinks(text) {
    const content = prose(text);
    const inline = [...content.matchAll(/!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/g)].map(
        match => match[1] ?? match[2],
    );
    const definitions = [...content.matchAll(/^\s*\[(?!\^)[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm)].map(
        match => match[1] ?? match[2],
    );
    return [...inline, ...definitions].filter(target => !/^(?:[a-z][\w+.-]*:|#|\/\/)/i.test(target));
}

export function inspectDocuments(root, files = listFiles(root)) {
    const errors = [],
        warnings = [];
    let count = 0;
    for (const file of files.filter(file => file.endsWith('.md'))) {
        count++;
        const text = readText(root, file);
        const size = inspectDocumentSize(file, text);
        errors.push(...size.errors);
        warnings.push(...size.warnings);
        for (const target of localLinks(text)) {
            try {
                const decoded = decodeURIComponent(target.split(/[?#]/)[0]);
                if (!decoded) continue;
                const resolved = contained(root, path.join(path.dirname(file), decoded));
                if (!fs.existsSync(resolved)) errors.push(`${file}：本地链接不存在 ${target}`);
            } catch (error) {
                errors.push(`${file}：无效本地链接 ${target}（${error.message}）`);
            }
        }
    }
    return { errors, warnings, count };
}

export function inspectRepository(root, { codeSizeExceptions = CODE_SIZE_EXCEPTIONS } = {}) {
    const files = listFiles(root);
    const { errors, warnings } = inspectDocuments(root, files);
    const agentText = files.includes('AGENTS.md') ? readText(root, 'AGENTS.md') : '';
    const skills = files.filter(file => /^skills\/[^/]+\/SKILL\.md$/.test(file));
    if (!agentText) errors.push('缺少 AGENTS.md');
    errors.push(...validateCodeSizeExceptions(codeSizeExceptions));
    for (const file of files) {
        const isSource = isHandwrittenCode(file);
        const isMarkdown = file.endsWith('.md');
        if (!isSource && !isMarkdown) continue;
        const text = readText(root, file);
        const lines = lineCount(text);
        if (isSource) {
            const size = inspectCodeSize(file, lines, codeSizeExceptions);
            errors.push(...size.errors);
            warnings.push(...size.warnings);
        }
        if (!skills.includes(file)) continue;
        try {
            const metadata = skillMetadata(text);
            const directory = file.split('/')[1];
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name) || metadata.name.length > 64)
                errors.push(`${file}：skill 名称不合法`);
            if (metadata.name !== directory) errors.push(`${file}：name 与目录名称不一致`);
            if (
                metadata.description.length > 1024 ||
                /[<>]/.test(metadata.description) ||
                metadata.description.startsWith('[TODO:')
            )
                errors.push(`${file}：description 不合法或未完成`);
            if (!agentText.includes(`skills/${directory}/SKILL.md`)) errors.push(`${file}：AGENTS.md 未提供入口`);
        } catch (error) {
            errors.push(`${file}：${error.message}`);
        }
    }
    for (const file of staleMaps(root)) errors.push(`代码地图过期：${file}；运行 npm run codemap`);
    try {
        installProjectSkills(root, true);
    } catch (error) {
        errors.push(error.message);
    }
    return { errors, warnings, fileCount: files.length, skillCount: skills.length };
}

export function main() {
    const result = inspectRepository(ROOT);
    for (const warning of result.warnings.slice(0, 20)) console.warn(`提示：${warning}`);
    if (result.warnings.length > 20)
        console.warn(`另有 ${result.warnings.length - 20} 项规模提示；本次不批量重构或删减历史文档。`);
    for (const error of result.errors) console.error(`错误：${error}`);
    if (!result.errors.length)
        console.log(
            `仓库检查通过：${result.fileCount} 个文件，${result.skillCount} 个 skills；${result.warnings.length} 项非阻断规模提示。`,
        );
    return result.errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try {
        process.exitCode = main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

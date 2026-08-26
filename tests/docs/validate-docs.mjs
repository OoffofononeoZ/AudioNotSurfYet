import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const DOCS_ROOT = path.join(REPOSITORY_ROOT, 'docs');
const REQUIRED_FRONTMATTER = [
    'status',
    'owner',
    'last_reviewed',
    'upstream_docs',
    'next_action',
];
const ALLOWED_STATUS = new Set(['draft', 'in-review', 'approved', 'superseded', 'archived']);

async function walkMarkdown(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await walkMarkdown(entryPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(entryPath);
        }
    }
    return files;
}

function extractFrontmatter(content, filePath) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) {
        throw new Error(`${filePath}: missing leading frontmatter`);
    }
    return match[1];
}

function frontmatterValue(frontmatter, key) {
    return frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.replace(/^"|"$/g, '');
}

async function validateLinks(filePath, content, errors) {
    const linkPattern = /\[[^\]]*]\(([^)]+)\)/g;
    for (const match of content.matchAll(linkPattern)) {
        const rawTarget = match[1]?.trim();
        if (!rawTarget || /^(https?:|mailto:|#)/.test(rawTarget)) {
            continue;
        }
        const targetWithoutTitle = rawTarget.split(/\s+"/)[0] ?? rawTarget;
        const normalized = decodeURIComponent(
            targetWithoutTitle.replace(/^<|>$/g, '').split('#')[0] ?? '',
        );
        if (!normalized) {
            continue;
        }
        const target = path.resolve(path.dirname(filePath), normalized);
        try {
            await stat(target);
        } catch {
            errors.push(`${path.relative(REPOSITORY_ROOT, filePath)}: broken link ${rawTarget}`);
        }
    }
}

const errors = [];
for (const filePath of await walkMarkdown(DOCS_ROOT)) {
    const content = await readFile(filePath, 'utf8');
    let frontmatter;
    try {
        frontmatter = extractFrontmatter(content, path.relative(REPOSITORY_ROOT, filePath));
    } catch (error) {
        errors.push(error.message);
        continue;
    }
    for (const field of REQUIRED_FRONTMATTER) {
        if (!new RegExp(`^${field}:`, 'm').test(frontmatter)) {
            errors.push(`${path.relative(REPOSITORY_ROOT, filePath)}: missing ${field}`);
        }
    }
    const statusValue = frontmatterValue(frontmatter, 'status');
    if (!statusValue || !ALLOWED_STATUS.has(statusValue)) {
        errors.push(`${path.relative(REPOSITORY_ROOT, filePath)}: invalid status ${statusValue}`);
    }
    await validateLinks(filePath, content, errors);
}

const testsReadmePath = path.join(REPOSITORY_ROOT, 'tests/README.md');
await validateLinks(testsReadmePath, await readFile(testsReadmePath, 'utf8'), errors);

const analyzerData = await readFile(
    path.join(REPOSITORY_ROOT, 'src/data/analyzerData.ts'),
    'utf8',
);
const featureCount = analyzerData.match(/^\s*abbreviation:\s*['"][^'"]+['"],?$/gm)?.length ?? 0;
if (featureCount !== 21) {
    errors.push(`src/data/analyzerData.ts: expected 21 feature entries, found ${featureCount}`);
}

const readinessPath = path.join(DOCS_ROOT, 'quality/release-readiness.md');
let readinessExists = true;
try {
    await stat(readinessPath);
} catch (error) {
    if (error?.code === 'ENOENT') {
        readinessExists = false;
    } else {
        errors.push(`docs/quality/release-readiness.md: unable to inspect (${error.message})`);
    }
}

if (readinessExists) {
    const [evidenceIndex, milestonePlan, readiness] = await Promise.all([
        readFile(path.join(DOCS_ROOT, 'quality/evidence-index.md'), 'utf8'),
        readFile(path.join(DOCS_ROOT, 'delivery/milestone-plan.md'), 'utf8'),
        readFile(readinessPath, 'utf8'),
    ]);
    if (!/## 14\. M11 Canonical Run Record[\s\S]*?\| Evidence state \| `approved` \|/.test(evidenceIndex)) {
        errors.push('docs/quality/release-readiness.md exists before approved M11 evidence');
    }
    if (!/^\| M11 \| Cross-cutting hardening \| Complete \|/m.test(milestonePlan)) {
        errors.push('docs/quality/release-readiness.md exists before M11 is Complete');
    }
    for (const requiredSection of [
        '## Summary Decision',
        '## Coverage Summary',
        '## Blockers',
        '## Proposed Waivers',
    ]) {
        if (!readiness.includes(requiredSection)) {
            errors.push(`docs/quality/release-readiness.md: missing ${requiredSection}`);
        }
    }
}

if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
}

console.log(`Validated lifecycle frontmatter and links; analyzer feature count is ${featureCount}.`);

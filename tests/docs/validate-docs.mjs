import { ROOT } from '../../scripts/lib/repository.mjs';
import { inspectDocuments } from '../../scripts/check-repo.mjs';

// Links and document size share the repository rules; lifecycle metadata is optional.
try {
    const result = inspectDocuments(ROOT);
    for (const warning of result.warnings) console.warn(`提示：${warning}`);
    if (result.errors.length) {
        console.error(result.errors.join('\n'));
        process.exitCode = 1;
    } else console.log(`Validated local links and size limits in ${result.count} Markdown documents.`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}

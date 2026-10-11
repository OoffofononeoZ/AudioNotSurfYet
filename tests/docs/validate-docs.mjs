import { ROOT } from '../../scripts/lib/repository.mjs';
import { inspectDocuments } from '../../scripts/check-repo.mjs';

// Documents are maintained on demand; historical lifecycle metadata is optional.
try {
  const result = inspectDocuments(ROOT);
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  } else console.log(`Validated local links in ${result.count} Markdown documents.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

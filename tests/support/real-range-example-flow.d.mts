import type { Page } from '@playwright/test';
import type { ExampleMatch } from '../../src/transcription/examples/types';
export function exerciseRealRangeExamples(
    page: Page,
    referenceFile: string,
    directory: string,
    sourceHash: string,
): Promise<
    Array<{
        exampleStart: number;
        targetStart: number;
        best: ExampleMatch | null;
        startErrorSeconds: number | null;
        endErrorSeconds: number | null;
    }>
>;

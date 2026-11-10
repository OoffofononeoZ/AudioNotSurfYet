import type { Page } from '@playwright/test';
import type { ExampleProfile } from '../../src/transcription/examples/types';
export function storedExampleProfiles(page: Page): Promise<ExampleProfile[]>;
export function exerciseStoredSoundExamples(
    page: Page,
    eventCount: () => Promise<number>,
): Promise<{
    sources: Array<{ label: string; profileId: string; sourceKey: string; matches: number }>;
    applied: number;
}>;

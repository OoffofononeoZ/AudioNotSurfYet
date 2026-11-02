import type { Page } from '@playwright/test';
export function verifyTimelineAlignment(
    page: Page,
    resize: (width: number, height: number) => Promise<unknown>,
    screenshot?: (name: string) => Promise<unknown>,
): Promise<void>;
export function timelineRange(page: Page): Promise<{ start: number; end: number }>;
export function verifyIndependentTimeline(page: Page): Promise<void>;

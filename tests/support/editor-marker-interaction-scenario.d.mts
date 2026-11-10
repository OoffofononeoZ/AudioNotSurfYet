import type { Page } from '@playwright/test';
export function verifyMarkerInteractions(page: Page, screenshot?: (name: string) => Promise<unknown>): Promise<void>;

import type { Page } from '@playwright/test';
export function verifyWaveformPixels(
    page: Page,
    selector: string,
    mirror?: boolean,
    panelSelector?: string,
): Promise<{ colored: number; symmetryError: number; dpr: number; width: number; height: number }>;

import type { Page } from '@playwright/test';

export function writePitchFixture(file: string): Promise<void>;
export function installPlaybackPitchProbe(page: Page): Promise<void>;
export function readPlaybackPitch(page: Page): Promise<{ frequency: number; decibels: number }>;
export function verifyPlaybackPitchControls(
    page: Page,
): Promise<Array<{ rate: number; changesPitch: boolean; frequency: number; decibels: number }>>;

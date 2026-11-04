import type { Page } from '@playwright/test';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
export function tooltipText(label: string): string;
export function tooltipProject(project: VisualizerProjectV6): VisualizerProjectV6;
export function runTooltipScenario(
    page: Page,
    io: {
        readProject(): Promise<VisualizerProjectV6>;
        lastProject(): Promise<VisualizerProjectV6>;
        importProject(project: VisualizerProjectV6): Promise<void>;
        resizeViewport(width: number, height: number): Promise<void>;
        screenshot(name: string): Promise<void>;
    },
): Promise<{ fields: string[]; placements: Array<string | null>; persisted: boolean }>;

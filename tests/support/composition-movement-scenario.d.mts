import type { Page } from '@playwright/test';
import type { VisualizerElement, VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import type { PresetInstance } from '../../src/visualizer/resourceTypes';

export interface MovementResult {
    frames: number;
    pixel: number[];
    project: VisualizerProjectV6;
    sceneId: string;
}
export function movementFixture(source: VisualizerProjectV6): {
    p: VisualizerProjectV6;
    group: PresetInstance;
    red: VisualizerElement;
    green: VisualizerElement;
    blue: VisualizerElement;
};
export function runCompositionMovement(
    page: Page,
    io: {
        readProject(): Promise<VisualizerProjectV6>;
        importProject(project: VisualizerProjectV6): Promise<void>;
        resizeViewport(width: number, height: number): Promise<void>;
        screenshot(name: string): Promise<void>;
        saveVideo(): Promise<string>;
    },
): Promise<MovementResult>;
export function writeMovementCapture(
    file: string,
    result: MovementResult,
    browser: string,
    version: string,
): Promise<void>;

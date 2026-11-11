import * as THREE from 'three';
import type { PersistedTimelineViewport } from '../types/session';

export const THREE_D_TIME_WIDTH = 10;
export const threeDTimeX = (seconds: number, viewport: PersistedTimelineViewport): number =>
    -5 + (THREE_D_TIME_WIDTH * (seconds - viewport.startSeconds)) / (viewport.endSeconds - viewport.startSeconds);

/** Conservative interval: every visible surface point lies inside these time bounds. */
export function projectedTimeRange(
    camera: THREE.Camera,
    root: THREE.Object3D,
    viewport: PersistedTimelineViewport,
    duration: number,
    slice: boolean,
): { startSeconds: number; endSeconds: number } | null {
    root.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const matrix = new THREE.Matrix4()
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        .multiply(root.matrixWorld);
    const planes = new THREE.Frustum().setFromProjectionMatrix(matrix).planes;
    let left = threeDTimeX(0, viewport),
        right = threeDTimeX(duration, viewport);
    for (const plane of planes) {
        const { x, y, z } = plane.normal;
        const support = plane.constant + Math.abs(y) * 2 + (slice ? 0 : Math.abs(z) * 2.65);
        if (Math.abs(x) < 1e-10) {
            if (support < 0) return null;
        } else if (x > 0) left = Math.max(left, -support / x);
        else right = Math.min(right, -support / x);
    }
    if (right <= left) return null;
    const time = (x: number) =>
        viewport.startSeconds + ((x + 5) / THREE_D_TIME_WIDTH) * (viewport.endSeconds - viewport.startSeconds);
    return { startSeconds: Math.max(0, time(left)), endSeconds: Math.min(duration, time(right)) };
}

import { expect, it } from 'vitest';
import * as THREE from 'three';
import { projectedTimeRange, threeDTimeX } from '../../src/analysis/threeDProjection';

it('projects song data outside the saved time window after camera pan', () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, 0.1, 1000);
    camera.position.z = 18;
    const root = new THREE.Group();
    const viewport = { startSeconds: 40, endSeconds: 50, zoom: 10 };
    expect(projectedTimeRange(camera, root, viewport, 100, true)).toEqual({ startSeconds: 40, endSeconds: 50 });
    root.position.x = -30;
    expect(projectedTimeRange(camera, root, viewport, 100, true)).toEqual({ startSeconds: 70, endSeconds: 80 });
    expect(threeDTimeX(0, viewport)).toBe(-45);
    expect(threeDTimeX(100, viewport)).toBe(55);
    root.position.y = 100;
    expect(projectedTimeRange(camera, root, viewport, 100, false)).toBeNull();
});

it('conservatively includes every visible point under perspective rotation', () => {
    const camera = new THREE.PerspectiveCamera(38, 1.7, 0.1, 1000);
    camera.position.z = 18;
    const root = new THREE.Group();
    root.rotation.set(-0.48, 0.58, -0.06);
    const viewport = { startSeconds: 40, endSeconds: 50, zoom: 10 };
    const range = projectedTimeRange(camera, root, viewport, 100, false)!;
    for (let t = 0; t <= 100; t += 0.25)
        for (const y of [-2, 0, 2])
            for (const z of [-2.65, 0, 2.65]) {
                const p = new THREE.Vector3(threeDTimeX(t, viewport), y, z)
                    .applyMatrix4(root.matrixWorld)
                    .project(camera);
                if (Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && Math.abs(p.z) <= 1) {
                    expect(t).toBeGreaterThanOrEqual(range.startSeconds - 1e-9);
                    expect(t).toBeLessThanOrEqual(range.endSeconds + 1e-9);
                }
            }
});

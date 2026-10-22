import * as THREE from 'three';
import { AlgorithmDrawRenderer } from './algorithmDrawRenderer';
import type { VisualizerRenderer } from './rendererTypes';
import type { ResourceSnapshot } from './resourceTypes';
import type { DrawPass, UniformValue } from './algorithmTypes';

/** Compile candidates offscreen on the existing renderer without replacing the active scene. */
export function validateAlgorithmPrograms(renderer: VisualizerRenderer, resources: ResourceSnapshot): void {
    const gpu = new AlgorithmDrawRenderer(),
        target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const current = (renderer as THREE.WebGLRenderer).getRenderTarget();
    try {
        gpu.resize(1, 1);
        renderer.setRenderTarget(target);
        for (const algorithm of resources.algorithms)
            for (const [name, program] of Object.entries(algorithm.programs)) {
                const uniforms: Record<string, UniformValue> = {};
                for (const [id, spec] of Object.entries(program.uniforms)) {
                    uniforms[id] =
                        spec.type === 'media'
                            ? spec.inputId!
                            : spec.type === 'source'
                              ? 'source'
                              : spec.type === 'color'
                                ? '#000000'
                                : spec.type === 'boolean'
                                  ? false
                                  : spec.type === 'vec2'
                                    ? [0, 0]
                                    : spec.type === 'vec3'
                                      ? [0, 0, 0]
                                      : spec.type === 'array'
                                        ? Array(spec.length).fill(0)
                                        : 0;
                }
                const pass: DrawPass = {
                    program: name,
                    uniforms,
                    ...(program.geometry === 'triangles'
                        ? {
                              mesh: {
                                  positions: new Float32Array(9),
                                  colors: new Float32Array(12),
                                  edges: new Float32Array(6),
                              },
                          }
                        : {}),
                };
                gpu.draw(renderer, algorithm, pass);
            }
    } finally {
        renderer.setRenderTarget(current);
        gpu.dispose();
        target.dispose();
    }
}

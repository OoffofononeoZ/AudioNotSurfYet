import * as THREE from 'three';
import type { AlgorithmDefinition, DrawPass, ShaderProgram } from './algorithmTypes';
import type { CompositionRenderPort } from './compositionScene';
interface Surface {
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    material: THREE.ShaderMaterial;
    geometry: THREE.BufferGeometry;
    program: ShaderProgram;
}
/** GPU resources are owned here, never exposed to an algorithm. */
export class AlgorithmDrawRenderer {
    private surfaces = new Map<string, Surface>();
    private width = 1;
    private height = 1;
    resize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
    draw(renderer: CompositionRenderPort, algorithm: AlgorithmDefinition, pass: DrawPass, source?: THREE.Texture) {
        const key = algorithm.hash + ':' + pass.program;
        let surface = this.surfaces.get(key);
        if (!surface) {
            const program = algorithm.programs[pass.program]!;
            const triangles = program.geometry === 'triangles';
            const geometry = triangles ? new THREE.BufferGeometry() : new THREE.PlaneGeometry(2, 2);
            if (triangles)
                for (const [name, size] of [
                    ['position', 3],
                    ['ink', 4],
                    ['edge', 2],
                ] as const)
                    geometry.setAttribute(
                        name,
                        new THREE.BufferAttribute(new Float32Array(65536 * size), size).setUsage(
                            THREE.DynamicDrawUsage,
                        ),
                    );
            const uniforms = Object.fromEntries(Object.keys(program.uniforms).map(name => [name, { value: null }]));
            const material = new THREE.ShaderMaterial({
                vertexShader: program.vertex,
                fragmentShader: program.fragment,
                uniforms,
                transparent: triangles,
                premultipliedAlpha: triangles,
                depthTest: false,
                depthWrite: false,
                side: triangles ? THREE.DoubleSide : THREE.FrontSide,
                toneMapped: false,
            });
            const camera = triangles
                ? new THREE.OrthographicCamera(-1, 1, -0.5, 0.5, -1, 1)
                : new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            const scene = new THREE.Scene(),
                mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            scene.add(mesh);
            surface = { scene, camera, material, geometry, program };
            this.surfaces.set(key, surface);
        }
        for (const [name, specification] of Object.entries(surface.program.uniforms)) {
            const value = pass.uniforms[name]!;
            surface.material.uniforms[name]!.value =
                specification.type === 'source'
                    ? (source ?? null)
                    : specification.type === 'color'
                      ? new THREE.Color().setStyle(String(value), THREE.LinearSRGBColorSpace)
                      : specification.type === 'vec2'
                        ? new THREE.Vector2(...(value as [number, number]))
                        : specification.type === 'vec3'
                          ? new THREE.Vector3(...(value as [number, number, number]))
                          : specification.type === 'array'
                            ? new Float32Array(value as number[])
                            : value;
        }
        if (pass.mesh) {
            for (const [name, field] of [
                ['position', 'positions'],
                ['ink', 'colors'],
                ['edge', 'edges'],
            ] as const) {
                const attribute = surface.geometry.getAttribute(name) as THREE.BufferAttribute;
                (attribute.array as Float32Array).set(pass.mesh[field]);
                attribute.clearUpdateRanges();
                attribute.addUpdateRange(0, pass.mesh[field].length);
                attribute.needsUpdate = true;
            }
            surface.geometry.setDrawRange(0, pass.mesh.positions.length / 3);
            const aspect = this.width / this.height;
            surface.camera.left = -aspect / 2;
            surface.camera.right = aspect / 2;
            surface.camera.updateProjectionMatrix();
        }
        surface.material.uniformsNeedUpdate = true;
        const debug = (renderer as unknown as THREE.WebGLRenderer).debug;
        const previous = debug?.onShaderError;
        if (debug)
            debug.onShaderError = () => {
                throw Error('资源包 Shader 编译或链接失败。');
            };
        try {
            renderer.render(surface.scene, surface.camera);
        } finally {
            if (debug) debug.onShaderError = previous;
        }
    }
    dispose() {
        for (const surface of this.surfaces.values()) {
            surface.geometry.dispose();
            surface.material.dispose();
            surface.scene.clear();
        }
        this.surfaces.clear();
    }
}

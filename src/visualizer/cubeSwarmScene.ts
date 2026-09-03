import * as THREE from 'three';
import {
    CUBE_SWARM_CORE_COUNT,
    CUBE_SWARM_MAX_PERIPHERAL_COUNT,
    CubeSwarmFrameStateResolver,
} from './cubeSwarmState';
import type {
    VisualizerScene,
    VisualizerSceneFactory,
    VisualizerSceneFrameSnapshot,
    VisualizerSceneHost,
    VisualizerSceneRenderInput,
} from './rendererTypes';

const CORE_TRANSFORMS = Array.from({ length: CUBE_SWARM_CORE_COUNT }, (_, index) => {
    const angle = index / CUBE_SWARM_CORE_COUNT * Math.PI * 2;
    return { angle, cosine: Math.cos(angle), sine: Math.sin(angle) };
});

export class CubeSwarmScene implements VisualizerScene {
    readonly kind = 'rendered' as const;
    private readonly host: VisualizerSceneHost;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 400);
    private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
    private readonly coreMaterial = new THREE.MeshStandardMaterial({
        color: '#f3ebef',
        roughness: 0.42,
        metalness: 0.2,
    });
    private readonly peripheralMaterial = new THREE.MeshStandardMaterial({
        color: '#d8c7d1',
        roughness: 0.62,
        metalness: 0.08,
    });
    private readonly core = new THREE.InstancedMesh(
        this.geometry,
        this.coreMaterial,
        CUBE_SWARM_CORE_COUNT,
    );
    private readonly peripheral = new THREE.InstancedMesh(
        this.geometry,
        this.peripheralMaterial,
        CUBE_SWARM_MAX_PERIPHERAL_COUNT,
    );
    private readonly satellites = new THREE.InstancedMesh(
        this.geometry,
        this.coreMaterial,
        3,
    );
    private readonly stateResolver: CubeSwarmFrameStateResolver;
    private readonly transform = new THREE.Object3D();
    private readonly matrix = new THREE.Matrix4();
    private lastCoreColor: string | null = null;
    private lastPeripheralColor: string | null = null;
    private lastBackgroundColor: string | null = null;
    private lastCameraBaseSize: number | null = null;
    private lastCameraDistance: number | null = null;
    private disposed = false;

    constructor(host: VisualizerSceneHost, seed: number) {
        this.host = host;
        this.stateResolver = new CubeSwarmFrameStateResolver(seed);
        this.core.count = CUBE_SWARM_CORE_COUNT;
        this.satellites.count = 3;
        this.core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.peripheral.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.satellites.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const ambient = new THREE.AmbientLight('#ffffff', 1.35);
        const key = new THREE.DirectionalLight('#ffffff', 2.1);
        key.position.set(3, 5, 7);
        const fill = new THREE.DirectionalLight('#88b8ff', 0.75);
        fill.position.set(-4, -2, 5);
        this.scene.add(ambient, key, fill, this.core, this.peripheral, this.satellites);
        this.host.renderer.setClearColor('#020403', 1);
    }

    render(input: VisualizerSceneRenderInput): VisualizerSceneFrameSnapshot {
        if (this.disposed) throw new Error('立方体群场景已释放。');
        const state = this.stateResolver.resolve(
            input.timeSeconds,
            input.bindingRevision,
            input.values,
            (timeSeconds) => this.host.resolveValuesAt(timeSeconds),
        );
        const base = state.baseSize;
        const visualScale = state.coreVisualScale;
        for (let index = 0; index < CUBE_SWARM_CORE_COUNT; index += 1) {
            const coreTransform = CORE_TRANSFORMS[index]!;
            const length = base * (0.12 + 0.68 * (state.coreAmplitudes[index] ?? 0));
            const cross = base * 0.08;
            const radius = base * 0.85;
            const scaledLength = length * visualScale;
            const scaledCross = cross * visualScale;
            this.matrix.set(
                coreTransform.cosine * scaledLength,
                -coreTransform.sine * scaledCross,
                0,
                coreTransform.cosine * radius * visualScale,
                coreTransform.sine * scaledLength,
                coreTransform.cosine * scaledCross,
                0,
                coreTransform.sine * radius * visualScale,
                0,
                0,
                scaledCross,
                0,
                0,
                0,
                0,
                1,
            );
            this.core.setMatrixAt(index, this.matrix);
        }
        this.core.instanceMatrix.needsUpdate = true;

        this.peripheral.count = state.peripheral.length;
        state.peripheral.forEach((item, index) => {
            this.transform.position.set(item.x, item.y, item.z);
            this.transform.rotation.set(item.rotationX, item.rotationY, item.rotationZ);
            this.transform.scale.setScalar(item.size);
            this.transform.updateMatrix();
            this.peripheral.setMatrixAt(index, this.transform.matrix);
        });
        this.peripheral.instanceMatrix.needsUpdate = true;

        state.satellites.forEach((item, index) => {
            this.transform.position.set(item.x, item.y, item.z);
            this.transform.rotation.set(item.angle, item.angle * 0.7, item.angle * 0.4);
            this.transform.scale.setScalar(item.size);
            this.transform.updateMatrix();
            this.satellites.setMatrixAt(index, this.transform.matrix);
        });
        this.satellites.instanceMatrix.needsUpdate = true;

        if (state.coreColor !== this.lastCoreColor) {
            this.coreMaterial.color.set(state.coreColor);
            this.lastCoreColor = state.coreColor;
        }
        if (state.peripheralColor !== this.lastPeripheralColor) {
            this.peripheralMaterial.color.set(state.peripheralColor);
            this.lastPeripheralColor = state.peripheralColor;
        }
        if (state.backgroundColor !== this.lastBackgroundColor) {
            this.host.renderer.setClearColor(state.backgroundColor, 1);
            this.lastBackgroundColor = state.backgroundColor;
        }
        if (
            base !== this.lastCameraBaseSize
            || state.cameraDistance !== this.lastCameraDistance
        ) {
            this.camera.position.set(0, 0.8 * base, state.cameraDistance);
            this.camera.far = Math.max(100, state.cameraDistance * 4);
            this.camera.lookAt(0, 0, 0);
            this.camera.updateProjectionMatrix();
            this.lastCameraBaseSize = base;
            this.lastCameraDistance = state.cameraDistance;
        }
        this.host.renderer.render(this.scene, this.camera);
        return { hash: state.hash, needsSourcePrompt: false };
    }

    resize(width: number, height: number, _dpr: number): void {
        this.camera.aspect = Math.max(1, width) / Math.max(1, height);
        this.camera.updateProjectionMatrix();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.geometry.dispose();
        this.coreMaterial.dispose();
        this.peripheralMaterial.dispose();
        this.stateResolver.reset();
        this.scene.clear();
    }
}

export const createCubeSwarmScene: VisualizerSceneFactory = (host, seed) =>
    new CubeSwarmScene(host, seed);

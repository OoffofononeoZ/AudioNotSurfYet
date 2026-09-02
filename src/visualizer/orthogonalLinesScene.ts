import * as THREE from 'three';
import { OrthogonalLinesFrameStateResolver } from './orthogonalLinesState';
import type {
    VisualizerScene,
    VisualizerSceneFactory,
    VisualizerSceneFrameSnapshot,
    VisualizerSceneHost,
    VisualizerSceneRenderInput,
} from './rendererTypes';

const vertexShader = `
    void main() {
        gl_Position = vec4(position, 1.0);
    }
`;

const fragmentShader = `
    precision highp float;
    uniform vec2 uViewport;
    uniform vec3 uHorizontalColor;
    uniform vec3 uVerticalColor;
    uniform vec4 uHorizontalShape;
    uniform vec4 uVerticalShape;
    uniform float uHorizontalHaloAlpha;
    uniform float uVerticalHaloAlpha;

    float centeredSegment(vec2 point, float halfLength, float halfThickness, bool horizontal) {
        vec2 axis = horizontal ? vec2(abs(point.x), abs(point.y)) : vec2(abs(point.y), abs(point.x));
        return step(axis.x, halfLength) * step(axis.y, halfThickness);
    }

    void main() {
        vec2 point = gl_FragCoord.xy - uViewport * 0.5;
        float horizontalMain = centeredSegment(
            point,
            uViewport.x * 0.5 * uHorizontalShape.x,
            uHorizontalShape.y * 0.5,
            true
        ) * uHorizontalShape.z;
        float verticalMain = centeredSegment(
            point,
            uViewport.y * 0.5 * uVerticalShape.x,
            uVerticalShape.y * 0.5,
            false
        ) * uVerticalShape.z;
        float horizontalHalo = centeredSegment(
            point,
            uViewport.x * 0.5 * uHorizontalShape.x,
            uHorizontalShape.w * 0.5,
            true
        ) * uHorizontalHaloAlpha;
        float verticalHalo = centeredSegment(
            point,
            uViewport.y * 0.5 * uVerticalShape.x,
            uVerticalShape.w * 0.5,
            false
        ) * uVerticalHaloAlpha;
        vec3 background = vec3(2.0 / 255.0, 4.0 / 255.0, 3.0 / 255.0);
        vec3 additive = uHorizontalColor * (horizontalMain + horizontalHalo)
            + uVerticalColor * (verticalMain + verticalHalo);
        gl_FragColor = vec4(background + additive, 1.0);
    }
`;

export class OrthogonalLinesScene implements VisualizerScene {
    readonly kind = 'rendered' as const;
    private readonly host: VisualizerSceneHost;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private readonly geometry = new THREE.PlaneGeometry(2, 2);
    private readonly material: THREE.ShaderMaterial;
    private readonly stateResolver = new OrthogonalLinesFrameStateResolver();
    private width = 1;
    private height = 1;
    private dpr = 1;
    private disposed = false;

    constructor(host: VisualizerSceneHost, _seed: number) {
        this.host = host;
        this.material = new THREE.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            vertexShader,
            fragmentShader,
            uniforms: {
                uViewport: { value: new THREE.Vector2(1, 1) },
                uHorizontalColor: { value: new THREE.Color('#64f6b5') },
                uVerticalColor: { value: new THREE.Color('#f4f7f5') },
                uHorizontalShape: { value: new THREE.Vector4() },
                uVerticalShape: { value: new THREE.Vector4() },
                uHorizontalHaloAlpha: { value: 0 },
                uVerticalHaloAlpha: { value: 0 },
            },
        });
        const quad = new THREE.Mesh(this.geometry, this.material);
        quad.frustumCulled = false;
        this.scene.add(quad);
        this.host.renderer.setClearColor('#020403', 1);
    }

    render(input: VisualizerSceneRenderInput): VisualizerSceneFrameSnapshot {
        if (this.disposed) throw new Error('正交线条场景已释放。');
        const state = this.stateResolver.resolve(
            input.timeSeconds,
            input.bindingRevision,
            input.values,
            (timeSeconds) => this.host.resolveValuesAt(timeSeconds),
        );
        const uniforms = this.material.uniforms;
        uniforms.uHorizontalColor?.value.set(state.horizontal.color);
        uniforms.uVerticalColor?.value.set(state.vertical.color);
        uniforms.uHorizontalShape?.value.set(
            state.horizontal.lengthRatio,
            state.horizontal.thicknessCssPx * this.dpr,
            state.horizontal.mainAlpha,
            state.horizontal.haloWidthCssPx * this.dpr,
        );
        uniforms.uVerticalShape?.value.set(
            state.vertical.lengthRatio,
            state.vertical.thicknessCssPx * this.dpr,
            state.vertical.mainAlpha,
            state.vertical.haloWidthCssPx * this.dpr,
        );
        if (uniforms.uHorizontalHaloAlpha) {
            uniforms.uHorizontalHaloAlpha.value = state.horizontal.haloAlpha;
        }
        if (uniforms.uVerticalHaloAlpha) {
            uniforms.uVerticalHaloAlpha.value = state.vertical.haloAlpha;
        }
        this.host.renderer.render(this.scene, this.camera);
        return { hash: state.hash, needsSourcePrompt: state.needsSourcePrompt };
    }

    resize(width: number, height: number, dpr: number): void {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.dpr = Math.max(1, dpr);
        this.material.uniforms.uViewport?.value.set(this.width * this.dpr, this.height * this.dpr);
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.geometry.dispose();
        this.material.dispose();
        this.stateResolver.reset();
        this.scene.clear();
    }
}

export const createOrthogonalLinesScene: VisualizerSceneFactory = (host, seed) =>
    new OrthogonalLinesScene(host, seed);

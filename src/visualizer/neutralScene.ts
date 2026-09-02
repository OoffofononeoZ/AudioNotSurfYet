import * as THREE from 'three';
import type {
    VisualizerScene,
    VisualizerSceneFactory,
    VisualizerSceneFrameSnapshot,
    VisualizerSceneHost,
} from './rendererTypes';

class NeutralVisualizerScene implements VisualizerScene {
    readonly kind = 'neutral' as const;
    private readonly host: VisualizerSceneHost;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    constructor(host: VisualizerSceneHost) {
        this.host = host;
        this.host.renderer.setClearColor('#020403', 1);
    }

    render(): VisualizerSceneFrameSnapshot {
        this.host.renderer.render(this.scene, this.camera);
        return { hash: 'neutral-v4', needsSourcePrompt: false };
    }

    resize(): void {}
    dispose(): void { this.scene.clear(); }
}

export const createNeutralVisualizerScene: VisualizerSceneFactory = (host) =>
    new NeutralVisualizerScene(host);

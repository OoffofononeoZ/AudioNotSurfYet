import * as THREE from 'three';
import { cameraPoseAt } from './scene3dCodec';
import type { SceneCamera, CameraFrame } from './scene3dTypes';

export function resolveSceneCamera(
    definition: SceneCamera,
    localTime: number,
    width: number,
    height: number,
): CameraFrame {
    const pose = cameraPoseAt(definition, localTime);
    const camera = new THREE.PerspectiveCamera(pose.fov, width / height, definition.near, definition.far);
    camera.position.set(...pose.position);
    camera.up.set(...definition.up);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld(true);
    return {
        ...pose,
        up: [...definition.up],
        near: definition.near,
        far: definition.far,
        viewMatrix: camera.matrixWorldInverse.toArray(),
        projectionMatrix: camera.projectionMatrix.toArray(),
    };
}

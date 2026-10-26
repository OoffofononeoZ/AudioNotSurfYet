import * as THREE from 'three';
import type { CameraFrame, Transform3d } from './scene3dTypes';
import type { ShaderProgram } from './algorithmTypes';

/** ABI 4 fragments return straight RGBA from shade(); the host owns alpha/depth semantics. */
export function worldFragment(program: ShaderProgram): string {
    const cutoff = program.alphaCutoff ?? 0.5;
    const threshold = Number.isInteger(cutoff) ? cutoff + '.0' : String(cutoff);
    const clip = program.alphaMode === 'mask' ? `if (color.a < ${threshold}) discard;` : '';
    return `${program.fragment}\nvoid main() { vec4 color = shade(); ${clip} gl_FragColor = vec4(color.rgb, 1.0); }`;
}
export function applyWorldCamera(camera: THREE.PerspectiveCamera, frame: CameraFrame) {
    camera.fov = frame.fov;
    camera.near = frame.near;
    camera.far = frame.far;
    camera.position.set(...frame.position);
    camera.up.set(...frame.up);
    camera.lookAt(...frame.target);
    camera.updateMatrixWorld(true);
    camera.projectionMatrix.fromArray(frame.projectionMatrix);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
export function applyWorldTransform(mesh: THREE.Mesh, transform: Transform3d) {
    mesh.position.set(...transform.position);
    mesh.rotation.set(...(transform.rotationDegrees.map(THREE.MathUtils.degToRad) as [number, number, number]));
    mesh.scale.set(...transform.scale);
    mesh.updateMatrixWorld(true);
}

export type Vector3Data = [number, number, number];
export interface CameraPose {
    position: Vector3Data;
    target: Vector3Data;
    fov: number;
}
export interface CameraKeyframe extends CameraPose {
    timeSeconds: number;
}
export interface SceneCamera extends CameraPose {
    up: Vector3Data;
    near: number;
    far: number;
    animation?: { durationSeconds: number; loop: boolean; keyframes: CameraKeyframe[] };
}
export interface Transform3d {
    position: Vector3Data;
    rotationDegrees: Vector3Data;
    scale: Vector3Data;
}
export interface Scene3dItem {
    kind: 'scene3d';
    id: string;
    name: string;
    enabled: boolean;
    children: string[];
    startSeconds: number;
    endSeconds: number;
    camera: SceneCamera;
}
export interface PresetScene3d {
    key: string;
    name: string;
    enabled: boolean;
    children: string[];
    start: number;
    end: number;
    camera: SceneCamera;
}
export interface CameraFrame extends CameraPose {
    up: Vector3Data;
    near: number;
    far: number;
    viewMatrix: number[];
    projectionMatrix: number[];
}
export const defaultCamera = (): SceneCamera => ({
    position: [0, 2, 6],
    target: [0, 0, 0],
    up: [0, 1, 0],
    fov: 50,
    near: 0.1,
    far: 1000,
});
export const defaultTransform3d = (): Transform3d => ({
    position: [0, 0, 0],
    rotationDegrees: [0, 0, 0],
    scale: [1, 1, 1],
});

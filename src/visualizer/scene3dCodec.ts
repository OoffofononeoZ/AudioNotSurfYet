import { finite, invalid, keys, record, text } from './projectValidation';
import type { CameraPose, SceneCamera, Transform3d, Vector3Data, Scene3dItem, PresetScene3d } from './scene3dTypes';

function vector(input: unknown, label: string): Vector3Data {
    if (!Array.isArray(input) || input.length !== 3) return invalid(label + ' 必须为三维向量。');
    return input.map(v => finite(v, label)) as Vector3Data;
}
function pose(v: Record<string, unknown>): CameraPose {
    const position = vector(v.position, '镜头位置'),
        target = vector(v.target, '观察目标');
    const fov = finite(v.fov, 'FOV');
    if (fov <= 0 || fov >= 180 || position.every((n, i) => n === target[i])) return invalid('镜头视角或观察方向无效。');
    return { position, target, fov };
}
export function assertCameraDirection(pose: CameraPose, up: Vector3Data) {
    const d = pose.target.map((n, i) => n - pose.position[i]!);
    const cross = [d[1]! * up[2] - d[2]! * up[1], d[2]! * up[0] - d[0]! * up[2], d[0]! * up[1] - d[1]! * up[0]];
    if (Math.hypot(...cross) < 1e-10) invalid('镜头方向与 up 不能退化或平行。');
}
export function validateSceneCamera(input: unknown): SceneCamera {
    const v = record(input, '场景镜头');
    keys(v, ['position', 'target', 'up', 'fov', 'near', 'far'], ['animation']);
    const base = pose(v),
        up = vector(v.up, '镜头 up');
    const near = finite(v.near, 'near'),
        far = finite(v.far, 'far');
    if (near <= 0 || far <= near) return invalid('镜头裁剪范围无效。');
    assertCameraDirection(base, up);
    const camera: SceneCamera = { ...base, up, near, far };
    if (v.animation !== undefined) {
        const a = record(v.animation, '镜头轨迹');
        keys(a, ['durationSeconds', 'loop', 'keyframes']);
        const durationSeconds = finite(a.durationSeconds, '轨迹时长');
        if (
            durationSeconds <= 0 ||
            typeof a.loop !== 'boolean' ||
            !Array.isArray(a.keyframes) ||
            a.keyframes.length < 2
        )
            return invalid('镜头轨迹至少需要两个关键帧和正时长。');
        const keyframes = a.keyframes.map(input => {
            const k = record(input, '镜头关键帧');
            keys(k, ['timeSeconds', 'position', 'target', 'fov']);
            const result = { ...pose(k), timeSeconds: finite(k.timeSeconds, '关键帧时间') };
            assertCameraDirection(result, up);
            return result;
        });
        if (
            keyframes[0]!.timeSeconds !== 0 ||
            keyframes[keyframes.length - 1]!.timeSeconds !== durationSeconds ||
            keyframes.some((k, i) => i > 0 && k.timeSeconds <= keyframes[i - 1]!.timeSeconds)
        )
            return invalid('关键帧须严格递增，并覆盖轨迹的零时刻和末时刻。');
        camera.animation = { durationSeconds, loop: a.loop, keyframes };
    }
    return camera;
}
export function cameraPoseAt(camera: SceneCamera, timeSeconds: number): CameraPose {
    finite(timeSeconds, '镜头时间');
    const a = camera.animation;
    if (!a) return { position: [...camera.position], target: [...camera.target], fov: camera.fov };
    const t = a.loop
        ? Math.max(0, timeSeconds) % a.durationSeconds
        : Math.min(a.durationSeconds, Math.max(0, timeSeconds));
    const end = a.keyframes.findIndex(k => k.timeSeconds >= t);
    const b = a.keyframes[Math.max(0, end)]!,
        first = a.keyframes[Math.max(0, end - 1)]!;
    const ratio =
        b.timeSeconds === first.timeSeconds ? 0 : (t - first.timeSeconds) / (b.timeSeconds - first.timeSeconds);
    const lerp = (x: number, y: number) => x + (y - x) * ratio;
    const result: CameraPose = {
        position: first.position.map((x, i) => lerp(x, b.position[i]!)) as Vector3Data,
        target: first.target.map((x, i) => lerp(x, b.target[i]!)) as Vector3Data,
        fov: lerp(first.fov, b.fov),
    };
    assertCameraDirection(result, camera.up);
    return result;
}
export function validateTransform3d(input: unknown): Transform3d {
    const v = record(input, '三维变换');
    keys(v, ['position', 'rotationDegrees', 'scale']);
    const scale = vector(v.scale, '缩放');
    if (scale.some(n => n === 0)) return invalid('三维缩放不能为零。');
    return { position: vector(v.position, '位置'), rotationDegrees: vector(v.rotationDegrees, '旋转'), scale };
}
export function validateScene3d(input: unknown, preset = false): Scene3dItem | PresetScene3d {
    const v = record(input, '三维场景');
    keys(
        v,
        preset
            ? ['key', 'name', 'enabled', 'children', 'start', 'end', 'camera']
            : ['kind', 'id', 'name', 'enabled', 'children', 'startSeconds', 'endSeconds', 'camera'],
    );
    const start = finite(v[preset ? 'start' : 'startSeconds'], '场景起点');
    const end = finite(v[preset ? 'end' : 'endSeconds'], '场景终点');
    if (
        start < 0 ||
        end <= start ||
        (preset && end > 1) ||
        typeof v.enabled !== 'boolean' ||
        !Array.isArray(v.children) ||
        !v.children.length ||
        v.children.some(id => typeof id !== 'string') ||
        new Set(v.children).size !== v.children.length ||
        (!preset && v.kind !== 'scene3d')
    )
        return invalid('三维场景范围或成员无效。');
    const common = {
        name: text(v.name, '场景名称'),
        enabled: v.enabled,
        children: [...v.children] as string[],
        camera: validateSceneCamera(v.camera),
    };
    return preset
        ? { ...common, key: text(v.key, '场景 key'), start, end }
        : { ...common, kind: 'scene3d', id: text(v.id, '场景 ID'), startSeconds: start, endSeconds: end };
}

import * as THREE from 'three';
import { componentPosition, type ThreeDGrid } from '../../analysis/threeDData';
import type { PersistedTimelineViewport } from '../../types/session';
import { createBudgetYield } from '../../analysis/taskScheduler';

const WIDTH = 10;
const HEIGHT = 4;
const color = new THREE.Color();
const point = new THREE.Vector3();

function disposeGroup(group: THREE.Group) {
    group.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material])
                material.dispose();
        }
    });
    group.clear();
}

export class ThreeDRenderer {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly root = new THREE.Group();
    private readonly data = new THREE.Group();
    private readonly axes = new THREE.Group();
    private readonly cursor = new THREE.Group();
    private readonly perspective = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    private readonly orthographic = new THREE.OrthographicCamera(-7, 7, 4, -4, 0.1, 100);
    private readonly planes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), 5),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), 5),
    ];
    private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.perspective;
    private grid: ThreeDGrid | null = null;
    private viewport: PersistedTimelineViewport = { startSeconds: 0, endSeconds: 1, zoom: 1 };
    private width = 1;
    private height = 1;
    private dpr = 1;
    private frame: number | null = null;
    private slice = false;
    private cursorSeconds = 0;
    private readonly saved = { position: new THREE.Vector3(), rotation: new THREE.Quaternion(), zoom: 1 };
    private disposed = false;
    private loudness = false;
    private selectedLabel = '';
    private axisLabel = '';
    private exact: number | null = null;
    private axisTicks: Array<{ index: number; label: string }> = [];
    private readonly overlay: HTMLCanvasElement;
    private readonly onError: (error: unknown) => void;

    constructor(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, onError: (error: unknown) => void) {
        this.overlay = overlay;
        this.onError = onError;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setClearColor(0x020704, 0);
        this.renderer.localClippingEnabled = true;
        this.scene.add(this.root);
        this.root.add(this.axes, this.data, this.cursor);
        this.root.rotation.set(-0.48, 0.58, -0.06);
        this.perspective.position.z = this.orthographic.position.z = 18;
        this.saved.rotation.copy(this.root.quaternion);
        this.drawAxes();
    }

    resize(width: number, height: number, dpr: number) {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.dpr = Math.max(1, dpr);
        this.renderer.setPixelRatio(this.dpr);
        this.renderer.setSize(this.width, this.height, false);
        this.overlay.width = Math.round(this.width * this.dpr);
        this.overlay.height = Math.round(this.height * this.dpr);
        const aspect = this.width / this.height;
        const tan = Math.tan((19 * Math.PI) / 180);
        const initialRotation = new THREE.Euler(-0.48, 0.58, -0.06);
        let distance = 8;
        for (const x of [-5, 5])
            for (const y of [-2, 2])
                for (const z of [-2.65, 2.65]) {
                    point.set(x, y, z).applyEuler(initialRotation);
                    distance = Math.max(
                        distance,
                        point.z + Math.max(Math.abs(point.y) / (tan * 0.78), Math.abs(point.x) / (tan * aspect * 0.84)),
                    );
                }
        this.perspective.aspect = aspect;
        this.perspective.position.z = distance;
        this.perspective.updateProjectionMatrix();
        const orthoHeight = Math.max(3.1, 6.4 / aspect);
        this.orthographic.left = -orthoHeight * aspect;
        this.orthographic.right = orthoHeight * aspect;
        this.orthographic.top = orthoHeight;
        this.orthographic.bottom = -orthoHeight;
        this.orthographic.updateProjectionMatrix();
        this.invalidate();
    }

    setViewport(viewport: PersistedTimelineViewport) {
        this.viewport = { ...viewport };
        if (this.grid) {
            const span = viewport.endSeconds - viewport.startSeconds;
            const old = this.grid.viewport;
            const scale = (old.endSeconds - old.startSeconds) / span;
            this.data.scale.x = scale;
            this.data.position.x = 5 * scale + (WIDTH * (old.startSeconds - viewport.startSeconds)) / span - 5;
        }
        this.updateCursor();
        this.invalidate();
    }

    async setGrid(
        grid: ThreeDGrid,
        loudness: boolean,
        axisLabel: string,
        cancelled: () => boolean,
        axisTicks: Array<{ index: number; label: string }>,
    ) {
        const checkpoint = createBudgetYield();
        const columns = grid.times.length,
            rows = grid.components.length;
        const positions = new Float32Array(columns * rows * 3);
        const colors = new Float32Array(positions.length);
        const linePoints: number[] = [];
        const y = (value: number) => -2 + (HEIGHT * (value - grid.min)) / (grid.max - grid.min);
        const x = (column: number) =>
            -5 +
            (WIDTH * (grid.times[column]! - grid.viewport.startSeconds)) /
                (grid.viewport.endSeconds - grid.viewport.startSeconds);
        for (let row = 0; row < rows; row++) {
            const z = grid.slice ? 0 : componentPosition(grid.components[row]!, grid.componentCount, loudness);
            for (let column = 0; column < columns; column++) {
                const offset = row * columns + column;
                const value = grid.values[offset]!;
                positions.set([x(column), y(value), z], offset * 3);
                const intensity = Math.min(1, Math.abs(value) / Math.max(Math.abs(grid.min), Math.abs(grid.max)));
                color.setRGB(0.025 + intensity * 0.42, 0.14 + intensity * 0.82, 0.095 + intensity * 0.52);
                if (value < 0) color.setRGB(0.08 + intensity * 0.22, 0.22 + intensity * 0.55, 0.32 + intensity * 0.65);
                colors.set([color.r, color.g, color.b], offset * 3);
                const isLine =
                    grid.slice ||
                    row % Math.max(1, Math.ceil(rows / 24)) === 0 ||
                    (loudness && grid.components[row] === 24);
                if (isLine && column > 0 && (!grid.phase || Math.abs(value - grid.values[offset - 1]!) <= Math.PI)) {
                    linePoints.push(x(column - 1), y(grid.values[offset - 1]!), z, x(column), y(value), z);
                }
                if (
                    grid.slice &&
                    grid.maximums[offset] !== grid.minimums[offset] &&
                    (!grid.phase || grid.maximums[offset]! - grid.minimums[offset]! <= Math.PI)
                ) {
                    linePoints.push(x(column), y(grid.minimums[offset]!), z, x(column), y(grid.maximums[offset]!), z);
                }
                if (columns === 1) linePoints.push(x(column) - 0.025, y(value), z, x(column) + 0.025, y(value), z);
            }
            await checkpoint();
            if (cancelled()) return;
        }
        const next = new THREE.Group();
        if (rows > 1 && columns > 1) {
            const indices: number[] = [];
            for (let row = 0; row < rows - 1; row++) {
                if (loudness && grid.components[row + 1] === 24) continue;
                for (let column = 0; column < columns - 1; column++) {
                    const a = row * columns + column,
                        b = a + 1,
                        c = a + columns,
                        d = c + 1;
                    for (const triangle of [
                        [a, c, b],
                        [b, c, d],
                    ]) {
                        if (grid.phase) {
                            const values = triangle.map(index => grid.values[index]!);
                            if (Math.max(...values) - Math.min(...values) > Math.PI) continue;
                        }
                        indices.push(...triangle);
                    }
                }
                await checkpoint();
                if (cancelled()) return;
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setIndex(indices);
            const material = new THREE.MeshBasicMaterial({
                vertexColors: true,
                side: THREE.DoubleSide,
                clippingPlanes: this.planes,
            });
            next.add(new THREE.Mesh(geometry, material));
        }
        const lines = new THREE.BufferGeometry();
        lines.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
        next.add(
            new THREE.LineSegments(
                lines,
                new THREE.LineBasicMaterial({
                    color: 0x9affc1,
                    transparent: true,
                    opacity: grid.slice ? 0.95 : 0.3,
                    clippingPlanes: this.planes,
                }),
            ),
        );
        disposeGroup(this.data);
        this.data.add(next);
        this.grid = grid;
        this.loudness = loudness;
        this.axisLabel = axisLabel;
        this.axisTicks = axisTicks;
        this.data.position.set(0, 0, 0);
        this.data.scale.set(1, 1, 1);
        this.setViewport(this.viewport);
        this.drawAxes();
        this.invalidate();
    }

    clear() {
        this.grid = null;
        disposeGroup(this.data);
        disposeGroup(this.cursor);
        this.drawAxes();
        this.invalidate();
    }

    setSliceMode(slice: boolean) {
        if (slice === this.slice) return;
        if (slice) {
            this.saved.position.copy(this.root.position);
            this.saved.rotation.copy(this.root.quaternion);
            this.saved.zoom = this.perspective.zoom;
            this.root.position.set(0, 0, 0);
            this.root.quaternion.identity();
            this.orthographic.zoom = 1;
            this.camera = this.orthographic;
        } else {
            this.root.position.copy(this.saved.position);
            this.root.quaternion.copy(this.saved.rotation);
            this.perspective.zoom = this.saved.zoom;
            this.camera = this.perspective;
        }
        this.slice = slice;
        this.camera.updateProjectionMatrix();
        this.data.visible = false;
        this.drawAxes();
        this.updateCursor();
        this.invalidate();
    }

    zoom(factor: number) {
        this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, 0.5, 3);
        this.camera.updateProjectionMatrix();
        this.invalidate();
    }

    pan(dx: number, dy: number) {
        const halfHeight =
            this.camera instanceof THREE.OrthographicCamera
                ? this.camera.top
                : this.camera.position.z * Math.tan((19 * Math.PI) / 180);
        const scale = (halfHeight * 2) / (this.height * this.camera.zoom);
        this.root.position.x += dx * scale;
        this.root.position.y -= dy * scale;
        this.invalidate();
    }

    rotate(dx: number, dy: number) {
        if (this.slice) return;
        const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(dy * 0.007, dx * 0.007, 0));
        this.root.quaternion.premultiply(rotation);
        this.invalidate();
    }

    timeAt(x: number, y: number): number {
        this.root.updateMatrixWorld(true);
        this.camera.updateMatrixWorld(true);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((x / this.width) * 2 - 1, 1 - (y / this.height) * 2), this.camera);
        ray.ray.applyMatrix4(this.root.matrixWorld.clone().invert());
        const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3());
        let ratio: number;
        if (hit && Math.abs(hit.x) < 1e4) ratio = (hit.x + 5) / WIDTH;
        else {
            const a = this.project(-5, -2, 0),
                b = this.project(5, -2, 0);
            const dx = b.x - a.x,
                dy = b.y - a.y;
            ratio = ((x - a.x) * dx + (y - a.y) * dy) / Math.max(1, dx * dx + dy * dy);
        }
        return (
            this.viewport.startSeconds +
            THREE.MathUtils.clamp(ratio, 0, 1) * (this.viewport.endSeconds - this.viewport.startSeconds)
        );
    }

    setCursor(seconds: number, label: string, exact: number | null) {
        this.cursorSeconds = seconds;
        this.selectedLabel = label;
        this.exact = exact;
        this.updateCursor();
        this.invalidate();
    }

    private updateCursor() {
        const ratio =
            (this.cursorSeconds - this.viewport.startSeconds) / (this.viewport.endSeconds - this.viewport.startSeconds);
        this.cursor.visible = ratio >= 0 && ratio <= 1 && !!this.grid;
        if (!this.cursor.visible) return;
        const x = -5 + WIDTH * ratio;
        const z = this.slice ? 0 : 2.65;
        let line = this.cursor.children[0] as THREE.LineSegments | undefined;
        if (!line) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
            line = new THREE.LineSegments(
                geometry,
                new THREE.LineBasicMaterial({ color: 0xeaffef, transparent: true, opacity: 0.8, depthTest: false }),
            );
            line.frustumCulled = false;
            this.cursor.add(line);
        }
        const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
        positions.setXYZ(0, x, -2, z);
        positions.setXYZ(1, x, 2, z);
        positions.setXYZ(2, x, -2, -2.65);
        positions.setXYZ(3, x, -2, 2.65);
        positions.needsUpdate = true;
        line.geometry.setDrawRange(0, this.slice ? 2 : 4);
    }

    private drawAxes() {
        disposeGroup(this.axes);
        const grid: number[] = [],
            strong: number[] = [];
        const z = this.slice ? 0 : 2.65;
        for (let i = 0; i <= 10; i++) {
            const x = -5 + i;
            if (this.slice) grid.push(x, -2, 0, x, 2, 0);
            else grid.push(x, -2, -2.65, x, -2, z);
        }
        for (let i = 0; i <= 4; i++) {
            const y = -2 + i;
            grid.push(-5, y, z, 5, y, z);
            if (!this.slice) grid.push(-5, y, -2.65, -5, y, z);
        }
        if (!this.slice)
            for (let i = 0; i <= 8; i++) {
                const depth = -2.6 + i * 0.65;
                grid.push(-5, -2, depth, 5, -2, depth);
            }
        strong.push(-5, -2, z, 5, -2, z, -5, -2, z, -5, 2, z);
        if (!this.slice) strong.push(-5, -2, -2.65, -5, -2, z);
        for (const [vertices, opacity] of [
            [grid, 0.14],
            [strong, 0.6],
        ] as const) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            this.axes.add(
                new THREE.LineSegments(
                    geometry,
                    new THREE.LineBasicMaterial({ color: 0x65ffa9, transparent: true, opacity }),
                ),
            );
        }
        if (this.grid && this.grid.min < 0 && this.grid.max > 0) {
            const y = -2 + (HEIGHT * -this.grid.min) / (this.grid.max - this.grid.min);
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-5, y, z),
                new THREE.Vector3(5, y, z),
            ]);
            this.axes.add(
                new THREE.Line(
                    geometry,
                    new THREE.LineBasicMaterial({ color: 0x81c7dd, transparent: true, opacity: 0.5 }),
                ),
            );
        }
    }

    private project(x: number, y: number, z: number) {
        point.set(x, y, z).applyMatrix4(this.root.matrixWorld).project(this.camera);
        return { x: ((point.x + 1) * this.width) / 2, y: ((1 - point.y) * this.height) / 2 };
    }

    private drawLabels() {
        const ctx = this.overlay.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillStyle = '#91a99a';
        ctx.textBaseline = 'middle';
        const z = this.slice ? 0 : 2.65;
        const label = (
            text: string,
            x: number,
            y: number,
            depth: number,
            align: CanvasTextAlign = 'center',
            offset = 16,
        ) => {
            const p = this.project(x, y, depth);
            ctx.textAlign = align;
            ctx.fillText(text, p.x, p.y + offset);
        };
        for (let i = 0; i <= 4; i++) {
            const time = this.viewport.startSeconds + ((this.viewport.endSeconds - this.viewport.startSeconds) * i) / 4;
            label(`${time.toFixed(time < 10 ? 2 : 1)}s`, -5 + i * 2.5, -2, z);
            if (this.grid) {
                const value = this.grid.min + ((this.grid.max - this.grid.min) * i) / 4;
                const text = Math.abs(value) >= 1000 ? value.toExponential(1) : Number(value.toPrecision(3)).toString();
                const p = this.project(-5, -2 + i, z);
                ctx.textAlign = 'right';
                ctx.fillText(text, p.x - 10, p.y);
            }
        }
        label('时间', 5, -2, z, 'left', 34);
        label(this.grid?.phase ? '相位 / rad' : '数值', -5, 2, z, 'left', -18);
        if (!this.slice && this.grid) {
            label(this.axisLabel, -5, -2, -2.65, 'left', -16);
            for (const tick of this.axisTicks) {
                if (tick.index === this.grid.componentCount - 1) continue;
                label(
                    tick.label,
                    -5,
                    -2,
                    componentPosition(tick.index, this.grid.componentCount, this.loudness),
                    'right',
                    0,
                );
            }
            if (this.loudness) label('总响度', 5, -2, 2.6, 'left', -12);
        }
        if (this.slice) {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#b5ffd2';
            ctx.fillText(
                `${this.selectedLabel}${this.exact === null ? '' : '  ·  ' + Number(this.exact.toPrecision(6))}`,
                12,
                this.height - 16,
            );
        }
    }

    invalidate() {
        if (!this.disposed && this.frame === null)
            this.frame = requestAnimationFrame(() => {
                this.frame = null;
                this.root.updateMatrixWorld(true);
                this.camera.updateMatrixWorld(true);
                this.planes[0]!.set(new THREE.Vector3(1, 0, 0), 5).applyMatrix4(this.root.matrixWorld);
                this.planes[1]!.set(new THREE.Vector3(-1, 0, 0), 5).applyMatrix4(this.root.matrixWorld);
                this.data.visible = !!this.grid && this.grid.slice === this.slice;
                try {
                    this.renderer.render(this.scene, this.camera);
                    this.drawLabels();
                } catch (error) {
                    this.onError(error);
                }
            });
    }

    dispose() {
        this.disposed = true;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        disposeGroup(this.data);
        disposeGroup(this.axes);
        disposeGroup(this.cursor);
        this.scene.clear();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
    }
}

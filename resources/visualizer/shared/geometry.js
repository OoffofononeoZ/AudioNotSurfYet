const SPECTRUM_REFERENCE = 128;
export class GeometricBatch {
    positions = new Float32Array(65536 * 3);
    colors = new Float32Array(65536 * 4);
    edges = new Float32Array(65536 * 2);
    pixelSize = 1 / 1080;
    count = 0;
    reset() {
        this.count = 0;
    }
    vertex(x, y, color, distance = 0, halfWidth = 1) {
        if (this.count >= 65536) throw Error('几何元素超过顶点容量。');
        this.positions.set([x, y, 0], this.count * 3);
        this.colors.set(color, this.count * 4);
        this.edges.set([distance, halfWidth], this.count * 2);
        this.count++;
    }
    triangle(a, b, c, color) {
        this.vertex(a[0], a[1], color);
        this.vertex(b[0], b[1], color);
        this.vertex(c[0], c[1], color);
    }
    line(a, b, width, color) {
        const dx = b[0] - a[0],
            dy = b[1] - a[1],
            length = Math.hypot(dx, dy);
        if (length < 1e-10) return;
        const half = width / 2,
            outer = half + this.pixelSize;
        const nx = (-dy / length) * outer,
            ny = (dx / length) * outer;
        const p = [a[0] + nx, a[1] + ny, 0],
            q = [b[0] + nx, b[1] + ny, 0];
        const r = [b[0] - nx, b[1] - ny, 0],
            s = [a[0] - nx, a[1] - ny, 0];
        this.vertex(p[0], p[1], color, outer, half);
        this.vertex(q[0], q[1], color, outer, half);
        this.vertex(r[0], r[1], color, -outer, half);
        this.vertex(p[0], p[1], color, outer, half);
        this.vertex(r[0], r[1], color, -outer, half);
        this.vertex(s[0], s[1], color, -outer, half);
    }
}
/** p5 post-multiplies model transforms: the last named axis acts on a vertex first. */
function rotate([x, y, z], ax, ay, az, order = 'xyz') {
    const x1 = x * Math.cos(az) - y * Math.sin(az),
        y1 = x * Math.sin(az) + y * Math.cos(az);
    if (order === 'yxz') {
        const y2 = y1 * Math.cos(ax) - z * Math.sin(ax),
            z2 = y1 * Math.sin(ax) + z * Math.cos(ax);
        return [x1 * Math.cos(ay) + z2 * Math.sin(ay), y2, -x1 * Math.sin(ay) + z2 * Math.cos(ay)];
    }
    const x2 = x1 * Math.cos(ay) + z * Math.sin(ay),
        z2 = -x1 * Math.sin(ay) + z * Math.cos(ay);
    return [x2, y1 * Math.cos(ax) - z2 * Math.sin(ax), y1 * Math.sin(ax) + z2 * Math.cos(ax)];
}
/** Fixed reference response, independent of song loudness history, RAF rate and seeking. */
export function geometricSpectrum(input, sensitivity, output = new Float32Array(128), unit = 'meyda-amplitude') {
    if (unit === 'we-strength') {
        for (let i = 0; i < output.length; i++) output[i] = (input[i] ?? 0) * sensitivity;
        return output;
    }
    if (unit === 'byte-frequency') {
        const sourceBands = input.length / 2;
        for (let channel = 0; channel < 2; channel++)
            for (let band = 0; band < 64; band++) {
                const start = Math.floor((band * sourceBands) / 64),
                    end = Math.max(start + 1, Math.floor(((band + 1) * sourceBands) / 64));
                let peak = 0;
                for (let i = start; i < end; i++) peak = Math.max(peak, input[channel * sourceBands + i] ?? 0);
                output[channel * 64 + band] = (peak / 255) * sensitivity;
            }
        return output;
    }
    // Wallpaper Engine supplies 64 bands per channel. Analyzer supplies mono FFT;
    // repeat its 64 bands into both channel slots to preserve the source's radial symmetry.
    const bands = output.length / 2;
    for (let i = 0; i < bands; i++) {
        const start = Math.floor((i * input.length) / bands),
            end = Math.max(start + 1, Math.floor(((i + 1) * input.length) / bands));
        let peak = 0;
        for (let j = start; j < end; j++)
            peak = Math.max(peak, unit === 'signed-waveform' ? Math.abs(input[j] ?? 0) : (input[j] ?? 0));
        output[i] =
            (unit === 'signed-waveform' ? peak : Math.min(1, Math.log1p(peak) / Math.log1p(SPECTRUM_REFERENCE))) *
            sensitivity;
        output[i + bands] = output[i];
    }
    return output;
}
const randomUnit = (seed, index) => {
    let n = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b9), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

const { buildLightTunnel, buildStarfield } = (() => {
    const TAU = Math.PI * 2;
    const fract = value => value - Math.floor(value);
    const mix = (a, b, t, alpha) => [
        a[0] * (1 - t) + b[0] * t,
        a[1] * (1 - t) + b[1] * t,
        a[2] * (1 - t) + b[2] * t,
        alpha,
    ];
    /** Perspective comes from explicit depth; rebuilding any time has no accumulated camera state. */
    function buildLightTunnel(batch, n, time, peak, primary, accent, cx, cy) {
        const count = n('count', 28),
            sides = n('sides', 6),
            width = n('thickness', 1) / 1600;
        const centerX = cx + Math.sin(time * 0.21) * n('drift', 0.035),
            centerY = cy + Math.cos(time * 0.17) * n('drift', 0.035) * 0.6;
        const layers = [];
        for (let i = 0; i < count; i++) {
            const z = fract(i / count + time * n('speed', 0.065));
            const radius = 0.022 * Math.pow(65, z) * n('spread', 1) * (1 + peak * 0.22);
            const twist = z * n('twist', 2.4) + time * 0.13;
            const points = Array.from({ length: sides }, (_, j) => {
                const a = (j / sides) * TAU + twist;
                return [centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius, 0];
            });
            layers.push({ points, z });
        }
        layers.sort((a, b) => a.z - b.z);
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i],
                ink = mix(primary, accent, (Math.sin(layer.z * 6 + time * 0.23) + 1) * 0.5, primary[3]);
            const fade = Math.min(1, layer.z * 6) * Math.min(1, (1 - layer.z) * 5),
                brightness = fade * (0.35 + peak * 0.65);
            for (let j = 0; j < sides; j++) {
                const a = layer.points[j],
                    b = layer.points[(j + 1) % sides];
                batch.line(a, b, width * 18, [ink[0], ink[1], ink[2], brightness * 0.035 * ink[3]]);
                batch.line(a, b, width * 5, [ink[0], ink[1], ink[2], brightness * 0.14 * ink[3]]);
                batch.line(a, b, width, [ink[0], ink[1], ink[2], brightness * ink[3]]);
                const next = layers[i + 1];
                if (next)
                    batch.line(a, next.points[j], width * 0.7, [ink[0], ink[1], ink[2], brightness * 0.22 * ink[3]]);
            }
        }
    }
    function buildStarfield(batch, n, time, seed, peak, ink, cx, cy, aspect) {
        const count = n('count', 180),
            width = n('thickness', 1) / 1600;
        for (let i = 0; i < count; i++) {
            const z = fract(randomUnit(seed, i * 3) + time * n('speed', 0.08)),
                angle = randomUnit(seed, i * 3 + 1) * TAU;
            const lane = 0.15 + randomUnit(seed, i * 3 + 2) * 0.85,
                radius = (0.02 + z * z * 0.8) * lane * n('spread', 1);
            const tail = Math.max(0.01, radius - n('stretch', 0.025) * z * (0.25 + peak * 2));
            const a = [cx + Math.cos(angle) * radius * aspect, cy + Math.sin(angle) * radius, 0];
            const b = [cx + Math.cos(angle) * tail * aspect, cy + Math.sin(angle) * tail, 0];
            const alpha = Math.min(1, z * 3) * Math.min(1, (1 - z) * 6) * ink[3];
            batch.line(a, b, width * 5, [ink[0], ink[1], ink[2], alpha * 0.07]);
            batch.line(a, b, width * (0.5 + z), [ink[0], ink[1], ink[2], alpha * (0.3 + peak)]);
        }
    }

    return { buildLightTunnel, buildStarfield };
})();
/** Repeat the complete source array, including zeros and channel seams. */
export function createRadialSpectrumSampler(levels) {
    return index => (levels.length ? (levels[((index % levels.length) + levels.length) % levels.length] ?? 0) : 0);
}

const parameterKey = (id, parameter) => id + ':' + parameter;
const elementValue = (values, e, id) => values.get(parameterKey(e.id, id))?.value;
const elementNumber = (values, e, id, fallback = 0) => {
    const v = elementValue(values, e, id);
    return typeof v === 'number' ? v : fallback;
};
const TAU = Math.PI * 2;
const palette = [
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#ff00ff',
    '#00ffff',
    '#ffa500',
    '#808080',
    '#800000',
    '#008000',
    '#000080',
    '#800080',
];
const rgb = (hex, alpha) => [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
    alpha,
];
const cube = [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
];
// p5 1.8 cone(..., 4) includes the seam vertex: three distinct base corners, open base.
const pyramid = [
    [0, 0.5, 0],
    [0, -0.5, 1],
    [Math.sqrt(3) / 2, -0.5, -0.5],
    [-Math.sqrt(3) / 2, -0.5, -0.5],
];
const cubeEdges = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
const pyramidEdges = [0, 1, 0, 2, 0, 3, 1, 2, 2, 3, 3, 1];
const cubeFaces = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
];
const pyramidFaces = [0, 1, 2, 0, 2, 3, 0, 3, 1];
/** Each call rebuilds only this atom from absolute song time; no mutable animation history. */
export function buildGeometricElement(batch, e, values, time, seed, aspect, levels) {
    batch.reset();
    const n = (id, fallback = 0) => elementNumber(values, e, id, fallback);
    const input = elementValue(values, e, 'spectrum');
    geometricSpectrum(
        Array.isArray(input) ? input : [],
        n('sensitivity', 0.6),
        levels,
        values.get(parameterKey(e.id, 'spectrum'))?.unit,
    );
    let peak = 0;
    for (const level of levels) peak = Math.max(peak, level);
    const alpha = n('opacity', 1),
        white = rgb(String(elementValue(values, e, 'color') ?? '#ffffff'), alpha);
    const colorful = elementValue(values, e, 'chromatic') === true;
    const frame = Math.floor(time * 60);
    const randomInk = index => [
        randomUnit(seed, index),
        randomUnit(seed, index + 1),
        randomUnit(seed, index + 2),
        alpha,
    ];
    const accent = randomInk(frame * 3),
        width = n('thickness', 1) / 1600;
    const cx = (n('x', 0.5) - 0.5) * aspect,
        cy = 0.5 - n('y', 0.5);
    const point = (x, y, z = 0) => {
        const projection = 0.8660254 / (0.8660254 - z);
        return [cx + x * projection, cy - y * projection, 0];
    };
    const line = (a, b, ink = white) => batch.line(a, b, width, ink);
    const arc = (radius, start, sweep, ax = 0, ay = 0, ink = white) => {
        const steps = Math.max(8, Math.ceil(Math.abs(sweep) * 48));
        let previous = null;
        for (let i = 0; i <= steps; i++) {
            const a = start + (sweep * i) / steps,
                p = rotate([Math.cos(a) * radius, Math.sin(a) * radius, 0], ax, ay, 0),
                current = point(...p);
            if (previous) line(previous, current, ink);
            previous = current;
        }
    };
    const solid = (shape, size, x, y, ax, ay, az, fill, offsetY = 0, height = (size * 84.85) / 60) => {
        const vertices = (shape === 1 ? pyramid : cube).map(v => {
            const p = rotate(
                [v[0] * size, v[1] * (shape === 1 ? height : size) + offsetY, v[2] * size],
                ax,
                ay,
                az,
                shape === 1 ? 'yxz' : 'xyz',
            );
            return point(p[0] + x, p[1] + y, p[2]);
        });
        const faces = shape === 1 ? pyramidFaces : cubeFaces,
            edges = shape === 1 ? pyramidEdges : cubeEdges;
        if (fill)
            for (let i = 0; i < faces.length; i += 3)
                batch.triangle(vertices[faces[i]], vertices[faces[i + 1]], vertices[faces[i + 2]], fill);
        for (let i = 0; i < edges.length; i += 2) line(vertices[edges[i]], vertices[edges[i + 1]]);
    };
    if (e.type === 'light-tunnel') {
        buildLightTunnel(
            batch,
            n,
            time,
            peak,
            white,
            rgb(String(elementValue(values, e, 'accent') ?? '#ff408e'), alpha),
            cx,
            cy,
        );
    } else if (e.type === 'starfield') {
        buildStarfield(batch, n, time, seed, peak, white, cx, cy, aspect);
    } else if (e.type === 'radial-spectrum') {
        const repeat = n('repeat', 2),
            count = levels.length * repeat,
            ink = colorful && peak >= 0.15 ? accent : white;
        const sample = createRadialSpectrumSampler(levels);
        let previous = null;
        for (let i = 0; i <= count; i++) {
            const a = (i / count) * TAU,
                value = sample(i);
            const r = n('radius', 0.25) * (1 + peak * n('expansion', 1)) * (1 + value * n('amplitude', 1));
            const current = point(Math.cos(a) * r, Math.sin(a) * r);
            if (previous) line(previous, current, ink);
            previous = current;
        }
    } else if (e.type === 'arc-lattice') {
        const rotation = -4.5 + peak * 125;
        for (let i = 0; i < n('count', 19); i++) {
            const radius = n('radius', 0.0625) + (n('spacing', 0.0025) + peak * n('amplitude', 0.0046875)) * i;
            arc(
                radius,
                ((i * 50 + rotation + 50 + i * rotation) * Math.PI) / 180 + time * n('speed'),
                (n('sweep', 50) * Math.PI) / 180,
            );
        }
    } else if (e.type === 'orbit-solids') {
        const count = n('count', 12),
            shape = n('shape'),
            speed = time * n('speed', 0.6),
            radius = n('radius', 0.0875);
        for (let i = 0; i < count; i++) {
            const a = (i / count) * TAU + time * n('orbitSpeed'),
                wobble = time * 0.5 + (i * Math.PI) / 3;
            const value = shape === 1 ? peak : (levels[Math.min(127, i * 11)] ?? 0),
                filled = value >= n('threshold', 0.05);
            const ink = colorful
                ? shape === 1
                    ? randomInk(frame * 9 + i * 3)
                    : rgb(palette[i % palette.length], alpha)
                : white;
            const size = n('size', 0.00875) * (shape === 0 && filled ? 19 / 14 : 1),
                spin = speed + (shape === 0 ? i * 0.1 : 0);
            solid(
                shape,
                size,
                radius * Math.cos(a) + n('wobble') * Math.cos(wobble),
                radius * Math.sin(a) + n('wobble') * Math.sin(wobble),
                spin,
                spin,
                0,
                filled ? ink : null,
                0,
                (size * 4) / 3,
            );
        }
    } else if (e.type === 'wireform') {
        const size = n('size', 0.00875) * (1 + peak * n('amplitude', 7.5)),
            angle = time * n('speed', -0.6) + n('phase');
        if (n('shape') === 2) arc(size / 2, 0, TAU, angle, angle);
        else {
            const fill = [
                (30 + 152 * randomUnit(seed, frame * 3 + 1000000)) / 255,
                (9 + 91 * randomUnit(seed, frame * 3 + 1000001)) / 255,
                (99 + randomUnit(seed, frame * 3 + 1000002)) / 255,
                alpha,
            ];
            solid(
                n('shape'),
                size,
                0,
                0,
                angle,
                angle,
                angle,
                colorful && peak >= n('threshold', 0.1286) ? fill : null,
                n('shape') === 1 ? size / 3 : 0,
            );
        }
    }
    return batch.count;
}

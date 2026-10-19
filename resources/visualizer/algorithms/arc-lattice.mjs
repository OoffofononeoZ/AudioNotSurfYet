export function create() {
    const batch = new GeometricBatch(),
        levels = new Float32Array(128);
    return {
        prepareFrame(frame) {
            batch.pixelSize = 1 / frame.height;
            const e = { id: 'atom', type: 'arc-lattice' },
                values = new Map(Object.entries(frame.parameters).map(([id, value]) => ['atom:' + id, value]));
            buildGeometricElement(batch, e, values, frame.time, frame.seed, frame.width / frame.height, levels);
            return {
                passes: [
                    {
                        program: 'draw',
                        uniforms: {},
                        mesh: {
                            positions: batch.positions.slice(0, batch.count * 3),
                            colors: batch.colors.slice(0, batch.count * 4),
                            edges: batch.edges.slice(0, batch.count * 2),
                        },
                    },
                ],
            };
        },
    };
}

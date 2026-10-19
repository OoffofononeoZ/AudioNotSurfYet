function createPrimitive(kind) {
    const levels = new Float32Array(64),
        state = new SpectralStringsState();
    return {
        async prepareFrame(frame, input) {
            const p = frame.parameters,
                n = (id, fallback = 0) => (typeof p[id]?.value === 'number' ? p[id].value : fallback);
            const spectrum = Array.isArray(p.spectrum?.value) ? p.spectrum.value : [],
                unit = p.spectrum?.unit ?? 'meyda-amplitude';
            spectrumBands(spectrum, levels, unit);
            let motion = new Float32Array(64);
            if (kind === 1) {
                const key = frame.revision + ':' + frame.seed,
                    target = Math.max(0, Math.floor(frame.time * 60 + 1e-8));
                const start =
                    state.key === key
                        ? state.latest.tick <= target
                            ? state.latest.tick
                            : (state.checkpoints.get(Math.floor(target / 60) * 60)?.tick ?? 0)
                        : 0;
                for (let tick = start; tick < target; tick += 60) {
                    const end = Math.min(target, tick + 60),
                        samples = await input.history({ parameterId: 'spectrum', startTick: tick, endTick: end });
                    const values = new Map(samples.map(s => [Math.round(s.time * 60), s.value]));
                    state.resolve(
                        end / 60,
                        key,
                        n('decay', 0.6),
                        t => values.get(Math.round(t * 60)) ?? spectrum,
                        unit,
                    );
                }
                motion = state.resolve(frame.time, key, n('decay', 0.6), () => spectrum, unit).position;
            }
            return {
                state: Array.from(motion),
                passes: [
                    {
                        program: 'draw',
                        uniforms: {
                            uKind: kind,
                            uViewport: [frame.width, frame.height],
                            uColor: String(p.color?.value ?? '#edf5f1'),
                            uPosition: [n('x', 0.5), n('y', 0.5)],
                            uExtent: [n('width', 1), n('height', 1)],
                            uOpacity: n('opacity', 1),
                            uCount: n('count', 1),
                            uRows: n('rows', 1),
                            uSize: n(kind === 2 ? 'size' : 'thickness', 1),
                            uSpacing: n('spacing', 10),
                            uAmplitude: n('amplitude'),
                            uSensitivity: n('sensitivity', 1),
                            uRadius: n('radius', 0.1),
                            uAmount: n('amount'),
                            uPhase: ((frame.seed % 65536) / 65536) * Math.PI * 2,
                            uLevels: Array.from(levels),
                            uMotion: Array.from(motion),
                        },
                    },
                ],
            };
        },
        reset() {
            state.reset();
        },
        dispose() {
            state.reset();
        },
    };
}

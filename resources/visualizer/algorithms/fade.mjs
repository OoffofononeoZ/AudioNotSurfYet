export function create() {
    return {
        prepareFrame(frame) {
            const n = (id, fallback = 0) =>
                typeof frame.parameters[id]?.value === 'number' ? frame.parameters[id].value : fallback;
            const pass = changes => ({
                program: 'draw',
                uniforms: {
                    uImage: 'source',
                    uOperation: 0,
                    uScale: 1,
                    uOpacity: 1,
                    uBlurStep: [0, 0],
                    uFinal: false,
                    ...changes,
                },
            });
            const range = frame.range;
            let progress = range
                ? Math.max(0, Math.min(1, (frame.time - range.startSeconds) / (range.endSeconds - range.startSeconds)))
                : 0;
            if (frame.parameters.smooth?.value === true) progress = progress * progress * (3 - 2 * progress);
            return { passes: [pass({ uOpacity: n('from') + (n('to', 1) - n('from')) * progress })] };
        },
    };
}

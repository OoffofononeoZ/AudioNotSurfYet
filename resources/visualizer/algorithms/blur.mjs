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
            const radius = n('amount');
            return {
                passes:
                    radius <= 0
                        ? []
                        : [
                              pass({ uOperation: 1, uBlurStep: [((radius / 1080) * frame.height) / frame.width, 0] }),
                              pass({ uOperation: 1, uBlurStep: [0, radius / 1080] }),
                          ],
            };
        },
    };
}

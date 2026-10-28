import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** Original MIT-licensed particle definitions form an independent oracle; only trailing whitespace is normalized. */
export function originalParticles() {
    const draws: Array<{ x: number; y: number; radius: number; alpha: number }> = [];
    let arc = { x: 0, y: 0, radius: 0 };
    const context = vm.createContext({
        canvas: { width: 1920, height: 1080 },
        ctx: {
            beginPath() {},
            arc(x: number, y: number, radius: number) {
                arc = { x, y, radius };
            },
            fillStyle: '',
            fill() {
                const text = String(this.fillStyle);
                const alpha = Number(text.slice(text.lastIndexOf(',') + 1, -1));
                draws.push({ ...arc, alpha: Math.max(0, Math.min(1, alpha)) });
            },
        },
        Math,
        particles: {},
        audioSample: Array(128).fill(0),
        speed: 2,
        maxDepth: 4,
        userParticleRadius: 0,
        customParColor: '255,255,255',
        particleColor: 'rgba(255,255,255,1)',
        rainbowParticle: false,
        clearOpacity: 1,
    });
    vm.runInContext(
        readFileSync(new URL('../fixtures/visualizer/circular-original-particles.js', import.meta.url), 'utf8'),
        context,
    );
    return {
        context,
        depth(particles: any[], bass: number, active = true) {
            context.audioSample.fill(0);
            context.audioSample[0] = bass;
            draws.length = 0;
            if (active)
                for (const particle of particles) {
                    context.ParticlesStyle2.prototype.draw.call(particle);
                    context.ParticlesStyle2.prototype.update.call(particle);
                }
            return { speed: context.speed as number, draws: structuredClone(draws) };
        },
        outward(particle: any, bass: number, mid = 0) {
            context.audioSample.fill(0);
            context.audioSample[0] = bass;
            context.audioSample[29] = mid;
            context.Particle.prototype.draw.call(particle);
        },
    };
}

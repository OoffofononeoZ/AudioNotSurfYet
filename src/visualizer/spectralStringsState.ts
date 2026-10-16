import { SPECTRUM_REFERENCE } from './analysisSignal';
const BANDS = 64;
const STEP = 1 / 60;
const clamp = (v:number) => Math.max(0,Math.min(1,v));
export function spectrumBands(values: readonly number[], output: Float32Array = new Float32Array(BANDS)): Float32Array {
    for (let band=0;band<BANDS;band++) {
        const start=Math.floor(band*values.length/BANDS), end=Math.max(start+1,Math.floor((band+1)*values.length/BANDS));
        let peak=0;
        for (let i=start;i<end;i++) peak=Math.max(peak,values[i] ?? 0);
        output[band]=clamp(Math.log1p(peak)/Math.log1p(SPECTRUM_REFERENCE));
    }
    return output;
}
interface State { tick:number; position:Float32Array; velocity:Float32Array; previous:Float32Array; levels:Float32Array; }
const fresh=():State => ({tick:0,position:new Float32Array(BANDS),velocity:new Float32Array(BANDS),previous:new Float32Array(BANDS),levels:new Float32Array(BANDS)});
const copy=(s:State):State => ({tick:s.tick,position:s.position.slice(),velocity:s.velocity.slice(),previous:s.previous.slice(),levels:s.levels.slice()});

/** Fixed 60Hz input sampling, two 120Hz integration substeps, one checkpoint per song second. */
export class SpectralStringsState {
    private key='';
    private checkpoints=new Map<number,State>();
    private latest=fresh();
    reset() { this.key=''; this.checkpoints.clear(); this.latest=fresh(); }
    resolve(time:number, key:string, decay:number, source:(time:number)=>readonly number[]):State {
        if (key !== this.key) { this.reset(); this.key=key; this.checkpoints.set(0,fresh()); }
        const tick=Math.max(0,Math.floor(time*60+1e-8));
        if (this.latest.tick > tick) this.latest=copy(this.checkpoints.get(Math.floor(tick/60)*60) ?? this.checkpoints.get(0)!);
        while (this.latest.tick < tick) {
            const s=this.latest; spectrumBands(source(s.tick*STEP),s.levels);
            for (let b=0;b<BANDS;b++) {
                const level=s.levels[b]!, rise=Math.max(0,level-s.previous[b]!);
                s.velocity[b]!+=rise*(12+8*b/(BANDS-1));
                const omega=7+16*b/(BANDS-1), damping=2/decay;
                for (let sub=0;sub<2;sub++) {
                    const acceleration=-omega*omega*s.position[b]!-damping*s.velocity[b]!;
                    s.velocity[b]!+=acceleration/120; s.position[b]!+=s.velocity[b]!/120;
                }
                s.previous[b]=level;
            }
            s.tick++;
            if (s.tick % 60 === 0) this.checkpoints.set(s.tick,copy(s));
        }
        return this.latest;
    }
}

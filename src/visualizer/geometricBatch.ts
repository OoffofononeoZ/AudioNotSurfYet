import { SPECTRUM_REFERENCE } from './analysisSignal';
import type { SpectrumUnit } from './rendererTypes';
/** Reusable CPU mesh. Lines are triangles so width is consistent on WebGL implementations. */
export type Point3 = readonly [number, number, number];
export type Ink = readonly [number, number, number, number];
export class GeometricBatch {
    readonly positions = new Float32Array(65536 * 3);
    readonly colors = new Float32Array(65536 * 4);
    readonly edges = new Float32Array(65536 * 2);
    pixelSize = 1/1080;
    count = 0;
    reset() { this.count = 0; }
    vertex(x: number, y: number, color: Ink, distance=0, halfWidth=1) {
        if (this.count >= 65536) throw Error('几何元素超过顶点容量。');
        this.positions.set([x, y, 0], this.count * 3);
        this.colors.set(color, this.count * 4);
        this.edges.set([distance,halfWidth],this.count*2); this.count++;
    }
    triangle(a: Point3, b: Point3, c: Point3, color: Ink) {
        this.vertex(a[0], a[1], color); this.vertex(b[0], b[1], color); this.vertex(c[0], c[1], color);
    }
    line(a: Point3, b: Point3, width: number, color: Ink) {
        const dx=b[0]-a[0], dy=b[1]-a[1], length=Math.hypot(dx,dy);
        if (length < 1e-10) return;
        const half=width/2, outer=half+this.pixelSize;
        const nx=-dy/length*outer, ny=dx/length*outer;
        const p:Point3=[a[0]+nx,a[1]+ny,0], q:Point3=[b[0]+nx,b[1]+ny,0];
        const r:Point3=[b[0]-nx,b[1]-ny,0], s:Point3=[a[0]-nx,a[1]-ny,0];
        this.vertex(p[0],p[1],color,outer,half);this.vertex(q[0],q[1],color,outer,half);this.vertex(r[0],r[1],color,-outer,half);
        this.vertex(p[0],p[1],color,outer,half);this.vertex(r[0],r[1],color,-outer,half);this.vertex(s[0],s[1],color,-outer,half);
    }
}

/** p5 post-multiplies model transforms: the last named axis acts on a vertex first. */
export function rotate([x,y,z]:Point3, ax:number, ay:number, az:number, order:'xyz'|'yxz'='xyz'):Point3 {
    const x1=x*Math.cos(az)-y*Math.sin(az), y1=x*Math.sin(az)+y*Math.cos(az);
    if(order==='yxz') {
        const y2=y1*Math.cos(ax)-z*Math.sin(ax), z2=y1*Math.sin(ax)+z*Math.cos(ax);
        return [x1*Math.cos(ay)+z2*Math.sin(ay),y2,-x1*Math.sin(ay)+z2*Math.cos(ay)];
    }
    const x2=x1*Math.cos(ay)+z*Math.sin(ay), z2=-x1*Math.sin(ay)+z*Math.cos(ay);
    return [x2,y1*Math.cos(ax)-z2*Math.sin(ax),y1*Math.sin(ax)+z2*Math.cos(ax)];
}

/** Fixed reference response, independent of song loudness history, RAF rate and seeking. */
export function geometricSpectrum(input: readonly number[], sensitivity: number, output: Float32Array = new Float32Array(128),unit:SpectrumUnit='meyda-amplitude') {
    if(unit==='we-strength') {
        for(let i=0;i<output.length;i++)output[i]=(input[i]??0)*sensitivity;
        return output;
    }
    if(unit==='byte-frequency') {
        const sourceBands=input.length/2;
        for(let channel=0;channel<2;channel++)for(let band=0;band<64;band++) {
            const start=Math.floor(band*sourceBands/64),end=Math.max(start+1,Math.floor((band+1)*sourceBands/64));
            let peak=0;for(let i=start;i<end;i++)peak=Math.max(peak,input[channel*sourceBands+i]??0);
            output[channel*64+band]=peak/255*sensitivity;
        }
        return output;
    }
    // Wallpaper Engine supplies 64 bands per channel. Analyzer supplies mono FFT;
    // repeat its 64 bands into both channel slots to preserve the source's radial symmetry.
    const bands=output.length/2;
    for (let i=0;i<bands;i++) {
        const start=Math.floor(i*input.length/bands), end=Math.max(start+1,Math.floor((i+1)*input.length/bands));
        let peak=0; for(let j=start;j<end;j++) peak=Math.max(peak,unit==='signed-waveform'?Math.abs(input[j]??0):input[j] ?? 0);
        output[i]=(unit==='signed-waveform'?peak:Math.min(1,Math.log1p(peak)/Math.log1p(SPECTRUM_REFERENCE)))*sensitivity;
        output[i+bands]=output[i]!;
    }
    return output;
}

export const randomUnit=(seed:number,index:number) => {
    let n=Math.imul(seed ^ Math.imul(index+1,0x9e3779b9),0x85ebca6b);
    n=Math.imul(n ^ n>>>13,0xc2b2ae35); return ((n ^ n>>>16)>>>0)/4294967296;
};

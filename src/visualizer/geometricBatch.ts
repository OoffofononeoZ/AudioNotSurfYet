/** Reusable CPU mesh. Lines are triangles so width is consistent on WebGL implementations. */
export type Point3 = readonly [number, number, number];
export type Ink = readonly [number, number, number, number];
export class GeometricBatch {
    readonly positions = new Float32Array(65536 * 3);
    readonly colors = new Float32Array(65536 * 4);
    count = 0;
    reset() { this.count = 0; }
    vertex(x: number, y: number, color: Ink) {
        if (this.count >= 65536) throw Error('几何元素超过顶点容量。');
        this.positions.set([x, y, 0], this.count * 3);
        this.colors.set(color, this.count * 4); this.count++;
    }
    triangle(a: Point3, b: Point3, c: Point3, color: Ink) {
        this.vertex(a[0], a[1], color); this.vertex(b[0], b[1], color); this.vertex(c[0], c[1], color);
    }
    line(a: Point3, b: Point3, width: number, color: Ink) {
        const dx=b[0]-a[0], dy=b[1]-a[1], length=Math.hypot(dx,dy);
        if (length < 1e-10) return;
        const nx=-dy/length*width/2, ny=dx/length*width/2;
        const p:Point3=[a[0]+nx,a[1]+ny,0], q:Point3=[b[0]+nx,b[1]+ny,0];
        const r:Point3=[b[0]-nx,b[1]-ny,0], s:Point3=[a[0]-nx,a[1]-ny,0];
        this.triangle(p,q,r,color); this.triangle(p,r,s,color);
    }
}

export function rotate([x,y,z]:Point3, ax:number, ay:number, az:number):Point3 {
    const y1=y*Math.cos(ax)-z*Math.sin(ax), z1=y*Math.sin(ax)+z*Math.cos(ax);
    const x2=x*Math.cos(ay)+z1*Math.sin(ay), z2=-x*Math.sin(ay)+z1*Math.cos(ay);
    return [x2*Math.cos(az)-y1*Math.sin(az),x2*Math.sin(az)+y1*Math.cos(az),z2];
}

/** Fixed reference response, independent of song loudness history, RAF rate and seeking. */
export function geometricSpectrum(input: readonly number[], sensitivity: number, output: Float32Array = new Float32Array(128)) {
    for (let i=0;i<output.length;i++) {
        const start=Math.floor(i*input.length/output.length), end=Math.max(start+1,Math.floor((i+1)*input.length/output.length));
        let peak=0; for(let j=start;j<end;j++) peak=Math.max(peak,input[j] ?? 0);
        output[i]=Math.min(1,Math.log1p(peak)/Math.log1p(128))*sensitivity;
    }
    return output;
}

export const randomUnit=(seed:number,index:number) => {
    let n=Math.imul(seed ^ Math.imul(index+1,0x9e3779b9),0x85ebca6b);
    n=Math.imul(n ^ n>>>13,0xc2b2ae35); return ((n ^ n>>>16)>>>0)/4294967296;
};

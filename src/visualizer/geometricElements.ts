import { elementNumber, elementValue } from './compositionEffects';
import { GeometricBatch, geometricSpectrum, randomUnit, rotate, type Point3, type Ink } from './geometricBatch';
import { buildLightTunnel, buildStarfield } from './cinematicElements';
import type { VisualizerElement } from './compositionTypes';
import type { VisualizerResolvedParameterMap } from './rendererTypes';

const TAU=Math.PI*2;
const palette=['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffa500','#808080','#800000','#008000','#000080','#800080'];
const rgb=(hex:string,alpha:number):Ink => [parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255,alpha];
const cube:readonly Point3[]=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
// p5 1.8 cone(..., 4) includes the seam vertex: three distinct base corners, open base.
const pyramid:readonly Point3[]=[[0,.5,0],[0,-.5,1],[Math.sqrt(3)/2,-.5,-.5],[-Math.sqrt(3)/2,-.5,-.5]];
const cubeEdges=[0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7];
const pyramidEdges=[0,1,0,2,0,3,1,2,2,3,3,1];
const cubeFaces=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
const pyramidFaces=[0,1,2,0,2,3,0,3,1];

export const isGeometricElement=(type:string) => ['radial-spectrum','orbit-solids','wireform','arc-lattice','light-tunnel','starfield'].includes(type);

/** Each call rebuilds only this atom from absolute song time; no mutable animation history. */
export function buildGeometricElement(batch:GeometricBatch,e:VisualizerElement,values:VisualizerResolvedParameterMap,time:number,seed:number,aspect:number,levels:Float32Array) {
    batch.reset();
    const n=(id:string,fallback=0)=>elementNumber(values,e,id,fallback);
    const input=elementValue(values,e,'spectrum');
    const source=e.bindings.find(b=>b.parameterId==='spectrum')?.source;
    geometricSpectrum(Array.isArray(input)?input:[],n('sensitivity',.6),levels,source?.kind==='native'&&source.featureId==='frequency');
    let peak=0; for(const level of levels) peak=Math.max(peak,level);
    const alpha=n('opacity',1), white=rgb(String(elementValue(values,e,'color') ?? '#ffffff'),alpha);
    const colorful=elementValue(values,e,'chromatic') === true;
    const frame=Math.floor(time*60);
    const randomInk=(index:number):Ink=>[randomUnit(seed,index),randomUnit(seed,index+1),randomUnit(seed,index+2),alpha];
    const accent=randomInk(frame*3),width=n('thickness',1)/1600;
    const cx=(n('x',.5)-.5)*aspect, cy=.5-n('y',.5);
    const point=(x:number,y:number,z=0):Point3=>{
        const projection=.8660254/(.8660254-z);
        return [cx+x*projection,cy-y*projection,0];
    };
    const line=(a:Point3,b:Point3,ink=white)=>batch.line(a,b,width,ink);
    const arc=(radius:number,start:number,sweep:number,ax=0,ay=0,ink=white)=>{
        const steps=Math.max(8,Math.ceil(Math.abs(sweep)*48));
        let previous:Point3|null=null;
        for(let i=0;i<=steps;i++) {
            const a=start+sweep*i/steps, p=rotate([Math.cos(a)*radius,Math.sin(a)*radius,0],ax,ay,0), current=point(...p);
            if(previous)line(previous,current,ink); previous=current;
        }
    };
    const solid=(shape:number,size:number,x:number,y:number,ax:number,ay:number,az:number,fill:Ink|null,offsetY=0,height=size*84.85/60)=>{
        const vertices=(shape===1?pyramid:cube).map(v=>{
            const p=rotate([v[0]*size,v[1]*(shape===1?height:size)+offsetY,v[2]*size],ax,ay,az,shape===1?'yxz':'xyz');
            return point(p[0]+x,p[1]+y,p[2]);
        });
        const faces=shape===1?pyramidFaces:cubeFaces, edges=shape===1?pyramidEdges:cubeEdges;
        if(fill) for(let i=0;i<faces.length;i+=3) batch.triangle(vertices[faces[i]!]!,vertices[faces[i+1]!]!,vertices[faces[i+2]!]!,fill);
        for(let i=0;i<edges.length;i+=2) line(vertices[edges[i]!]!,vertices[edges[i+1]!]!);
    };
    if(e.type==='light-tunnel') {
        buildLightTunnel(batch,n,time,peak,white,rgb(String(elementValue(values,e,'accent') ?? '#ff408e'),alpha),cx,cy);
    } else if(e.type==='starfield') {
        buildStarfield(batch,n,time,seed,peak,white,cx,cy,aspect);
    } else if(e.type==='radial-spectrum') {
        const repeat=n('repeat',2), count=levels.length*repeat, ink=colorful&&peak>=.15?accent:white;
        let previous:Point3|null=null;
        for(let i=0;i<=count;i++) {
            const a=i/count*TAU, value=levels[i%levels.length] ?? 0;
            const r=n('radius',.25)*(1+peak*n('expansion',1))*(1+value*n('amplitude',1));
            const current=point(Math.cos(a)*r,Math.sin(a)*r);
            if(previous)line(previous,current,ink); previous=current;
        }
    } else if(e.type==='arc-lattice') {
        const rotation=-4.5+peak*125;
        for(let i=0;i<n('count',19);i++) {
            const radius=n('radius',.0625)+(n('spacing',.0025)+peak*n('amplitude',.0046875))*i;
            arc(radius,(i*50+rotation+50+i*rotation)*Math.PI/180+time*n('speed'),n('sweep',50)*Math.PI/180);
        }
    } else if(e.type==='orbit-solids') {
        const count=n('count',12), shape=n('shape'), speed=time*n('speed',.6), radius=n('radius',.0875);
        for(let i=0;i<count;i++) {
            const a=i/count*TAU+time*n('orbitSpeed'), wobble=time*.5+i*Math.PI/3;
            const value=shape===1?peak:levels[Math.min(127,i*11)] ?? 0, filled=value>=n('threshold',.05);
            const ink=colorful?(shape===1?randomInk(frame*9+i*3):rgb(palette[i%palette.length]!,alpha)):white;
            const size=n('size',.00875)*(shape===0&&filled?19/14:1), spin=speed+(shape===0?i*.1:0);
            solid(shape,size,radius*Math.cos(a)+n('wobble')*Math.cos(wobble),radius*Math.sin(a)+n('wobble')*Math.sin(wobble),spin,spin,0,filled?ink:null,0,size*4/3);
        }
    } else if(e.type==='wireform') {
        const size=n('size',.00875)*(1+peak*n('amplitude',7.5)), angle=time*n('speed',-.6)+n('phase');
        if(n('shape')===2) arc(size/2,0,TAU,angle,angle);
        else {
            const fill:Ink=[(30+152*randomUnit(seed,frame*3+1000000))/255,(9+91*randomUnit(seed,frame*3+1000001))/255,(99+randomUnit(seed,frame*3+1000002))/255,alpha];
            solid(n('shape'),size,0,0,angle,angle,angle,colorful&&peak>=n('threshold',.1286)?fill:null,n('shape')===1?size/3:0);
        }
    }
    return batch.count;
}

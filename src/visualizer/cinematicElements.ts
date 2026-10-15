import { GeometricBatch, randomUnit, type Ink, type Point3 } from './geometricBatch';

type NumberReader=(id:string,fallback?:number)=>number;
const TAU=Math.PI*2;
const fract=(value:number)=>value-Math.floor(value);
const mix=(a:Ink,b:Ink,t:number,alpha:number):Ink=>[a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t,alpha];

/** Perspective comes from explicit depth; rebuilding any time has no accumulated camera state. */
export function buildLightTunnel(batch:GeometricBatch,n:NumberReader,time:number,peak:number,primary:Ink,accent:Ink,cx:number,cy:number) {
    const count=n('count',28), sides=n('sides',6), width=n('thickness',1)/1600;
    const centerX=cx+Math.sin(time*.21)*n('drift',.035),centerY=cy+Math.cos(time*.17)*n('drift',.035)*.6;
    const layers:Array<{points:Point3[];z:number}>=[];
    for(let i=0;i<count;i++) {
        const z=fract(i/count+time*n('speed',.065));
        const radius=.022*Math.pow(65,z)*n('spread',1)*(1+peak*.22);
        const twist=z*n('twist',2.4)+time*.13;
        const points:Point3[]=Array.from({length:sides},(_,j)=>{const a=j/sides*TAU+twist;return [centerX+Math.cos(a)*radius,centerY+Math.sin(a)*radius,0];});
        layers.push({points,z});
    }
    layers.sort((a,b)=>a.z-b.z);
    for(let i=0;i<layers.length;i++) {
        const layer=layers[i]!, ink=mix(primary,accent,(Math.sin(layer.z*6+time*.23)+1)*.5,primary[3]);
        const fade=Math.min(1,layer.z*6)*Math.min(1,(1-layer.z)*5), brightness=fade*(.35+peak*.65);
        for(let j=0;j<sides;j++) {
            const a=layer.points[j]!,b=layer.points[(j+1)%sides]!;
            batch.line(a,b,width*18,[ink[0],ink[1],ink[2],brightness*.035*ink[3]]);
            batch.line(a,b,width*5,[ink[0],ink[1],ink[2],brightness*.14*ink[3]]);
            batch.line(a,b,width,[ink[0],ink[1],ink[2],brightness*ink[3]]);
            const next=layers[i+1];
            if(next)batch.line(a,next.points[j]!,width*.7,[ink[0],ink[1],ink[2],brightness*.22*ink[3]]);
        }
    }
}

export function buildStarfield(batch:GeometricBatch,n:NumberReader,time:number,seed:number,peak:number,ink:Ink,cx:number,cy:number,aspect:number) {
    const count=n('count',180),width=n('thickness',1)/1600;
    for(let i=0;i<count;i++) {
        const z=fract(randomUnit(seed,i*3)+time*n('speed',.08)),angle=randomUnit(seed,i*3+1)*TAU;
        const lane=.15+randomUnit(seed,i*3+2)*.85, radius=(.02+z*z*.8)*lane*n('spread',1);
        const tail=Math.max(.01,radius-n('stretch',.025)*z*(.25+peak*2));
        const a:Point3=[cx+Math.cos(angle)*radius*aspect,cy+Math.sin(angle)*radius,0];
        const b:Point3=[cx+Math.cos(angle)*tail*aspect,cy+Math.sin(angle)*tail,0];
        const alpha=Math.min(1,z*3)*Math.min(1,(1-z)*6)*ink[3];
        batch.line(a,b,width*5,[ink[0],ink[1],ink[2],alpha*.07]);
        batch.line(a,b,width*(.5+z),[ink[0],ink[1],ink[2],alpha*(.3+peak)]);
    }
}

import { elementRegistry } from './elementRegistry';
import type { ElementType, VisualizerElement } from './compositionTypes';

export type CompositionPresetId = 'geometric-0.6';
export const compositionPresets = [
    {id:'geometric-0.6' as const,title:'几何律动',description:'双环频谱与旋转几何 · 响应系数 0.6'},
];
type Constants=Record<string,number|string|boolean>;

export function createPresetElements(id:CompositionPresetId,duration:number,startLayer=0):VisualizerElement[] {
    if(!compositionPresets.some(p=>p.id===id))throw Error('未知预设。');
    const result:VisualizerElement[]=[];
    const add=(type:ElementType,name:string,constants:Constants={})=>{
        const e=elementRegistry.create(type,duration,startLayer+result.length);e.name=name;
        for(const b of e.bindings)if(Object.prototype.hasOwnProperty.call(constants,b.parameterId))b.source={kind:'constant',value:constants[b.parameterId]!};
        result.push(e);return e;
    };
    add('solid','纯黑背景',{color:'#000000'});
    add('radial-spectrum','外环 · 双重复频谱',{radius:.25,repeat:2,expansion:1});
    add('radial-spectrum','内环 · 四重复频谱',{radius:.225,repeat:4,expansion:0,thickness:.6});
    add('orbit-solids','十二频段方块');
    add('arc-lattice','十九条旋转弧');
    add('wireform','中心响应方块');
    add('wireform','中心棱锥',{shape:1,size:.0375,amplitude:0,speed:.9,chromatic:false});
    add('orbit-solids','三颗游移棱锥',{shape:1,count:3,radius:.04375,size:.0075,speed:1.2,wobble:.01875,threshold:.15});
    add('wireform','主旋转环',{shape:2,size:.050625,amplitude:300/81,speed:1.5,chromatic:false});
    add('wireform','交错环 A',{shape:2,size:.0378125,amplitude:150/60.5,speed:1.5,phase:Math.PI/3,chromatic:false});
    add('wireform','交错环 B',{shape:2,size:.0378125,amplitude:150/60.5,speed:1.5,phase:Math.PI*2/3,chromatic:false});
    return result;
}

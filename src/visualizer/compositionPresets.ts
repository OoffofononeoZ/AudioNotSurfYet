import { elementRegistry } from './elementRegistry';
import type { ElementType, VisualizerElement } from './compositionTypes';

export type CompositionPresetId = 'geometric-0.6' | 'prismatic-voyage';
export const compositionPresets = [
    {id:'geometric-0.6' as const,title:'几何律动',description:'双环频谱与旋转几何 · 响应系数 0.6'},
    {id:'prismatic-voyage' as const,title:'棱镜航行',description:'光轨隧道与跃迁星尘 · 四段动态构图'},
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
    if(id==='prismatic-voyage') {
        add('solid','深空背景',{color:'#02030c'});
        add('starfield','跃迁星尘',{color:'#9bcfff',count:240,thickness:1.8,opacity:.8,stretch:.045,speed:.09});
        const chapters=[
            {name:'序幕',start:0,end:.18,color:'#36b9ff',accent:'#7761ff',count:20,sides:6,twist:1.2,speed:.035,spread:.8},
            {name:'推进',start:.18,end:.46,color:'#5d7dff',accent:'#ff45b8',count:28,sides:4,twist:2.4,speed:.07,spread:1},
            {name:'高潮',start:.46,end:.80,color:'#ffbd72',accent:'#e837fa',count:32,sides:3,twist:-2.7,speed:.11,spread:1.15},
            {name:'尾声',start:.80,end:1,color:'#b0faff',accent:'#8a6fff',count:16,sides:8,twist:.7,speed:.025,spread:.9},
        ];
        for(const chapter of chapters) {
            const {name,start,end,...constants}=chapter;
            const e=add('light-tunnel',name+' · 光轨隧道',{...constants,thickness:2,opacity:.9,drift:.045});
            e.timing={kind:'manual',startSeconds:duration*start,endSeconds:duration*end};
        }
        add('radial-spectrum','远端频谱光环',{radius:.30,repeat:2,expansion:.3,amplitude:.3,thickness:1.6,chromatic:false,color:'#78dbff',opacity:.4});
        add('arc-lattice','导航弧簇',{radius:.11,count:12,spacing:.009,amplitude:.0015,sweep:75,speed:.07,color:'#6889ff',thickness:1.8,opacity:.65});
        add('wireform','棱镜核心',{shape:1,size:.065,amplitude:1.3,speed:.27,chromatic:false,color:'#e1f7ff',thickness:2.4});
        add('wireform','倾斜光环 A',{shape:2,size:.20,amplitude:.3,speed:.32,phase:1.2,chromatic:false,color:'#78dcff',thickness:1.8,opacity:.8});
        add('wireform','倾斜光环 B',{shape:2,size:.23,amplitude:.4,speed:-.23,phase:2.4,chromatic:false,color:'#ff70c6',thickness:1.8,opacity:.65});
        add('orbit-solids','轨道信标',{count:6,radius:.16,size:.013,speed:.4,orbitSpeed:.12,chromatic:false,color:'#75dfff',threshold:.05,thickness:1.5});
        return result;
    }
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
    for(const e of result)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'native',featureId:'frequency'};
    return result;
}

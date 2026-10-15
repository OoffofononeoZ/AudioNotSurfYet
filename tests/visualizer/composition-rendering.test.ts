import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { createComposition, validateComposition } from '../../src/visualizer/compositionCodec';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { CompositionScene, type CompositionRenderPort } from '../../src/visualizer/compositionScene';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { effectsFor, fadeOpacity, parameterKey } from '../../src/visualizer/compositionEffects';
import { SpectralStringsState } from '../../src/visualizer/spectralStringsState';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';
const track={contentHash:'a'.repeat(64),fileName:'render.wav',durationSeconds:10,sampleRate:48000};
function harness() {
    const p=createComposition(track); p.elements=elementRegistry.list().filter(e=>e.id!=='fade').map((e,i)=>elementRegistry.create(e.id,10,i));
    const values=new Map<string,{parameterId:string;state:'ready';value:number|string|boolean|number[]}>();
    for(const e of p.elements) for(const b of e.bindings) values.set(parameterKey(e.id,b.parameterId),{parameterId:b.parameterId,state:'ready',value:b.source.kind==='constant'?b.source.value:b.parameterId==='spectrum'?Array(512).fill(40):1.1});
    const calls:Array<{target:THREE.WebGLRenderTarget|null;op:number;final:boolean;blend:boolean}>=[];
    let target:THREE.WebGLRenderTarget|null=null;
    const targets=new Set<THREE.WebGLRenderTarget>(); let releases=0;
    const port:CompositionRenderPort={autoClear:true,setClearColor(){return this as never;},clear(){},setRenderTarget(value){target=value as THREE.WebGLRenderTarget|null;if(target && !targets.has(target)){targets.add(target);target.addEventListener('dispose',()=>releases++);}},render(scene){const m=(scene.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>).material; calls.push({target,op:m.uniforms.uOperation?.value ?? -1,final:m.uniforms.uFinal?.value ?? false,blend:m.transparent});}};
    const scene=new CompositionScene({renderer:port,readProject:()=>p,resolveAt:()=>values}); scene.resize(640,360,2);
    return {p,values,scene,port,calls,targets,releases:()=>releases};
}
describe('composition rendering',()=>{
    test('uses three reusable targets, composits visual layers and applies global effects',()=>{
        const h=harness(); const blur=h.p.elements.find(e=>e.type==='blur')!;
        h.values.set(parameterKey(blur.id,'amount'),{parameterId:'amount',state:'ready',value:8});
        h.scene.render({timeSeconds:1,values:h.values,bindingRevision:1});
        expect(h.targets.size).toBe(3); expect(h.calls.filter(c=>c.blend)).toHaveLength(4);
        expect(h.calls.filter(c=>c.op===1)).toHaveLength(2); expect(h.calls.at(-1)).toMatchObject({target:null,final:true});
        expect(h.port.autoClear).toBe(true); h.scene.dispose(); h.scene.dispose(); expect(h.releases()).toBe(3);
    });
    test('direct seek and sequential rendering produce the same frame state',()=>{
        const h=harness(); const at=(time:number)=>h.scene.render({timeSeconds:time,values:h.values,bindingRevision:1}).hash;
        for(let t=0;t<180;t++) at(t/60);
        const expected=at(3); at(.5); expect(at(3)).toBe(expected);
        h.scene.dispose(); const direct=harness(); direct.p.projectId=h.p.projectId; direct.p.seed=h.p.seed; direct.p.elements=h.p.elements; direct.values.clear(); for(const [key,value] of h.values) direct.values.set(key,value);
        expect(direct.scene.render({timeSeconds:3,values:direct.values,bindingRevision:1}).hash).toBe(expected); direct.scene.dispose();
    });
    test('fixed string integration remains deterministic across backward seeks',()=>{
        const source=(t:number)=>Array.from({length:512},(_,i)=>Math.max(0,Math.sin(t*4+i*.03))*100);
        const state=new SpectralStringsState(); let expected:number[]=[];
        for(let i=0;i<=180;i++) expected=[...state.resolve(i/60,'key',.6,source).position];
        state.resolve(.25,'key',.6,source); expect([...state.resolve(3,'key',.6,source).position]).toEqual(expected);
        expect([...new SpectralStringsState().resolve(3,'key',.6,source).position]).toEqual(expected);
    });
    test('multi-target effects are isolated and later transitions take over the held value',()=>{
        const p=createComposition(track); const visual=elementRegistry.create('solid',10,0), other=elementRegistry.create('solid',10,1), blur=elementRegistry.create('blur',10,2);
        blur.targets={kind:'elements',ids:[visual.id]};
        const editor=createInitialEditorProject({track}), laneId=crypto.randomUUID(), innerClassId=crypto.randomUUID(), aId=crypto.randomUUID(), bId=crypto.randomUUID();
        editor.lanes.push({id:laneId,name:'FX',eventKind:'range',innerClasses:[{id:innerClassId,label:'切换'}],events:[{id:aId,innerClassId,startSeconds:1,endSeconds:2},{id:bId,innerClassId,startSeconds:4,endSeconds:5}]});
        p.editorSnapshot={capturedAt:new Date().toISOString(),project:editor};
        const a=elementRegistry.create('fade',10,3),b=elementRegistry.create('fade',10,4); a.timing={kind:'editor-range',laneId,eventId:aId};b.timing={kind:'editor-range',laneId,eventId:bId};p.elements=[visual,other,blur,a,b]; validateComposition(p);
        expect(effectsFor(p,visual.id,2)).toEqual([blur]); expect(effectsFor(p,other.id,2)).toEqual([]);
        expect(effectsFor(p,null,3)).toEqual([a]); expect(effectsFor(p,null,4.5)).toEqual([b]);
        const values:VisualizerResolvedParameterMap=new Map([[parameterKey(a.id,'from'),{parameterId:'from',state:'ready',value:1}],[parameterKey(a.id,'to'),{parameterId:'to',state:'ready',value:0}]]);
        expect(fadeOpacity(p,a,3,values)).toBe(0);
    });
});

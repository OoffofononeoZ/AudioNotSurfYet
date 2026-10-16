import { describe, expect, test } from 'vitest';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { parameterKey } from '../../src/visualizer/compositionEffects';
import { GeometricBatch, geometricSpectrum } from '../../src/visualizer/geometricBatch';
import { buildGeometricElement } from '../../src/visualizer/geometricElements';
import type { ElementType } from '../../src/visualizer/compositionTypes';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';

function harness(type:ElementType,spectrum:number[]) {
    const e=elementRegistry.create(type,10,0), batch=new GeometricBatch(), levels=new Float32Array(128);
    const values:VisualizerResolvedParameterMap=new Map(e.bindings.map(b=>[parameterKey(e.id,b.parameterId),{parameterId:b.parameterId,state:'ready',value:b.source.kind==='constant'?b.source.value:spectrum}]));
    const at=(time:number)=>{buildGeometricElement(batch,e,values,time,314159,16/9,levels);return [...batch.positions.subarray(0,batch.count*3),...batch.colors.subarray(0,batch.count*4)];};
    return {at,batch};
}
describe('geometric atoms',()=>{
    for(const type of ['radial-spectrum','orbit-solids','wireform','arc-lattice','light-tunnel','starfield'] as const) {
        test(type+' preserves an idle outline and responds deterministically to music',()=>{
            const idle=harness(type,[]), active=harness(type,Array.from({length:512},(_,i)=>i%17===0?64:2));
            const frame=active.at(3);expect(frame.every(Number.isFinite)).toBe(true);expect(idle.at(3).length).toBeGreaterThan(0);
            expect(frame).not.toEqual(idle.at(3));active.at(.5);expect(active.at(3)).toEqual(frame);
            expect(active.batch.count).toBeLessThan(65536);
        });
    }
    test('spectrum response uses a fixed reference and exact user sensitivity',()=>{
        expect([...geometricSpectrum([], .6)]).toEqual(Array(128).fill(0));
        const full=geometricSpectrum(Array(512).fill(128),.6);
        expect(full[0]).toBeCloseTo(.6);expect(full[127]).toBeCloseTo(.6);
        expect(geometricSpectrum(Array(512).fill(128),0)[0]).toBe(0);
        const asymmetric=geometricSpectrum(Array.from({length:512},(_,i)=>i<8?128:0),.6);
        expect(asymmetric[0]).toBeCloseTo(.6);expect(asymmetric[1]).toBe(0);
        expect([...asymmetric.slice(0,64)]).toEqual([...asymmetric.slice(64)]);
    });
    test('maximum count and sweep remain inside the shared geometry capacity',()=>{
        for(const type of ['arc-lattice','light-tunnel','starfield'] as const){
            const e=elementRegistry.create(type,10,0),batch=new GeometricBatch();
            const values:VisualizerResolvedParameterMap=new Map(elementRegistry.get(type).parameters.map(p=>[parameterKey(e.id,p.id),{parameterId:p.id,state:'ready',value:p.id==='spectrum'?Array(512).fill(128):p.valueKind==='number'?Number(p.range?.max ?? p.defaultValue):p.defaultValue as number|string|boolean|number[]}]));
            buildGeometricElement(batch,e,values,3,314159,16/9,new Float32Array(128));
            expect(batch.count).toBeGreaterThan(0);expect(batch.count).toBeLessThan(65536);expect([...batch.positions.subarray(0,batch.count*3)].every(Number.isFinite)).toBe(true);
        }
    });
});

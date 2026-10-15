import { expect,test } from 'vitest';
import { createComposition, decodeComposition, encodeComposition } from '../../src/visualizer/compositionCodec';
import { compositionPresets, createPresetElements } from '../../src/visualizer/compositionPresets';
import { compositionIssues, planCompositionFeatures } from '../../src/visualizer/compositionModel';
const track={contentHash:'a'.repeat(64),fileName:'preset.wav',durationSeconds:123.456,sampleRate:48000};
test('presets expand to editable strict V3 elements with independent identities',()=>{
    for(const preset of compositionPresets){
        const p=createComposition(track);p.elements=createPresetElements(preset.id,track.durationSeconds,3);
        expect(p.elements[0]!.layer).toBe(3);expect(compositionIssues(p)).toEqual([]);
        expect(planCompositionFeatures(p)).toEqual(['amplitudeSpectrum']);
        const bytes=encodeComposition(p);expect(decodeComposition(bytes.buffer as ArrayBuffer)).toEqual(p);
        const second=createPresetElements(preset.id,track.durationSeconds,p.elements.length+3);
        expect(new Set([...p.elements,...second].map(e=>e.id)).size).toBe(p.elements.length+second.length);
        for(const e of p.elements.filter(e=>e.type!=='solid'))expect(e.bindings.find(b=>b.parameterId==='sensitivity')?.source).toEqual({kind:'constant',value:.6});
    }
});
test('PV chapters cover the entire song and remain editable manual intervals',()=>{
    const elements=createPresetElements('prismatic-voyage',track.durationSeconds);
    const chapters=elements.filter(e=>e.type==='light-tunnel');expect(chapters).toHaveLength(4);
    expect(chapters[0]!.timing).toMatchObject({kind:'manual',startSeconds:0});
    expect(chapters.at(-1)!.timing).toMatchObject({endSeconds:track.durationSeconds});
    for(let i=1;i<chapters.length;i++)expect((chapters[i]!.timing as {startSeconds:number}).startSeconds).toBe((chapters[i-1]!.timing as {endSeconds:number}).endSeconds);
});

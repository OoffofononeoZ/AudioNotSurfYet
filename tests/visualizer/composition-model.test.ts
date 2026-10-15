import { describe, expect, test } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { createComposition, validateComposition, encodeComposition, decodeComposition } from '../../src/visualizer/compositionCodec';
import { CompositionDraftRepository } from '../../src/visualizer/compositionDraftRepository';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { compositionIssues, elementRange, removeCompositionElement, reorderComposition } from '../../src/visualizer/compositionModel';
const track={contentHash:'a'.repeat(64),fileName:'composition.wav',durationSeconds:10,sampleRate:48000};
const project=() => createComposition(track);

describe('V3 composition project', () => {
    test('starts empty and round trips every registered element', () => {
        const p=project(); expect(p.elements).toEqual([]);
        p.elements=elementRegistry.list().map((d,i) => elementRegistry.create(d.id,10,i));
        const bytes=encodeComposition(p);
        expect(decodeComposition(bytes.buffer as ArrayBuffer)).toEqual(p);
        expect(compositionIssues(p)).toEqual(['淡入淡出：请选择范围标记']);
    });
    test('strictly rejects old formats, extra fields, invalid targets and nonfinite values', () => {
        const p=project(); p.elements.push(elementRegistry.create('solid',10,0),elementRegistry.create('blur',10,1));
        expect(() => validateComposition({...p,schemaVersion:1})).toThrow(/不兼容/);
        expect(() => validateComposition({...p,extra:1})).toThrow();
        p.elements[1]!.targets={kind:'elements',ids:[p.elements[1]!.id]};
        expect(() => validateComposition(p)).toThrow(/视觉元素/);
        p.elements[1]!.targets={kind:'elements',ids:[p.elements[0]!.id]};
        expect(validateComposition(p)).toEqual(p);
        p.elements[0]!.layer=Infinity; expect(() => validateComposition(p)).toThrow();
    });
    test('uses the exact chosen range and rejects an invalid refreshed snapshot atomically', () => {
        const p=project(); const editor=createInitialEditorProject({track});
        const laneId=crypto.randomUUID(), eventId=crypto.randomUUID(), innerClassId=crypto.randomUUID();
        editor.lanes.push({id:laneId,name:'FX',eventKind:'range',innerClasses:[{id:innerClassId,label:'淡出'}],events:[{id:eventId,innerClassId,startSeconds:7,endSeconds:10}]});
        p.editorSnapshot={capturedAt:new Date().toISOString(),project:editor};
        const fade=elementRegistry.create('fade',10,1); fade.timing={kind:'editor-range',laneId,eventId}; p.elements.push(fade);
        expect(elementRange(validateComposition(p),fade)).toMatchObject({startSeconds:7,endSeconds:10});
        const candidate=structuredClone(p); candidate.editorSnapshot!.project.lanes=[];
        expect(() => validateComposition(candidate)).toThrow(/引用/);
        expect(elementRange(p,fade)?.startSeconds).toBe(7);
    });
    test('removes only deleted target references and preserves configurable effects', () => {
        const p=project(); const a=elementRegistry.create('solid',10,0), b=elementRegistry.create('blur',10,1); b.targets={kind:'elements',ids:[a.id]}; p.elements=[a,b];
        const removed=removeCompositionElement(p,a.id);
        expect(removed.elements).toHaveLength(1); expect(compositionIssues(removed)).toEqual(['模糊：请选择影响对象']);
        expect(p.elements).toHaveLength(2);
        expect(reorderComposition(p,[a.id,b.id]).elements.find(e=>e.id===a.id)?.layer).toBe(1);
    });
    test('limits the entire project to four distinct Analyzer features', () => {
        const p=project();
        for (const featureId of ['energy','rms','zcr','spectralCentroid','spectralFlatness'] as const) {
            const e=elementRegistry.create('blur',10,p.elements.length);
            e.bindings[0]={parameterId:'amount',source:{kind:'analysis',featureId,projection:{kind:'scalar'}}}; p.elements.push(e);
        }
        expect(() => validateComposition(p)).toThrow(/四个/);
    });
    test('keeps old draft bytes untouched until an explicit replacement', async () => {
        const name='composition-'+crypto.randomUUID(); const open=indexedDB.open(name,1);
        const db=await new Promise<IDBDatabase>((resolve,reject)=>{open.onupgradeneeded=()=>open.result.createObjectStore('draft',{keyPath:'key'});open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
        const raw={schemaVersion:1,savedAt:'2026-01-01T00:00:00Z',project:{scene:'legacy'}};
        await new Promise<void>(resolve=>{const tx=db.transaction('draft','readwrite');tx.objectStore('draft').put({key:'latest',envelope:raw});tx.oncomplete=()=>resolve();}); db.close();
        const repo=new CompositionDraftRepository(indexedDB,name);
        expect(await repo.restore()).toEqual({kind:'unsupported',raw});
        expect(await repo.restore()).toEqual({kind:'unsupported',raw});
        const draft={schemaVersion:3 as const,savedAt:new Date().toISOString(),project:project()}; await repo.replace(draft);
        expect(await repo.restore()).toEqual({kind:'current',draft}); repo.close();
    });
});

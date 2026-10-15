import { elementRange, orderedElements } from './compositionModel';
import { elementRegistry } from './elementRegistry';
import type { VisualizerElement, VisualizerProjectV3 } from './compositionTypes';
import type { VisualizerResolvedParameterMap } from './rendererTypes';
export const parameterKey = (id:string,parameter:string) => id+':'+parameter;
export const elementValue = (values:VisualizerResolvedParameterMap,e:VisualizerElement,id:string) => values.get(parameterKey(e.id,id))?.value;
export const elementNumber = (values:VisualizerResolvedParameterMap,e:VisualizerElement,id:string,fallback=0) => {
    const value=elementValue(values,e,id); return typeof value === 'number' ? value : fallback;
};
export function effectsFor(project:VisualizerProjectV3, target:string | null, time:number):VisualizerElement[] {
    const effects=orderedElements(project.elements).filter(e => e.enabled && elementRegistry.get(e.type).kind !== 'visual'
        && (target === null ? e.targets?.kind === 'composition' : e.targets?.kind === 'elements' && e.targets.ids.includes(target)));
    const transitions=effects.filter(e=>e.type==='fade' && elementRange(project,e));
    const started=transitions.filter(e=>elementRange(project,e)!.startSeconds<=time);
    const candidates=started.length ? started : transitions;
    // Latest start owns opacity, with higher layer and stable order resolving equal starts.
    const sorted=[...candidates].sort((a,b)=>{
        const diff=elementRange(project,a)!.startSeconds-elementRange(project,b)!.startSeconds;
        return (started.length ? diff : -diff) || a.layer-b.layer || transitions.indexOf(a)-transitions.indexOf(b);
    });
    const chosen=sorted[sorted.length-1];
    return effects.filter(e=>{
        if (e.type==='fade') return e===chosen;
        const range=elementRange(project,e); return range && time>=range.startSeconds && time<range.endSeconds;
    });
}
export function fadeOpacity(project:VisualizerProjectV3,e:VisualizerElement,time:number,values:VisualizerResolvedParameterMap):number {
    const range=elementRange(project,e); if (!range) return 1;
    let progress=Math.max(0,Math.min(1,(time-range.startSeconds)/(range.endSeconds-range.startSeconds)));
    if (elementValue(values,e,'smooth') === true) progress=progress*progress*(3-2*progress);
    return elementNumber(values,e,'from')+(elementNumber(values,e,'to',1)-elementNumber(values,e,'from'))*progress;
}

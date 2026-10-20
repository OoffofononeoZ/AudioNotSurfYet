import { elementRange, orderedElements, effectiveElements, elementDescriptor } from './compositionModel';
import type { VisualizerElement, CompositionRenderModel } from './compositionTypes';
export const parameterKey = (id: string, parameter: string) => id + ':' + parameter;
export function effectsFor(project: CompositionRenderModel, target: string | null, time: number): VisualizerElement[] {
    const effects = orderedElements(effectiveElements(project)).filter(
        e =>
            e.enabled &&
            elementDescriptor(project, e).kind !== 'visual' &&
            (target === null
                ? e.targets?.kind === 'composition'
                : e.targets?.kind === 'elements' && e.targets.ids.includes(target)),
    );
    const transitions = effects.filter(
        e => elementDescriptor(project, e).kind === 'transition' && elementRange(project, e),
    );
    const started = transitions.filter(e => elementRange(project, e)!.startSeconds <= time);
    const candidates = started.length ? started : transitions;
    // Latest start owns opacity, with higher layer and stable order resolving equal starts.
    const sorted = [...candidates].sort((a, b) => {
        const diff = elementRange(project, a)!.startSeconds - elementRange(project, b)!.startSeconds;
        return (started.length ? diff : -diff) || a.layer - b.layer || transitions.indexOf(a) - transitions.indexOf(b);
    });
    const chosen = sorted[sorted.length - 1];
    return effects.filter(e => {
        if (elementDescriptor(project, e).kind === 'transition') return e === chosen;
        const range = elementRange(project, e);
        return range && time >= range.startSeconds && time < range.endSeconds;
    });
}

import type { AlgorithmContract } from './algorithmTypes';
import type { CompositionRenderModel, VisualizerElement } from './compositionTypes';
import { elementAlgorithm, elementRange } from './compositionModel';
import { canonicalJson, resourceKey } from './resourceIdentity';

export function stateParameterIds(contract: AlgorithmContract): string[] {
    return [
        ...new Set([
            ...contract.historyParameters,
            ...(contract.stateParameters ?? contract.parameters.map(p => p.id)),
        ]),
    ].sort();
}

/** Versions are local to a scene and leaf UUID, independent of UI/persistence revisions. */
export class AlgorithmFrameRevisions {
    private entries = new Map<string, { signature: string; revision: number }>();
    private sequence = 0;

    resolve(project: CompositionRenderModel, element: VisualizerElement, sourceIdentity: string): string {
        const algorithm = elementAlgorithm(project, element);
        const parameters = new Set(stateParameterIds(algorithm.contract));
        const markerBindings = element.markerBindings ?? {};
        const laneIds = new Set(Object.values(markerBindings).flatMap(b => (b.kind === 'unbound' ? [] : [b.laneId])));
        if (element.timing.kind === 'editor-range') laneIds.add(element.timing.laneId);
        const signature = canonicalJson({
            project: project.projectId,
            algorithm: resourceKey(algorithm),
            seed: element.seed ?? null,
            range: elementRange(project, element),
            bindings: element.bindings
                .filter(b => parameters.has(b.parameterId))
                .sort((a, b) => a.parameterId.localeCompare(b.parameterId)),
            markerBindings,
            lanes: project.editorSnapshot?.project.lanes.filter(l => laneIds.has(l.id)) ?? [],
            sourceIdentity,
        });
        let entry = this.entries.get(element.id);
        if (!entry || entry.signature !== signature) {
            entry = { signature, revision: ++this.sequence };
            this.entries.set(element.id, entry);
        }
        return String(entry.revision);
    }

    retain(ids: readonly string[]) {
        const keep = new Set(ids);
        for (const id of this.entries.keys()) if (!keep.has(id)) this.entries.delete(id);
    }
}

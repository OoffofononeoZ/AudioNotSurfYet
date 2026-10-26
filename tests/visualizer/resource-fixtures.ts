import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';

/** Attach explicitly authored fixture leaves to V5 ownership and resource snapshots. */
export function attachElements(project: VisualizerProjectV6) {
    const leaves = project.elements;
    const result = appendStandaloneElements({ ...project, elements: [], items: [] }, project.elements);
    result.elements = leaves.map((e, layer) => Object.assign(e, { layer }));
    Object.assign(project, result);
    return project;
}

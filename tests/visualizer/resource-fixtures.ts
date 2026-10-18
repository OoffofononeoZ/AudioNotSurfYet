import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import type { VisualizerProjectV4 } from '../../src/visualizer/compositionTypes';

/** Attach explicitly authored fixture leaves to V4 ownership and resource snapshots. */
export function attachElements(project: VisualizerProjectV4) {
    const leaves = project.elements;
    const result = appendStandaloneElements({ ...project, elements: [], items: [] }, project.elements);
    result.elements = leaves.map((e, layer) => Object.assign(e, { layer }));
    Object.assign(project, result);
    return project;
}

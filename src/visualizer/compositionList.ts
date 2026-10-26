import type { VisualizerProjectV6 } from './compositionTypes';
import type { ResourceRef } from './resourceTypes';
import type { Scene3dItem } from './scene3dTypes';
import { sceneUnits } from './scene3dModel';

export interface CompositionListNode {
    id: string;
    kind: 'element' | 'preset' | 'scene3d';
    name: string;
    enabled: boolean;
    resource?: ResourceRef;
    children: CompositionListNode[];
}
export function compositionList(project: VisualizerProjectV6): CompositionListNode[] {
    const leaf = (id: string): CompositionListNode => {
        const e = project.elements.find(e => e.id === id)!;
        return { id, kind: 'element', name: e.name, enabled: e.enabled, resource: e.resource, children: [] };
    };
    const scene = (s: Scene3dItem): CompositionListNode => ({ ...s, children: [...s.children].reverse().map(leaf) });
    return [...project.items].reverse().map(item =>
        item.kind === 'element'
            ? leaf(item.id)
            : item.kind === 'scene3d'
              ? scene(item)
              : {
                    id: item.id,
                    kind: 'preset',
                    name: item.name,
                    enabled: item.enabled,
                    resource: item.resource,
                    children: sceneUnits(item.children, item.scenes3d ?? [])
                        .reverse()
                        .map(u =>
                            u.kind === 'element' ? leaf(u.id) : scene(item.scenes3d!.find(s => s.id === u.id)!),
                        ),
                },
    );
}
